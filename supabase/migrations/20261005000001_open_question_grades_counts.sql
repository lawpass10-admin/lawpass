-- open_question_grades_counts — how many times a student has been MARKED on a
-- writing task, so the same task cannot be graded over and over at our expense.
--
-- ── Why a table and not count(*) over the answers ──────────────────────────
-- The count is derivable: `open_question_answers` already has user_id,
-- open_question_id and grading_status, so the quota could be a count(*) each
-- time. A stored counter is better here for two reasons that both matter at
-- 5K MAU with tens of millions of attempt rows:
--
--   * the check runs on the submit path, before a student's answer is stored,
--     so it must be an index lookup and not a scan of someone's answer history;
--   * the question "has this already been paid for" then has ONE answer that
--     cannot drift with a later change to what grading_status means. A row
--     re-queued by hand, or a status renamed, silently rewrites history for a
--     count(*); it cannot touch a counter.
--
-- ── What counts as one grade ───────────────────────────────────────────────
-- A grading that FINISHED AND WROTE A SCORE. Deliberately not "a run that was
-- started": a model timeout or a provider outage must not burn a student's
-- only grade and leave them with nothing to show for a task they wrote. That
-- is also what keeps "בדוק שוב" honest — a failed marking is retryable because
-- it never consumed anything.
--
-- ── Where the LIMIT lives, and why it is not in here ───────────────────────
-- The table stores the count. The ALLOWANCE is OPEN_QUESTION_MAX_GRADES in the
-- environment, read by lawpass_server/config/env.js. A CHECK constraint or a
-- hard-coded cap in a function here would mean a migration every time the
-- number is tuned, and the number is explicitly meant to be tuned.
--
-- ── NAMING ─────────────────────────────────────────────────────────────────
-- The request listed `grade_id`. This is `grade_count_id`, because a row here
-- is not a grade — it is one counter per (student, question), and `grade_id`
-- would read as a foreign key to a grade that does not exist. `last_answer_id`
-- carries the pointer that `grade_id` was probably reaching for. Say the word
-- and it is a one-line rename.

CREATE TABLE IF NOT EXISTS public.open_question_grades_counts (
  grade_count_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  open_question_id  uuid         NOT NULL REFERENCES public.open_questions(open_question_id) ON DELETE CASCADE,

  -- How many completed markings this student has had on this task.
  no_of_grades      integer      NOT NULL DEFAULT 0 CHECK (no_of_grades >= 0),

  -- The submission that produced the most recent grade. Nullable and ON DELETE
  -- SET NULL: an answer row can go, and the fact that a grade was spent must
  -- not go with it — otherwise deleting an answer silently refunds the quota.
  last_answer_id    uuid         NULL REFERENCES public.open_question_answers(answer_id) ON DELETE SET NULL,

  created_at        timestamptz  NOT NULL DEFAULT now(),
  -- The "time stamp" from the request: when a grade was last counted here.
  updated_at        timestamptz  NOT NULL DEFAULT now(),

  -- One counter per student per task. This is the load-bearing constraint —
  -- it is what the atomic increment below conflicts on, and without it two
  -- concurrent gradings would each insert their own row and the quota would
  -- never be reached.
  CONSTRAINT open_question_grades_counts_user_question_key
    UNIQUE (user_id, open_question_id)
);

