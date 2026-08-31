-- diuni_answers — one row per sitting of a דין דיוני paper: who sat it,
-- which letters they chose, and what that scored.
--
-- The sibling of mahoti_answers (20260826000001), same shape and same reasons.
-- Read that file for the full rationale; the notes below are the short form.
--
-- WHY A NEW TABLE, AND NOT user_id ON diuni_questions.
-- diuni_questions is the CONTENT: one row per generated paper, the same paper
-- served to every subscriber. A user_id there would mean one paper per student,
-- and the 40 questions would have to be duplicated for each of them. Who
-- answered what is a different fact from what the paper says, and it belongs in
-- its own row — which is also the only shape in which "the same student sat it
-- three times" can be recorded at all.
--
-- NAMING: `diuni_answers`, plural and lower-case, to match open_question_answers
-- and every other table here. Say the word and it is a one-line rename.
--
-- Columns:
--   * answer_id     uuid PK.
--   * user_id       uuid -> profiles(id). The candidate. profiles.id is
--                   auth.users.id, so this is the identity RLS compares
--                   against auth.uid().
--   * question_id   uuid -> diuni_questions. WHICH paper was sat. Without it
--                   there is no per-paper statistic and no attempt-over-attempt
--                   comparison.
--   * answer_body   jsonb NOT NULL. The submission and its marking:
--                     { "given": [ { "number": 1,
--                                    "letter": "א",        -- null = skipped
--                                    "correct_letter": "ב",
--                                    "is_correct": false }, … ],
--                       "correct": 30, "answered": 40, "total": 40 }
--                     The correct letter is SNAPSHOT here, not just referenced.
--                     The loader refreshes a paper's row in place (its uuid5 is
--                     derived from the notebook seed), so a regenerated paper
--                     would otherwise silently re-mark sittings that happened
--                     before it changed. The three counts sit beside the
--                     answers so "30 of 40" can be read without walking the
--                     array — `answered` is separate from `total` because a
--                     paper may be submitted with blanks, and "30 of the 32 I
--                     attempted" is a different claim from "30 of 40".
--   * answer_score  double precision NOT NULL. The headline result: correct
--                   out of total as a PERCENTAGE. 30/40 -> 75. A plain number
--                   rather than a jsonb so averaging, sorting and thresholding
--                   ("sittings above 60%") are ordinary SQL rather than jsonb
--                   extraction; the arithmetic behind it stays in answer_body.
--   * attempts      integer NOT NULL. 1-based sitting number for this (user,
--                   paper), assigned by the trigger below. A student may re-sit
--                   a paper as often as they like.
--   * created_at    timestamptz. When the paper was submitted.
--
-- WHO WRITES THE SCORE. The answer key lives in diuni_questions.questions ->
-- correct_answer, which is admin-only under RLS and is stripped server-side
-- before the paper reaches the browser (see lib/db/mahoti.ts stripAnswers).
-- Marking therefore happens on the server, and the row is inserted with the
-- service-role client. There is deliberately NO INSERT policy for
-- `authenticated` below: a student who could insert their own row could insert
-- their own score, and no CHECK constraint can tell an honest 75 from a
-- dishonest one. Students get SELECT on their own rows and nothing else.

CREATE TABLE IF NOT EXISTS public.diuni_answers (
  answer_id     uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id   uuid              NOT NULL REFERENCES public.diuni_questions(question_id) ON DELETE RESTRICT,
  answer_body   jsonb             NOT NULL,
  answer_score  double precision  NOT NULL,
  attempts      integer           NOT NULL DEFAULT 1,
  created_at    timestamptz       NOT NULL DEFAULT now(),

  -- A percentage is between 0 and 100. The server is what computes it, so this
  -- is not defending against a hostile caller — it is the kind of typo that
  -- otherwise shows up months later as a 7500% success rate on a report.
  CONSTRAINT diuni_answers_score_range
    CHECK (answer_score >= 0 AND answer_score <= 100)
);

