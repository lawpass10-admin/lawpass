-- Slice 3 / Phase 5 — Atomic exam actions
--
-- Closes the atomicity gap from SLICE_3_TIMER_AUDIT.md §3+§4: every
-- timed exam action used to be a multi-round-trip TS sequence with a
-- read-modify-write window (counter recompute then time bump) and a
-- float→int boundary in JS. This migration moves the whole sequence
-- into SECURITY DEFINER RPCs whose function bodies execute in a single
-- implicit transaction, with a row-level lock via SELECT FOR UPDATE.
--
-- Four RPCs:
--   submit_exam_answer        — UPSERT attempt + recompute counters + bump time
--   bump_exam_session_time    — time bump (+ optional status flip), no attempt write
--   resume_exam_session       — flip paused→active WITHOUT bumping time
--   submit_final_exam         — recompute correct + flip status='completed' + bump time
--
-- Each:
--   - Validates auth.uid() ownership.
--   - Validates active_window_token match (single-window guard).
--   - Validates allowed source statuses.
--   - Computes elapsed inside Postgres (no float crosses the wire):
--       LEAST(600, GREATEST(0, EXTRACT(EPOCH FROM (NOW() - last_activity_at))::int))
--   - Returns jsonb {ok, error_code?, ...payload}. Action wrappers map
--     error_code into their typed failure shape.
--
-- Dead RPCs dropped at the bottom: record_exam_attempt (superseded by
-- submit_exam_answer) and increment_exam_session_counters (unused —
-- Phase 3 hotfix moved counter math to recompute-from-attempts which
-- the new submit_exam_answer subsumes).

