-- open_question_answers — number each submission per (student, question).
--
-- A student may sit the same מטלת כתיבה more than once, and the second sitting
-- is the interesting one: "did the grade go up" is the whole point of letting
-- them write it again. Until now every row looked alike and only created_at
-- separated them, which made "attempt 2" something every reader had to
-- re-derive by sorting.
--
-- THIS MIGRATION DOES NOT LIMIT ATTEMPTS. There is deliberately NO unique
-- constraint on (user_id, open_question_id) and no cap on attempt_number: the
-- student can file the same task as many times as they like, and each filing is
-- simply the next number. If a limit is ever wanted it belongs here as its own
-- migration, not as a side effect of numbering.
--
-- The number is assigned by a trigger, not by the API. The insert policy checks
-- user_id and score; it says nothing about attempt_number, so a hand-rolled
-- request could otherwise file "attempt 1" forever and quietly overwrite the
-- history the statistics will read. The trigger overrides whatever arrives.

ALTER TABLE public.open_question_answers
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;

-- Existing rows: number them in submission order within each (student,
-- question) pair. answer_id breaks a created_at tie so the result is stable if
-- this file is ever re-applied.
WITH numbered AS (
  SELECT
    answer_id,
    row_number() OVER (
      PARTITION BY user_id, open_question_id
      ORDER BY created_at, answer_id
    ) AS n
  FROM public.open_question_answers
)
UPDATE public.open_question_answers AS a
   SET attempt_number = numbered.n
  FROM numbered
 WHERE numbered.answer_id = a.answer_id
   AND a.attempt_number IS DISTINCT FROM numbered.n;

-- SECURITY DEFINER so the MAX() sees the student's whole history for this
-- question even if a future policy narrows what they can SELECT — an attempt
-- hidden from the reader must still count towards the next number.
--
-- The advisory lock is per (student, question) and held to the end of the
-- transaction. Two submissions racing (double-click, two tabs) would otherwise
-- both read the same MAX and both call themselves attempt N. It serialises only
-- that one student on that one question; it is not a table lock.
CREATE OR REPLACE FUNCTION public.set_open_question_answer_attempt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.user_id::text || ':' || NEW.open_question_id::text, 0)
  );

  SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO NEW.attempt_number
    FROM public.open_question_answers
   WHERE user_id = NEW.user_id
     AND open_question_id = NEW.open_question_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_question_answers_attempt_number
  ON public.open_question_answers;

CREATE TRIGGER trg_open_question_answers_attempt_number
  BEFORE INSERT ON public.open_question_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_open_question_answer_attempt_number();

-- "this student's attempts at this question, latest first" — the read behind
-- both the answer screen and the attempt-over-attempt comparison. NOT unique,
-- on purpose: a unique index here would turn any numbering collision into a
-- failed submission, i.e. into exactly the block this feature is meant not to
-- have. The trigger's lock is what keeps the numbers distinct.
CREATE INDEX IF NOT EXISTS idx_open_question_answers_user_question_attempt
  ON public.open_question_answers (user_id, open_question_id, attempt_number DESC);

COMMENT ON COLUMN public.open_question_answers.attempt_number
  IS '1-based sitting number for this (user_id, open_question_id). Assigned by trigger; attempts are not capped.';
