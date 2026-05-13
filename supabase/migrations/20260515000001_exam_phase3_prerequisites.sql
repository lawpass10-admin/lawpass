-- Slice 3 / Phase 0 — Exam-side prerequisites
--
-- Mirrors the practice-side prerequisites added in Phase 2.7 (commit on
-- 20260511000002_practice_phase3_prerequisites.sql) but for exam mode:
--
--   1. Idempotency partial unique indexes on `attempts` keyed by
--      `exam_session_id`. Make `submitExamAttempt` and backward-nav
--      overwrites safe to retry via INSERT ... ON CONFLICT DO UPDATE.
--   2. `increment_exam_session_counters` SECURITY DEFINER RPC — atomic
--      +1 on `exam_sessions.questions_answered` and conditional +1 on
--      `questions_correct`. Sibling of `increment_session_counters`
--      (which is hard-coded to `practice_sessions`).
--
-- Hardening Rule #6 applied: SECURITY DEFINER + SET search_path +
-- REVOKE FROM PUBLIC, anon + GRANT TO authenticated.

-- ============================================================================
-- 1. Idempotency partial unique indexes on attempts (exam side)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS attempts_unique_per_exam_source
  ON public.attempts (exam_session_id, source_question_id)
  WHERE question_type = 'source' AND exam_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attempts_unique_per_exam_angle
  ON public.attempts (exam_session_id, angle_question_id)
  WHERE question_type = 'angle' AND exam_session_id IS NOT NULL;

COMMENT ON INDEX public.attempts_unique_per_exam_source IS
  'Idempotency guard: one source-question attempt per exam session. Slice 3 Phase 0.';

COMMENT ON INDEX public.attempts_unique_per_exam_angle IS
  'Idempotency guard: one angle-question attempt per exam session. Slice 3 Phase 0.';

-- ============================================================================
-- 2. increment_exam_session_counters RPC
-- ============================================================================
-- Atomic counter update keyed on (session_id, caller). UPDATE matches the
-- row only when user_id = auth.uid(); no row matched = no-op (no error).
-- Practice's sibling RPC raises on a missing/foreign-owned/inactive row;
-- the exam side is more permissive (no raise) because backward nav can
-- legitimately re-fire the counter call on a row whose status has since
-- moved — early-completion submit, for example — and we'd rather no-op
-- than poison the caller's transaction.
CREATE OR REPLACE FUNCTION public.increment_exam_session_counters(
  p_session_id uuid,
  p_was_correct boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.exam_sessions
  SET
    questions_answered = questions_answered + 1,
    questions_correct  = questions_correct + (CASE WHEN p_was_correct THEN 1 ELSE 0 END),
    last_activity_at   = NOW()
  WHERE id = p_session_id
    AND user_id = (SELECT auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_exam_session_counters(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.increment_exam_session_counters(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.increment_exam_session_counters(uuid, boolean) IS
  'Atomically bumps exam_sessions.questions_answered (+1) and questions_correct (conditional +1) for the caller. Slice 3 Phase 0.';
