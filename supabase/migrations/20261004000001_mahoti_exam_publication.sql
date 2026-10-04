-- Which generated papers are live, and what each one is called.
--
-- Until now the picker showed "the newest authored row", capped at one by
-- MAHOTI_PICKER_LIMIT in lib/db/mahoti.ts. That made publication a side effect
-- of generation: the moment a run inserted a row it became the paper every
-- candidate was served, whether or not anyone had looked at it. The four empty
-- notebook rows left behind by the 2026-10-01 billing outage are the same
-- problem from the other side — rows that exist but are not content.
--
-- So publication becomes explicit. `exam_status` says whether a paper is live,
-- and `exam_number` is the name candidates see: מבחן מספר 1, מבחן מספר 2. The
-- number is STORED rather than derived from the row's position in a list,
-- because a candidate refers to "מבחן מספר 2" and it has to keep meaning the
-- same paper after another is published, or unpublished, or back-dated.

ALTER TABLE public.mahoti_questions
  ADD COLUMN IF NOT EXISTS exam_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS exam_number integer;

COMMENT ON COLUMN public.mahoti_questions.exam_status IS
  'draft (generated, not offered to anyone) or prod (live in the picker). New rows are draft: publishing is a separate, deliberate step — scripts/mahoti/publish-exam.mjs.';
COMMENT ON COLUMN public.mahoti_questions.exam_number IS
  'The paper''s number in the published series, shown as "מבחן מספר N". Assigned on publication and never reused.';

-- Only the two states exist. A typo in a publish script should fail loudly
-- rather than quietly hide a paper from the picker by naming a state that
-- nothing matches.
ALTER TABLE public.mahoti_questions
  DROP CONSTRAINT IF EXISTS mahoti_questions_exam_status_check;
ALTER TABLE public.mahoti_questions
  ADD CONSTRAINT mahoti_questions_exam_status_check
  CHECK (exam_status IN ('draft', 'prod'));

-- A live paper always has a number, because the number is how it is named on
-- screen. Without this, publishing without numbering would render as "מבחן מספר
-- null" rather than failing where the mistake was made.
ALTER TABLE public.mahoti_questions
  DROP CONSTRAINT IF EXISTS mahoti_questions_prod_needs_number;
ALTER TABLE public.mahoti_questions
  ADD CONSTRAINT mahoti_questions_prod_needs_number
  CHECK (exam_status <> 'prod' OR exam_number IS NOT NULL);

-- A paper one candidate built for themselves (built_for IS NOT NULL) can never
-- be published. Every read in lib/db/mahoti.ts already filters on built_for for
-- exactly this reason; this makes it an invariant of the table rather than a
-- rule four queries have to remember.
ALTER TABLE public.mahoti_questions
  DROP CONSTRAINT IF EXISTS mahoti_questions_custom_stays_draft;
ALTER TABLE public.mahoti_questions
  ADD CONSTRAINT mahoti_questions_custom_stays_draft
  CHECK (built_for IS NULL OR exam_status = 'draft');

-- Two papers cannot share a number. Partial, so that unpublishing a paper (back
-- to draft) leaves its number on the row — a paper that returns to the picker
-- comes back as the number candidates already knew it by, instead of being
-- renumbered to the end of the series.
DROP INDEX IF EXISTS mahoti_questions_exam_number_key;
CREATE UNIQUE INDEX mahoti_questions_exam_number_key
  ON public.mahoti_questions (exam_number)
  WHERE exam_status = 'prod';

-- The picker's read: live papers, highest number first.
DROP INDEX IF EXISTS mahoti_questions_prod_idx;
CREATE INDEX mahoti_questions_prod_idx
  ON public.mahoti_questions (exam_number DESC)
  WHERE exam_status = 'prod';

-- ---------------------------------------------------------------------------
-- Backfill: the two most recent authored papers go live as 1 and 2.
--
-- Numbered by age, so מבחן מספר 1 is the earlier paper — the series reads in
-- the order the papers were made, not in the order the picker lists them.
-- Written as a query over "the newest two" rather than as two hard-coded ids so
-- that it means the same thing on an environment whose rows differ.
-- ---------------------------------------------------------------------------
WITH newest AS (
  SELECT question_id,
         row_number() OVER (ORDER BY created_at ASC) AS n
    FROM (
      SELECT question_id, created_at
        FROM public.mahoti_questions
       WHERE built_for IS NULL
         AND questions IS NOT NULL
         AND question_notebook IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 2
    ) AS recent
)
UPDATE public.mahoti_questions AS m
   SET exam_status = 'prod',
       exam_number = newest.n
  FROM newest
 WHERE m.question_id = newest.question_id
   -- Idempotent: a re-run must not renumber papers that are already live.
   AND m.exam_status = 'draft';