-- user_id appears in the RLS USING clause below, so it needs a B-tree index
-- (Hardening Rule #2). The UNIQUE constraint above already provides a
-- (user_id, open_question_id) index whose leading column is user_id, which
-- serves both the policy and the per-student listing — a second index on
-- user_id alone would be redundant.

-- Per-question reporting: "how many markings has this task consumed overall".
CREATE INDEX IF NOT EXISTS idx_open_question_grades_counts_question
  ON public.open_question_grades_counts (open_question_id);

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Without this, every student who has already been graded starts again from
-- zero the moment the limit goes live — which is the opposite of the point.
-- Counted from the answers that actually carry a score, which is the same
-- definition the increment below uses.
INSERT INTO public.open_question_grades_counts
  (user_id, open_question_id, no_of_grades, last_answer_id, created_at, updated_at)
SELECT
  a.user_id,
  a.open_question_id,
  count(*)                                              AS no_of_grades,
  (array_agg(a.answer_id ORDER BY a.graded_at DESC NULLS LAST))[1] AS last_answer_id,
  min(a.created_at)                                     AS created_at,
  max(COALESCE(a.graded_at, a.created_at))              AS updated_at
FROM public.open_question_answers a
WHERE a.grading_status = 'graded'
GROUP BY a.user_id, a.open_question_id
ON CONFLICT (user_id, open_question_id) DO NOTHING;

-- ── The one write path ─────────────────────────────────────────────────────
-- An increment has to be a single statement. Read-then-write from the server
-- is two round trips, and two gradings finishing together would both read the
-- same number and both write it back plus one — losing a grade, in the
-- direction that costs us money rather than the student.
--
-- SECURITY DEFINER with EXECUTE revoked from PUBLIC: the grader runs with the
-- service role, and no student role has any business reaching this. A student
-- who could call it could inflate their own counter (harmless) — but the same
-- surface is what a decrement would hang off later, so it is closed now.
CREATE OR REPLACE FUNCTION public.record_open_question_grade(
  p_user_id          uuid,
  p_open_question_id uuid,
  p_answer_id        uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Aliased as `c` so the DO UPDATE can name the EXISTING row unambiguously.
  -- Without the alias the only way to refer to it is the bare table name, and
  -- the schema-qualified form is not accepted there.
  INSERT INTO public.open_question_grades_counts AS c
    (user_id, open_question_id, no_of_grades, last_answer_id)
  VALUES
    (p_user_id, p_open_question_id, 1, p_answer_id)
  ON CONFLICT (user_id, open_question_id) DO UPDATE
    SET no_of_grades   = c.no_of_grades + 1,
        last_answer_id = COALESCE(EXCLUDED.last_answer_id, c.last_answer_id),
        updated_at     = now()
  RETURNING c.no_of_grades INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_open_question_grade(uuid, uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_open_question_grade(uuid, uuid, uuid) TO service_role;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.open_question_grades_counts ENABLE ROW LEVEL SECURITY;

-- A student may READ their own counter — that is what lets the UI say how many
-- markings are left before they start writing. There is deliberately no
-- INSERT, UPDATE or DELETE policy for students: a quota a student can write is
-- not a quota. Every write goes through the function above, under the service
-- role.
-- DROP ... IF EXISTS before each CREATE: CREATE POLICY is not idempotent, and
-- a migration that cannot be re-run is one you cannot re-apply after a partial
-- failure without editing it first.
DROP POLICY IF EXISTS open_question_grades_counts_students_select_own
  ON public.open_question_grades_counts;
CREATE POLICY open_question_grades_counts_students_select_own
  ON public.open_question_grades_counts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS open_question_grades_counts_admins_select
  ON public.open_question_grades_counts;
CREATE POLICY open_question_grades_counts_admins_select
  ON public.open_question_grades_counts FOR SELECT TO authenticated
  USING (public.is_admin());

-- SELECT only. The absence of INSERT/UPDATE/DELETE grants is the second lock
-- on top of the missing policies: even a future policy added by mistake would
-- have no table privilege to act through.
GRANT SELECT ON public.open_question_grades_counts TO authenticated;

COMMENT ON TABLE public.open_question_grades_counts IS
  'One row per (student, writing task): how many completed markings it has consumed. '
  'The allowance itself is OPEN_QUESTION_MAX_GRADES in the server environment, not stored here. '
  'Written only by public.record_open_question_grade(), from the grader under the service role.';

COMMENT ON COLUMN public.open_question_grades_counts.no_of_grades IS
  'Completed markings that wrote a score. A failed grading is not counted, so "בדוק שוב" costs nothing.';
