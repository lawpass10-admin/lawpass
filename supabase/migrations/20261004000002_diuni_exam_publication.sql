-- Which generated דין דיוני papers are live, and what each one is called.
--
-- The twin of 20261004000001 on `mahoti_questions`, for the same reasons and
-- with the same shape: `exam_status` says whether a paper is offered to
-- candidates, `exam_number` is the name they see (מבחן מספר 1, מבחן מספר 2),
-- and the number is stored rather than derived from a row's position in a list
-- so that it keeps meaning the same paper.
--
-- Until now the picker showed "the newest authored row", capped at one by
-- DIUNI_PICKER_LIMIT. That made publication a side effect of generation: a run
-- that inserted a row put that paper in front of every candidate, reviewed or
-- not.
--
-- There is no `question_notebook` here — a diuni paper is grounded in
-- `verdict_list` rows rather than in a legislation notebook it carries — so the
-- backfill below checks `questions` alone.

ALTER TABLE public.diuni_questions
  ADD COLUMN IF NOT EXISTS exam_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS exam_number integer;

COMMENT ON COLUMN public.diuni_questions.exam_status IS
  'draft (generated, not offered to anyone) or prod (live in the picker). New rows are draft: publishing is a separate, deliberate step — scripts/diuni/publish-exam.mjs.';
COMMENT ON COLUMN public.diuni_questions.exam_number IS
  'The paper''s number in the published series, shown as "מבחן מספר N". Assigned on publication and never reused.';

-- Only the two states exist, so a typo fails loudly instead of quietly hiding a
-- paper from the picker by naming a state nothing matches.
ALTER TABLE public.diuni_questions
  DROP CONSTRAINT IF EXISTS diuni_questions_exam_status_check;
ALTER TABLE public.diuni_questions
  ADD CONSTRAINT diuni_questions_exam_status_check
  CHECK (exam_status IN ('draft', 'prod'));

-- A live paper always has a number, because the number is how it is named on
-- screen — otherwise publishing without numbering renders "מבחן מספר null".
ALTER TABLE public.diuni_questions
  DROP CONSTRAINT IF EXISTS diuni_questions_prod_needs_number;
ALTER TABLE public.diuni_questions
  ADD CONSTRAINT diuni_questions_prod_needs_number
  CHECK (exam_status <> 'prod' OR exam_number IS NOT NULL);

-- A paper one candidate built for themselves can never be published. Every read
-- in lib/db/diuni.ts already filters on built_for for exactly this reason; this
-- makes it an invariant of the table rather than a rule four queries have to
-- remember.
ALTER TABLE public.diuni_questions
  DROP CONSTRAINT IF EXISTS diuni_questions_custom_stays_draft;
ALTER TABLE public.diuni_questions
  ADD CONSTRAINT diuni_questions_custom_stays_draft
  CHECK (built_for IS NULL OR exam_status = 'draft');

-- Two papers cannot share a number. Partial, so unpublishing leaves the number
-- on the row: a paper pulled for a fix returns as the number candidates already
-- knew it by, instead of being renumbered to the end of the series.
DROP INDEX IF EXISTS diuni_questions_exam_number_key;
CREATE UNIQUE INDEX diuni_questions_exam_number_key
  ON public.diuni_questions (exam_number)
  WHERE exam_status = 'prod';

-- The picker's read: live papers in series order.
DROP INDEX IF EXISTS diuni_questions_prod_idx;
CREATE INDEX diuni_questions_prod_idx
  ON public.diuni_questions (exam_number)
  WHERE exam_status = 'prod';

-- ---------------------------------------------------------------------------
-- Backfill: the two most recent authored papers go live as 1 and 2.
--
-- The table currently holds ONE authored paper (the others were built by
-- candidates for themselves), so this publishes that one as מבחן מספר 1 and the
-- LIMIT 2 simply has nothing more to take. Written as "the newest two" rather
-- than as hard-coded ids so it means the same thing on an environment whose
-- rows differ. Numbered by age, so מבחן מספר 1 is the earliest.
-- ---------------------------------------------------------------------------
WITH newest AS (
  SELECT question_id,
         row_number() OVER (ORDER BY created_at ASC) AS n
    FROM (
      SELECT question_id, created_at
        FROM public.diuni_questions
       WHERE built_for IS NULL
         AND questions IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 2
    ) AS recent
)
UPDATE public.diuni_questions AS d
   SET exam_status = 'prod',
       exam_number = newest.n
  FROM newest
 WHERE d.question_id = newest.question_id
   -- Idempotent: a re-run must not renumber papers that are already live.
   AND d.exam_status = 'draft';
