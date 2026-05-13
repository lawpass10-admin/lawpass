-- Slice 3 / Phase 0 follow-up — bring increment_exam_session_counters to
-- parity with the practice-side RPC (increment_session_counters).
--
-- Previous behaviour (migration 20260515000001): no row matched →
-- silent no-op. PM-confirmed change: raise P0002 instead, so callers
-- learn loudly when they target a missing/foreign-owned/inactive row.
-- This matches the practice sibling, which has raised since
-- Phase 2.7 (migration 20260511000002).
--
-- CREATE OR REPLACE preserves SECURITY DEFINER + search_path + ACL.

CREATE OR REPLACE FUNCTION public.increment_exam_session_counters(
  p_session_id uuid,
  p_was_correct boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.exam_sessions
  SET
    questions_answered = questions_answered + 1,
    questions_correct  = questions_correct + (CASE WHEN p_was_correct THEN 1 ELSE 0 END),
    last_activity_at   = NOW()
  WHERE id = p_session_id
    AND user_id = (SELECT auth.uid());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'exam_session not found or unauthorized: %', p_session_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_exam_session_counters(uuid, boolean) IS
  'Atomically bumps exam_sessions.questions_answered (+1) and questions_correct (conditional +1) for the caller. Raises P0002 when no row matches. Slice 3 Phase 0 follow-up.';
