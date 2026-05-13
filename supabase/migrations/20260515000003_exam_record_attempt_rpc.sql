-- Slice 3 / Phase 3 hotfix — record_exam_attempt RPC
--
-- Problem: supabase-js's `.upsert(..., { onConflict: 'cols' })` emits
-- `INSERT … ON CONFLICT (cols) DO UPDATE`, which Postgres rejects with
-- 42P10 when the matching unique index is PARTIAL — Postgres requires
-- `ON CONFLICT (cols) WHERE <predicate>` to bind to a partial index.
-- The two indexes added in 20260515000001_exam_phase3_prerequisites.sql
-- are partial (`WHERE question_type=... AND exam_session_id IS NOT NULL`),
-- so every submitExamAttempt / skipExamQuestion call was failing in
-- production with "no unique or exclusion constraint matching the
-- ON CONFLICT specification".
--
-- Fix: a SECURITY DEFINER RPC that issues the UPSERT in raw SQL with
-- the matching WHERE predicate. Phase 3's two callers switch from
-- `.upsert(...)` to `.rpc('record_exam_attempt', ...)`.
--
-- Hardening Rule #6 applied: SECURITY DEFINER + SET search_path
-- (public + pg_temp) + REVOKE FROM PUBLIC, anon + GRANT TO authenticated.

CREATE OR REPLACE FUNCTION public.record_exam_attempt(
  p_session_id          uuid,
  p_question_type       text,    -- 'source' or 'angle'
  p_source_question_id  uuid,    -- non-null if source, else null
  p_angle_question_id   uuid,    -- non-null if angle, else null
  p_selected_choice_id  uuid,    -- null on skip
  p_selected_letter     text,    -- null on skip
  p_is_correct          boolean, -- null on skip
  p_was_skipped         boolean,
  p_duration_seconds    integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Confirm the session belongs to the caller. (Outer code also
  -- validates window_token; this is the SECURITY DEFINER fallback.)
  IF NOT EXISTS (
    SELECT 1 FROM public.exam_sessions
    WHERE id = p_session_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'exam_session not found or unauthorized: %', p_session_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_question_type = 'source' THEN
    INSERT INTO public.attempts (
      user_id, question_type, source_question_id, angle_question_id,
      selected_choice_id, selected_letter, is_correct,
      mode, exam_session_id, duration_seconds, was_skipped
    )
    VALUES (
      v_user_id, 'source', p_source_question_id, NULL,
      p_selected_choice_id, p_selected_letter, p_is_correct,
      'exam', p_session_id, p_duration_seconds, p_was_skipped
    )
    ON CONFLICT (exam_session_id, source_question_id)
      WHERE question_type = 'source' AND exam_session_id IS NOT NULL
    DO UPDATE SET
      selected_choice_id = EXCLUDED.selected_choice_id,
      selected_letter    = EXCLUDED.selected_letter,
      is_correct         = EXCLUDED.is_correct,
      was_skipped        = EXCLUDED.was_skipped,
      duration_seconds   = EXCLUDED.duration_seconds,
      attempted_at       = NOW();

  ELSIF p_question_type = 'angle' THEN
    INSERT INTO public.attempts (
      user_id, question_type, source_question_id, angle_question_id,
      selected_choice_id, selected_letter, is_correct,
      mode, exam_session_id, duration_seconds, was_skipped
    )
    VALUES (
      v_user_id, 'angle', NULL, p_angle_question_id,
      p_selected_choice_id, p_selected_letter, p_is_correct,
      'exam', p_session_id, p_duration_seconds, p_was_skipped
    )
    ON CONFLICT (exam_session_id, angle_question_id)
      WHERE question_type = 'angle' AND exam_session_id IS NOT NULL
    DO UPDATE SET
      selected_choice_id = EXCLUDED.selected_choice_id,
      selected_letter    = EXCLUDED.selected_letter,
      is_correct         = EXCLUDED.is_correct,
      was_skipped        = EXCLUDED.was_skipped,
      duration_seconds   = EXCLUDED.duration_seconds,
      attempted_at       = NOW();

  ELSE
    RAISE EXCEPTION 'invalid question_type: %', p_question_type
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_exam_attempt(uuid, text, uuid, uuid, uuid, text, boolean, boolean, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_exam_attempt(uuid, text, uuid, uuid, uuid, text, boolean, boolean, integer) TO authenticated;

COMMENT ON FUNCTION public.record_exam_attempt(uuid, text, uuid, uuid, uuid, text, boolean, boolean, integer) IS
  'UPSERT exam-mode attempt with explicit ON CONFLICT (...) WHERE <predicate> to bind to the Phase 0 partial unique indexes. supabase-js .upsert() cannot emit the predicate; clients must call this via .rpc(). Slice 3 Phase 3 hotfix.';