-- user_id carries the RLS USING clause, so it needs a B-tree index (Hardening
-- Rule #2). The composite covers that and also serves "my sittings, newest
-- first" without a second index.
CREATE INDEX IF NOT EXISTS idx_diuni_answers_user_created_at
  ON public.diuni_answers (user_id, created_at DESC);

-- Per-paper statistics: "how did everyone do on this paper".
CREATE INDEX IF NOT EXISTS idx_diuni_answers_question
  ON public.diuni_answers (question_id, created_at DESC);

-- "this student's sittings of this paper, latest first" — the read behind both
-- the results screen and the attempt-over-attempt comparison. NOT unique, on
-- purpose: a unique index would turn a numbering collision into a failed
-- submission, which is exactly the block this is meant not to have. The
-- trigger's advisory lock is what keeps the numbers distinct.
CREATE INDEX IF NOT EXISTS idx_diuni_answers_user_question_attempts
  ON public.diuni_answers (user_id, question_id, attempts DESC);

-- ---------------------------------------------------------------------------
-- attempts — assigned by the database, never by the caller.
-- ---------------------------------------------------------------------------
-- Mirrors set_open_question_answer_attempt_number (20260817000003), for the
-- same reasons: a caller that assigns its own number can file "attempt 1"
-- forever and quietly overwrite the history the statistics read.
--
-- SECURITY DEFINER so the MAX() sees the student's whole history for this paper
-- even if a future policy narrows what they may SELECT — a sitting hidden from
-- the reader must still count towards the next number.
--
-- The advisory lock is per (student, paper) and held to the end of the
-- transaction. Two submissions racing (a double-click, two tabs) would
-- otherwise both read the same MAX and both call themselves attempt N. It
-- serialises one student on one paper; it is not a table lock.
--
-- ATTEMPTS ARE NOT CAPPED. No unique constraint on (user_id, question_id) and
-- no ceiling on `attempts`. If a limit is ever wanted it belongs in its own
-- migration, not as a side effect of numbering.
CREATE OR REPLACE FUNCTION public.set_diuni_answer_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.user_id::text || ':' || NEW.question_id::text, 0)
  );

  SELECT COALESCE(MAX(attempts), 0) + 1
    INTO NEW.attempts
    FROM public.diuni_answers
   WHERE user_id = NEW.user_id
     AND question_id = NEW.question_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diuni_answers_attempts
  ON public.diuni_answers;

CREATE TRIGGER trg_diuni_answers_attempts
  BEFORE INSERT ON public.diuni_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_diuni_answer_attempts();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.diuni_answers ENABLE ROW LEVEL SECURITY;

-- A student reads their own sittings and their own scores. There is no student
-- INSERT policy (the score is the server's to write — see the header) and no
-- student UPDATE policy: a submitted paper is what it was.
CREATE POLICY diuni_answers_students_select_own
  ON public.diuni_answers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins read everything, for the per-paper and per-cohort statistics.
CREATE POLICY diuni_answers_admins_select
  ON public.diuni_answers FOR SELECT TO authenticated
  USING (public.is_admin());

-- SELECT only. INSERT/UPDATE are not granted to `authenticated` at all, so the
-- absence of a policy is backed by the absence of the privilege — the
-- service-role client the server uses bypasses both.
GRANT SELECT ON public.diuni_answers TO authenticated;

COMMENT ON TABLE public.diuni_answers
  IS 'One row per sitting of a diuni paper: the letters chosen, how they were marked, and the resulting score. Written server-side with the service role; students may only read their own rows.';
COMMENT ON COLUMN public.diuni_answers.answer_score
  IS 'Percentage correct out of the paper''s total questions (30/40 -> 75). Computed server-side against the answer key.';
COMMENT ON COLUMN public.diuni_answers.attempts
  IS '1-based sitting number for this (user_id, question_id). Assigned by trigger; attempts are not capped.';
