-- Slice 2 / Phase 2.7 — Practice Phase 3 Prerequisites
--
-- Adds:
--   1. record_mistake() SECURITY DEFINER RPC — handles ON CONFLICT against partial unique indexes
--      (which Supabase JS .upsert() cannot target). Increments mistakes_count, resets
--      manually_removed to false, updates last_mistake_at.
--   2. record_bookmark_toggle() SECURITY DEFINER RPC — toggles bookmark existence atomically.
--      Returns true if now bookmarked, false if removed.
--   3. increment_session_counters() SECURITY DEFINER RPC — atomic +=1 on practice_sessions
--      counters to prevent two-tab races. Validates ownership and active status.
--   4. Two partial unique indexes on attempts table for idempotency on retry/double-submit.
--
-- All functions follow Hardening Rule #6: SECURITY DEFINER + SET search_path + REVOKE/GRANT ACL.
-- All functions use (SELECT auth.uid()) per RLS optimization convention.

-- ============================================================================
-- 1. record_mistake — handles partial-index ON CONFLICT for mistakes table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_mistake(
  p_question_type text,
  p_source_question_group_id uuid DEFAULT NULL,
  p_angle_question_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_question_type NOT IN ('source', 'angle') THEN
    RAISE EXCEPTION 'invalid question_type: %', p_question_type USING ERRCODE = '22023';
  END IF;

  IF p_question_type = 'source' THEN
    IF p_source_question_group_id IS NULL THEN
      RAISE EXCEPTION 'source_question_group_id required for source mistakes' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.mistakes (
      user_id, question_type, source_question_group_id,
      mistakes_count, last_mistake_at, manually_removed
    )
    VALUES (v_user_id, 'source', p_source_question_group_id, 1, NOW(), false)
    ON CONFLICT (user_id, source_question_group_id) WHERE question_type = 'source'
    DO UPDATE SET
      mistakes_count = mistakes.mistakes_count + 1,
      last_mistake_at = NOW(),
      manually_removed = false;
  ELSE
    IF p_angle_question_id IS NULL THEN
      RAISE EXCEPTION 'angle_question_id required for angle mistakes' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.mistakes (
      user_id, question_type, angle_question_id,
      mistakes_count, last_mistake_at, manually_removed
    )
    VALUES (v_user_id, 'angle', p_angle_question_id, 1, NOW(), false)
    ON CONFLICT (user_id, angle_question_id) WHERE question_type = 'angle'
    DO UPDATE SET
      mistakes_count = mistakes.mistakes_count + 1,
      last_mistake_at = NOW(),
      manually_removed = false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_mistake(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_mistake(text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_mistake(text, uuid, uuid) IS
  'Records a mistake for the current user. Idempotent: increments count on duplicate. Resets manually_removed=false if previously removed (re-surfaces). Phase 2.7.';

-- ============================================================================
-- 2. record_bookmark_toggle — toggle bookmark existence atomically
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_bookmark_toggle(
  p_question_type text,
  p_source_question_group_id uuid DEFAULT NULL,
  p_angle_question_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_existing_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_question_type NOT IN ('source', 'angle') THEN
    RAISE EXCEPTION 'invalid question_type: %', p_question_type USING ERRCODE = '22023';
  END IF;

  IF p_question_type = 'source' THEN
    IF p_source_question_group_id IS NULL THEN
      RAISE EXCEPTION 'source_question_group_id required for source bookmark' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_existing_id FROM public.bookmarks
    WHERE user_id = v_user_id
      AND question_type = 'source'
      AND source_question_group_id = p_source_question_group_id;
    IF v_existing_id IS NOT NULL THEN
      DELETE FROM public.bookmarks WHERE id = v_existing_id;
      RETURN false;
    ELSE
      INSERT INTO public.bookmarks (user_id, question_type, source_question_group_id)
      VALUES (v_user_id, 'source', p_source_question_group_id);
      RETURN true;
    END IF;
  ELSE
    IF p_angle_question_id IS NULL THEN
      RAISE EXCEPTION 'angle_question_id required for angle bookmark' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_existing_id FROM public.bookmarks
    WHERE user_id = v_user_id
      AND question_type = 'angle'
      AND angle_question_id = p_angle_question_id;
    IF v_existing_id IS NOT NULL THEN
      DELETE FROM public.bookmarks WHERE id = v_existing_id;
      RETURN false;
    ELSE
      INSERT INTO public.bookmarks (user_id, question_type, angle_question_id)
      VALUES (v_user_id, 'angle', p_angle_question_id);
      RETURN true;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_bookmark_toggle(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bookmark_toggle(text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_bookmark_toggle(text, uuid, uuid) IS
  'Toggles bookmark for current user on a source or angle question. Returns true if now bookmarked, false if removed. Phase 2.7.';

-- ============================================================================
-- 3. increment_session_counters — atomic counter updates to avoid two-tab race
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_session_counters(
  p_session_id uuid,
  p_was_correct boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_rows_affected int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.practice_sessions
  SET
    questions_answered = questions_answered + 1,
    questions_correct = questions_correct + CASE WHEN p_was_correct THEN 1 ELSE 0 END,
    last_activity_at = NOW()
  WHERE id = p_session_id
    AND user_id = v_user_id
    AND status = 'active';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'session not found, not owned by user, or not active'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_session_counters(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_session_counters(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.increment_session_counters(uuid, boolean) IS
  'Atomically increments questions_answered and conditionally questions_correct on an active session owned by the caller. Phase 2.7.';

-- ============================================================================
-- 4. Idempotency partial unique indexes on attempts
-- ============================================================================
-- Prevent duplicate attempts when the user (or network retry) submits the same
-- (session, question) pair twice. Combined with INSERT ... ON CONFLICT DO NOTHING
-- in app code, makes submitAttempt safe to retry.

CREATE UNIQUE INDEX IF NOT EXISTS attempts_unique_per_session_source
  ON public.attempts (practice_session_id, source_question_id)
  WHERE question_type = 'source' AND practice_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS attempts_unique_per_session_angle
  ON public.attempts (practice_session_id, angle_question_id)
  WHERE question_type = 'angle' AND practice_session_id IS NOT NULL;

COMMENT ON INDEX public.attempts_unique_per_session_source IS
  'Idempotency guard: one source-question attempt per practice session. Phase 2.7.';

COMMENT ON INDEX public.attempts_unique_per_session_angle IS
  'Idempotency guard: one angle-question attempt per practice session. Phase 2.7.';
