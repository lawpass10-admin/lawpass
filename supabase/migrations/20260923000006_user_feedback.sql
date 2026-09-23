-- user_feedback — what a student tells us, in their own words.
--
-- One row per submission from the "שלחו לנו משוב" button in the sidebar. Not a
-- support ticket system and not a thread: there is no status, no assignee and
-- no reply. Somebody typed something and pressed send, and that is worth
-- keeping exactly as they wrote it.
--
-- Columns:
--   * feedback_id   uuid PK.
--   * user_id       uuid -> profiles(id). Who wrote it. profiles.id is
--                   auth.users.id, so this is the identity RLS compares against
--                   auth.uid(). ON DELETE CASCADE: a deleted account takes its
--                   feedback with it, because the text is theirs and may name
--                   them in it.
--   * feedback_body jsonb NOT NULL. The message and whatever context we can
--                   collect for free:
--                     { "text": "הכפתור של דין דיוני לא נפתח לי",
--                       "page": "/diuni",              -- where they were
--                       "submitted_at": "2026-09-23T…" }
--                   WHY JSONB FOR FREE TEXT. The text itself is one string and
--                   would fit a text column. What does not fit is everything we
--                   will want beside it later — a rating, a category, the app
--                   version, a screenshot reference — and each of those as its
--                   own column is a migration plus a deploy before a single
--                   student can be asked. The message lives under a fixed
--                   `text` key so the reading is stable whatever else joins it.
--   * created_at    timestamptz. When it was sent.
--
-- WHY THE STUDENT MAY INSERT THIS ONE. Elsewhere (diuni_answers,
-- mahoti_answers) students get SELECT and nothing else, because those rows
-- carry a SCORE and a row a student can write is a score a student can choose.
-- Feedback has nothing to forge: the only thing in it is what they wanted to
-- say. So INSERT is granted, with a WITH CHECK that pins user_id to the caller
-- — a student can file feedback as themselves and not as anybody else.
--
-- NO SUBSCRIPTION GATE, deliberately. question_notes and the rest require
-- has_active_subscription(); this must not. A student whose subscription just
-- lapsed, or who could not pay, is exactly the person with something to tell
-- us, and a feedback box that refuses them is a feedback box that only collects
-- good news.
--
-- NOT EDITABLE, NOT DELETABLE by the author: no UPDATE or DELETE policy and no
-- such privilege. Sent is sent. If "undo send" is ever wanted it should be a
-- deliberate feature with its own migration, not a side effect of a broad grant.

CREATE TABLE IF NOT EXISTS public.user_feedback (
  feedback_id   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback_body jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- An object, not a bare string or an array: every reader below assumes it can
  -- ask for a key, and `"just a string"::jsonb` is valid jsonb that would make
  -- feedback_body->>'text' silently NULL.
  CONSTRAINT user_feedback_body_is_object
    CHECK (jsonb_typeof(feedback_body) = 'object'),

  -- There is a message, and it is not whitespace. The server validates this
  -- too; the constraint is what makes it true of the TABLE rather than true of
  -- one code path — a script, a backfill or a future endpoint cannot file an
  -- empty row.
  --
  -- The 4000-character ceiling matches the textarea's own limit. It is not a
  -- security boundary (jsonb would take megabytes happily); it is the line
  -- between a long message and a paste of an entire document.
  CONSTRAINT user_feedback_text_present
    CHECK (
      feedback_body ? 'text'
      AND jsonb_typeof(feedback_body -> 'text') = 'string'
      AND char_length(btrim(feedback_body ->> 'text')) BETWEEN 1 AND 4000
    )
);

-- user_id carries the RLS USING/WITH CHECK clause, so it needs a B-tree index
-- (Hardening Rule #2). The composite covers that and also answers "everything
-- this student has told us, newest first" without a second index.
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_created_at
  ON public.user_feedback (user_id, created_at DESC);

-- The way it will actually be read day to day: the newest feedback across all
-- students, which is an admin reading an inbox.
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
  ON public.user_feedback (created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- File feedback as yourself. The WITH CHECK is the whole of the authorization:
-- without it, `authenticated` INSERT would let any signed-in user write a row
-- attributed to another student.
CREATE POLICY user_feedback_students_insert_own
  ON public.user_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Read back your own. Nothing in the product shows this yet; it is here so that
-- "what have I sent you" is answerable without a policy change, and so a
-- student's own words are never hidden from them.
CREATE POLICY user_feedback_students_select_own
  ON public.user_feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins read everything — this table exists to be read by us.
CREATE POLICY user_feedback_admins_select
  ON public.user_feedback FOR SELECT TO authenticated
  USING (public.is_admin());

-- SELECT and INSERT only. UPDATE and DELETE are not granted to `authenticated`
-- at all, so the absence of a policy is backed by the absence of the privilege;
-- the service-role client bypasses both.
GRANT SELECT, INSERT ON public.user_feedback TO authenticated;

COMMENT ON TABLE public.user_feedback
  IS 'Free-text feedback from students, one row per submission. Written by the student themselves under RLS; readable by the author and by admins.';
COMMENT ON COLUMN public.user_feedback.feedback_body
  IS 'jsonb: { text (required, 1..4000 chars), page, submitted_at, … }. The message lives under "text"; other keys are context and may grow without a migration.';