-- ============================================================================
-- 1. submit_exam_answer
-- ============================================================================
-- Used by both submitExamAttempt (p_was_skipped=false + answer cols) and
-- skipExamQuestion (p_was_skipped=true + nulls). The UPSERT path mirrors
-- the dropped record_exam_attempt body — same partial-index ON CONFLICT
-- predicate, same column layout.
CREATE OR REPLACE FUNCTION public.submit_exam_answer(
  p_session_id          uuid,
  p_window_token        uuid,
  p_question_type       text,    -- 'source' | 'angle'
  p_source_question_id  uuid,    -- non-null if source
  p_angle_question_id   uuid,    -- non-null if angle
  p_selected_choice_id  uuid,    -- null on skip
  p_selected_letter     text,    -- null on skip
  p_is_correct          boolean, -- null on skip
  p_was_skipped         boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
  v_elapsed integer;
  v_new_time integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Lock the row for the rest of this txn: serializes concurrent
  -- submits on the same session (Phase 5 window-claim could in theory
  -- mint a new token between two in-flight tabs; row lock keeps the
  -- counter recompute coherent regardless).
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found');
  END IF;
  IF v_session.active_window_token <> p_window_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'window_conflict');
  END IF;
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_active');
  END IF;

  v_elapsed := LEAST(600, GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - v_session.last_activity_at))::int
  ));
  v_new_time := LEAST(
    v_session.total_duration_seconds,
    v_session.time_used_seconds + v_elapsed
  );

  IF p_question_type = 'source' THEN
    INSERT INTO public.attempts (
      user_id, question_type, source_question_id, angle_question_id,
      selected_choice_id, selected_letter, is_correct,
      mode, exam_session_id, duration_seconds, was_skipped
    )
    VALUES (
      v_user_id, 'source', p_source_question_id, NULL,
      p_selected_choice_id, p_selected_letter, p_is_correct,
      'exam', p_session_id, v_elapsed, p_was_skipped
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
      'exam', p_session_id, v_elapsed, p_was_skipped
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

  -- Single UPDATE that bumps time AND recomputes counters from the
  -- (just-updated) attempts table. Sub-SELECTs run inside the same
  -- statement so a concurrent attempt write can't slip between them.
  UPDATE public.exam_sessions SET
    time_used_seconds   = v_new_time,
    last_activity_at    = NOW(),
    questions_answered  = (
      SELECT COUNT(*) FROM public.attempts
      WHERE exam_session_id = p_session_id
        AND was_skipped = false
        AND is_correct IS NOT NULL
    ),
    questions_correct   = (
      SELECT COUNT(*) FROM public.attempts
      WHERE exam_session_id = p_session_id
        AND is_correct = true
    )
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining_seconds',
      GREATEST(0, v_session.total_duration_seconds - v_new_time)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_exam_answer(uuid, uuid, text, uuid, uuid, uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_exam_answer(uuid, uuid, text, uuid, uuid, uuid, text, boolean, boolean) TO authenticated;

COMMENT ON FUNCTION public.submit_exam_answer(uuid, uuid, text, uuid, uuid, uuid, text, boolean, boolean) IS
  'Atomic exam attempt: token-validate + UPSERT attempt + recompute counters + bump time. Returns jsonb {ok, remaining_seconds, error_code?}. Slice 3 Phase 5.';

-- ============================================================================
-- 2. bump_exam_session_time
-- ============================================================================
-- For pure timer transitions (pause / save-and-exit) that don't write
-- an attempt row. p_new_status='paused' flips status + paused_at; NULL
-- leaves status alone.
CREATE OR REPLACE FUNCTION public.bump_exam_session_time(
  p_session_id   uuid,
  p_window_token uuid,
  p_new_status   text  -- NULL or 'paused'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
  v_elapsed integer;
  v_new_time integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found');
  END IF;
  IF v_session.active_window_token <> p_window_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'window_conflict');
  END IF;
  IF v_session.status NOT IN ('active', 'paused') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_pauseable');
  END IF;

  v_elapsed := LEAST(600, GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - v_session.last_activity_at))::int
  ));
  v_new_time := LEAST(
    v_session.total_duration_seconds,
    v_session.time_used_seconds + v_elapsed
  );

  IF p_new_status IS NULL THEN
    UPDATE public.exam_sessions SET
      time_used_seconds = v_new_time,
      last_activity_at = NOW()
    WHERE id = p_session_id;
  ELSIF p_new_status = 'paused' THEN
    UPDATE public.exam_sessions SET
      status            = 'paused',
      -- Preserve existing paused_at if already set (idempotent calls
      -- from abandonAndExitExam on an already-paused session shouldn't
      -- reset the original pause anchor).
      paused_at         = COALESCE(v_session.paused_at, NOW()),
      time_used_seconds = v_new_time,
      last_activity_at  = NOW()
    WHERE id = p_session_id;
  ELSE
    RAISE EXCEPTION 'invalid p_new_status: %', p_new_status
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining_seconds',
      GREATEST(0, v_session.total_duration_seconds - v_new_time)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_exam_session_time(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bump_exam_session_time(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.bump_exam_session_time(uuid, uuid, text) IS
  'Atomic time bump (+ optional pause flip) for pauseExam/abandonAndExitExam. Returns jsonb. Slice 3 Phase 5.';

-- ============================================================================
-- 3. resume_exam_session
-- ============================================================================
-- Flips status='paused' → 'active' WITHOUT bumping time. The pause
-- interval is excluded from time_used_seconds by design (the user wasn't
-- spending exam time). Sets last_activity_at=NOW() so the next action's
-- elapsed window starts fresh from the resume click, not from the pause.
CREATE OR REPLACE FUNCTION public.resume_exam_session(
  p_session_id   uuid,
  p_window_token uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found');
  END IF;
  IF v_session.active_window_token <> p_window_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'window_conflict');
  END IF;
  IF v_session.status <> 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_paused');
  END IF;

  UPDATE public.exam_sessions SET
    status           = 'active',
    paused_at        = NULL,
    last_activity_at = NOW()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining_seconds',
      GREATEST(0, v_session.total_duration_seconds - v_session.time_used_seconds)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resume_exam_session(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resume_exam_session(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.resume_exam_session(uuid, uuid) IS
  'Atomic paused→active flip. Does NOT bump time_used_seconds — pause interval excluded by design. Slice 3 Phase 5.';

-- ============================================================================
-- 4. submit_final_exam
-- ============================================================================
-- Bumps time, recomputes correct count from attempts, flips
-- status='completed' + final_score + passed + completed_at. Idempotent:
-- if status='completed' already, returns the existing terminal state
-- without re-writing (matches the action's prior idempotency contract).
CREATE OR REPLACE FUNCTION public.submit_final_exam(
  p_session_id   uuid,
  p_window_token uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
  v_elapsed integer;
  v_new_time integer;
  v_correct integer;
  v_passed  boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_found');
  END IF;
  IF v_session.active_window_token <> p_window_token THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'window_conflict');
  END IF;

  -- Idempotency: already completed → return as-is.
  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'final_score', v_session.final_score,
      'passed', v_session.passed,
      'already_completed', true
    );
  END IF;
  IF v_session.status = 'abandoned' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_abandoned');
  END IF;
  -- 'active' or 'paused' both allowed: auto-submit at 0 may fire while
  -- paused (defensive).

  v_elapsed := LEAST(600, GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - v_session.last_activity_at))::int
  ));
  v_new_time := LEAST(
    v_session.total_duration_seconds,
    v_session.time_used_seconds + v_elapsed
  );

  SELECT COUNT(*) INTO v_correct
  FROM public.attempts
  WHERE exam_session_id = p_session_id
    AND is_correct = true;
  v_passed := (v_correct >= 24);

  UPDATE public.exam_sessions SET
    status            = 'completed',
    final_score       = v_correct,
    passed            = v_passed,
    completed_at      = NOW(),
    paused_at         = NULL,
    time_used_seconds = v_new_time,
    last_activity_at  = NOW(),
    questions_answered = (
      SELECT COUNT(*) FROM public.attempts
      WHERE exam_session_id = p_session_id
        AND was_skipped = false
        AND is_correct IS NOT NULL
    ),
    questions_correct = v_correct
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'final_score', v_correct,
    'passed', v_passed,
    'already_completed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_final_exam(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_final_exam(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.submit_final_exam(uuid, uuid) IS
  'Atomic final-submit: token-validate + recompute correct + status=completed + final_score/passed/completed_at + time bump. Idempotent. Slice 3 Phase 5.';

-- ============================================================================
-- 5. Drop superseded RPCs
-- ============================================================================
-- record_exam_attempt: superseded by submit_exam_answer (same UPSERT
-- shape + token validation + counter recompute + time bump in one call).
DROP FUNCTION IF EXISTS public.record_exam_attempt(uuid, text, uuid, uuid, uuid, text, boolean, boolean, integer);

-- increment_exam_session_counters: zero TS callers (Phase 3 hotfix moved
-- counter math to recompute-from-attempts which the new RPC subsumes).
DROP FUNCTION IF EXISTS public.increment_exam_session_counters(uuid, boolean);
