-- open_question_answers — track the grading of a submission, not just its result.
--
-- `score IS NULL` was enough while grading was a someday: null meant ungraded.
-- It stops being enough the moment a student is watching a spinner, because
-- "not marked yet", "being marked right now" and "marking failed" are three
-- different screens and score is null in all three.
--
-- Columns:
--   * grading_status  pending -> grading -> graded | failed. The submit path
--                     inserts `pending`; the grader claims the row by moving it
--                     to `grading`, which is also what stops two workers marking
--                     the same answer twice.
--   * graded_at       when the score was written.
--   * grading_error   why it failed, for the retry path and for support. Never
--                     shown to the student — a model error message is not
--                     feedback on their answer.
--   * graded_with_rubric_id
--                     WHICH rubric produced this score. Rubrics are versioned and
--                     a revision retires its predecessor, so without this a grade
--                     written last month cannot be explained to the student who
--                     asks about it today.

ALTER TABLE public.open_question_answers
  ADD COLUMN IF NOT EXISTS grading_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS graded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS grading_error text NULL,
  ADD COLUMN IF NOT EXISTS graded_with_rubric_id uuid NULL
    REFERENCES public.open_question_rubrics(rubric_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_question_answers_grading_status_check'
  ) THEN
    ALTER TABLE public.open_question_answers
      ADD CONSTRAINT open_question_answers_grading_status_check
      CHECK (grading_status IN ('pending', 'grading', 'graded', 'failed'));
  END IF;
END $$;

-- Anything already carrying a score was graded by hand and is finished; the
-- default would otherwise queue it for a second, contradictory marking.
UPDATE public.open_question_answers
   SET grading_status = 'graded', graded_at = created_at
 WHERE score IS NOT NULL AND grading_status = 'pending';

-- Submissions filed before grading existed keep the default `pending`, so the
-- worker picks them up and marks them like any other. Deliberate: they are real
-- answers to real questions, and there is no reason to leave a student without a
-- grade because of when they happened to submit. Worth knowing before running
-- this on a table with a large backlog — every one of those rows becomes a
-- billable model call the first time the worker runs.

-- The work queue: oldest unfinished submission first. Partial, so it stays the
-- size of the backlog rather than the size of the table.
CREATE INDEX IF NOT EXISTS idx_open_question_answers_grading_queue
  ON public.open_question_answers (created_at)
  WHERE grading_status IN ('pending', 'grading');

-- The insert policy already refused a student-supplied score. Same reasoning for
-- the status: a submission that arrived claiming to be `graded` would sit in the
-- table looking finished and never be marked. RLS is the boundary; the API
-- setting the field correctly is not something to depend on.
DROP POLICY IF EXISTS open_question_answers_students_insert_own ON public.open_question_answers;
CREATE POLICY open_question_answers_students_insert_own
  ON public.open_question_answers FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND score IS NULL
    AND grading_status = 'pending'
  );

COMMENT ON COLUMN public.open_question_answers.grading_status
  IS 'pending = queued. grading = claimed by a worker. graded = score written. failed = give up, see grading_error.';
