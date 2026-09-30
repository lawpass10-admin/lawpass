-- user_feedback grows columns for the form it now collects.
--
-- The table was built for a single free-text box: one jsonb `feedback_body`
-- holding { text, page, submitted_at }, with a comment promising that other
-- keys "may grow without a migration". The box has since become a form — a
-- type, what went wrong, what should have happened, and an optional screenshot
-- — and that promise is the wrong one to keep here. A field that is asked of
-- every student is not context: it is a column. Sorting an inbox by type,
-- counting bugs against design complaints, or finding the rows that carry a
-- screenshot are all things this table should answer with an ordinary WHERE.
--
-- NOTHING IS DROPPED. `feedback_body` stays, with its two CHECK constraints
-- intact, because it is where every row filed before today lives. It loses only
-- its NOT NULL, so new rows can leave it empty — a CHECK evaluates to NULL and
-- therefore passes when the column is NULL, so the old constraints need no
-- edit to keep guarding the old rows. The columns below are the authority from
-- here on; the jsonb is history.
--
-- Safe to re-run: every statement is IF NOT EXISTS or idempotent, and the
-- backfill only touches rows that have not been backfilled.

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_feedback
  -- Which of the three cards the student picked. The SAME vocabulary as
  -- qa_reports.report_type, deliberately: a student's "the timer jumped" and a
  -- tester's are the same report, and two vocabularies for one thing would mean
  -- sorting the pile twice.
  --
  -- DEFAULT 'bug' so the backfill below has something to write for the rows
  -- that predate the picker, and so a future caller that forgets the field
  -- files a report rather than an error.
  ADD COLUMN IF NOT EXISTS feedback_type   text NOT NULL DEFAULT 'bug',
  -- "מה לא עבד?" — the message itself. Nullable for now; made NOT NULL in
  -- step 3, after the backfill has given the existing rows a value.
  ADD COLUMN IF NOT EXISTS problem_text    text NULL,
  -- "מה צריך להיות במקום?" — optional, unlike the QA form's own version of
  -- this field. A student who knows a thing is broken but not what the right
  -- behaviour is has still told us something worth having.
  ADD COLUMN IF NOT EXISTS expected_text   text NULL,
  -- Object path inside the private `feedback-screenshots` bucket
  -- (migration 20260930000003), shaped `<user_id>/<uuid>.<ext>`. NOT a URL:
  -- the bucket is private, so a reader signs its own time-limited link.
  ADD COLUMN IF NOT EXISTS screenshot_path text NULL,
  -- The route the student was on. Promoted out of the jsonb for the same
  -- reason as the rest: "the exam page is broken" and "the dashboard is
  -- broken" are different reports, and that is a GROUP BY, not a context blob.
  ADD COLUMN IF NOT EXISTS page            text NULL;

-- ---------------------------------------------------------------------------
-- 2. Backfill the rows filed before the form existed
-- ---------------------------------------------------------------------------
-- Every pre-existing row satisfies user_feedback_text_present, so ->>'text' is
-- a non-empty string for all of them and step 3's NOT NULL cannot fail on data
-- that is already here. The other three keys only exist on rows written by the
-- version of the action that briefly wrote them into the jsonb; COALESCE and
-- NULL cover their absence.

UPDATE public.user_feedback
SET
  problem_text    = feedback_body ->> 'text',
  expected_text   = feedback_body ->> 'expected',
  screenshot_path = feedback_body ->> 'screenshot_path',
  page            = feedback_body ->> 'page',
  feedback_type   = COALESCE(feedback_body ->> 'type', 'bug')
WHERE problem_text IS NULL
  AND feedback_body IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Constraints — the same guarantees the jsonb CHECKs gave, on the columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_feedback
  ALTER COLUMN problem_text SET NOT NULL;

-- feedback_body is no longer required. It is not dropped and not emptied; new
-- rows simply leave it NULL.
ALTER TABLE public.user_feedback
  ALTER COLUMN feedback_body DROP NOT NULL;

DO $$
BEGIN
  -- A closed list, matching the three cards in the form and
  -- lib/validators/qa-reports' ReportType.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_type_valid'
  ) THEN
    ALTER TABLE public.user_feedback
      ADD CONSTRAINT user_feedback_type_valid
      CHECK (feedback_type IN ('bug', 'content', 'design'));
  END IF;

  -- There is a message, and it is not whitespace — the guarantee
  -- user_feedback_text_present used to make about the jsonb, restated about
  -- the column. The 4000-character ceiling matches the textarea's own limit
  -- and the Zod schema in app/(app)/_actions.ts: three places agree on one
  -- number, so a message the box accepted is never rejected by the database.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_problem_text_len'
  ) THEN
    ALTER TABLE public.user_feedback
      ADD CONSTRAINT user_feedback_problem_text_len
      CHECK (char_length(btrim(problem_text)) BETWEEN 1 AND 4000);
  END IF;

  -- Optional, but bounded when present. NULL passes; an empty string does not,
  -- so "not answered" has exactly one representation in this column.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_expected_text_len'
  ) THEN
    ALTER TABLE public.user_feedback
      ADD CONSTRAINT user_feedback_expected_text_len
      CHECK (
        expected_text IS NULL
        OR char_length(btrim(expected_text)) BETWEEN 1 AND 4000
      );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 4. Comments
-- ---------------------------------------------------------------------------
-- No index on feedback_type. This table takes one row per student who chooses
-- to write to us — hundreds, not millions — and idx_user_feedback_created_at
-- already orders the inbox; filtering three values over a table that size is a
-- cheap scan, and an index nobody needs is still an index every INSERT pays
-- for. Add one when the inbox is big enough to feel it.

COMMENT ON COLUMN public.user_feedback.feedback_type
  IS 'Which card the student picked: bug | content | design. Same vocabulary as qa_reports.report_type.';
COMMENT ON COLUMN public.user_feedback.problem_text
  IS '"מה לא עבד?" — the message. Required, 1..4000 chars.';
COMMENT ON COLUMN public.user_feedback.expected_text
  IS '"מה צריך להיות במקום?" — optional, 1..4000 chars when present.';
COMMENT ON COLUMN public.user_feedback.screenshot_path
  IS 'Object path in the private feedback-screenshots bucket, <user_id>/<uuid>.<ext>. Sign a URL to read it.';
COMMENT ON COLUMN public.user_feedback.page
  IS 'Route the student was on when they opened the box. Client-supplied context, capped at 200 chars by the server.';
COMMENT ON COLUMN public.user_feedback.feedback_body
  IS 'DEPRECATED, kept for rows filed before the form had columns: { text, page, submitted_at }. NULL on every row written since migration 20260930000002 — read the columns instead.';
