-- ============================================================================
-- Exam timer: wall-clock elapsed instead of accumulated deltas
-- ============================================================================
--
-- THE DEFECT (found in QA, 2026-09-27)
--
-- Slice 3 Phase 5 accumulated exam time in `time_used_seconds`, adding a
-- delta at each RPC call:
--
--   v_elapsed  := LEAST(600, NOW() - last_activity_at);
--   v_new_time := time_used_seconds + v_elapsed;
--
-- Two things follow from that, and both were reproduced against a live
-- session:
--
--   1. Time accrues ONLY when an RPC runs. A page load reads whatever
--      `time_used_seconds` happened to be stored at the last answer, so
--      reloading REWINDS the clock. Measured: remaining went 97:08 -> 97:57
--      across 57 seconds of real time — about 106 seconds recovered per
--      refresh, repeatable.
--   2. The LEAST(600, ...) cap means any gap longer than ten minutes is
--      charged as ten minutes. Spacing answers >10 minutes apart stretches a
--      100-minute paper over an unbounded number of hours.
--
-- THE MODEL NOW
--
-- The clock is derived from wall time and is not a counter anyone bumps:
--
--   elapsed = (NOW() - started_at) - total_paused_seconds - live_pause
--
-- where `live_pause` is the pause currently in progress, if any. Time passes
-- whether or not the candidate's browser is open, which is what a timed paper
-- means. `time_used_seconds` is still written on every RPC, but it is now a
-- CACHE of that expression rather than the source of truth — the results page
-- and the archive read it after completion, when it is frozen and correct.
--
-- The 600-second cap is deliberately gone. It existed so a candidate whose
-- laptop slept was not charged for the nap; the cost of keeping it is that
-- sleeping the laptop became the cheat. A real sitting is invigilated for a
-- fixed wall-clock window and this now matches that.
--
-- NOTE the per-question `duration_seconds` on the attempt row keeps the old
-- since-last-activity figure, cap included: that is "how long this question
-- took", a different quantity from the session clock, and a 10-minute cap is
-- a reasonable ceiling for one question.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The pause accumulator
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS total_paused_seconds integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exam_sessions.total_paused_seconds IS
  'Sum of every COMPLETED pause, in seconds. A pause in progress is not in here — it is derived from paused_at while status = paused. Subtracted from wall time to get elapsed.';

-- Backfill so no sitting already in flight gains or loses a second.
--
-- We want elapsed(NOW) to come out at exactly the time_used_seconds each row
-- already carries, so we solve the model's equation for the accumulator:
--
--   total_paused_seconds = (NOW - started_at) - live_pause - time_used_seconds
--
-- Only 'active' and 'paused' rows matter. Completed and abandoned sittings
-- never have their clock read again — their time_used_seconds is frozen and
-- is what the results page and the archive show.
UPDATE public.exam_sessions SET
  total_paused_seconds = GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - started_at))::int
      - CASE
          WHEN status = 'paused' AND paused_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (NOW() - paused_at))::int
          ELSE 0
        END
      - COALESCE(time_used_seconds, 0)
  )
WHERE status IN ('active', 'paused');

-- ----------------------------------------------------------------------------
-- 2. One definition of elapsed, used by every caller
-- ----------------------------------------------------------------------------
-- Scalar arguments rather than a rowtype so the read path can call it from a
-- plain SELECT over the columns it already fetches. STABLE, not IMMUTABLE:
-- it reads NOW().
CREATE OR REPLACE FUNCTION public.exam_elapsed_seconds(
  p_started_at             timestamptz,
  p_total_paused_seconds   integer,
  p_paused_at              timestamptz,
  p_status                 text,
  p_total_duration_seconds integer
) RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT LEAST(
    p_total_duration_seconds,
    GREATEST(0,
      EXTRACT(EPOCH FROM (NOW() - p_started_at))::int
        - COALESCE(p_total_paused_seconds, 0)
        - CASE
            WHEN p_status = 'paused' AND p_paused_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (NOW() - p_paused_at))::int
            ELSE 0
          END
    )
  );
$$;

COMMENT ON FUNCTION public.exam_elapsed_seconds(timestamptz, integer, timestamptz, text, integer) IS
  'Seconds consumed by a LIVE exam sitting: wall time since started_at, less every pause, clamped to the papers length. Completed sittings read the frozen exam_sessions.time_used_seconds instead.';

GRANT EXECUTE ON FUNCTION public.exam_elapsed_seconds(timestamptz, integer, timestamptz, text, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. submit_exam_answer — same body, wall-clock time
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_exam_answer(
  p_session_id          uuid,
  p_window_token        uuid,
  p_question_type       text,
  p_source_question_id  uuid,
  p_angle_question_id   uuid,
  p_selected_choice_id  uuid,
  p_selected_letter     text,
  p_is_correct          boolean,
  p_was_skipped         boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
  v_question_seconds integer;
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
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_active');
  END IF;

  -- How long THIS question took. Keeps the old since-last-activity meaning
  -- and the old ceiling; it is not the session clock.
  v_question_seconds := LEAST(600, GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - v_session.last_activity_at))::int
  ));

  v_new_time := public.exam_elapsed_seconds(
    v_session.started_at, v_session.total_paused_seconds,
    v_session.paused_at, v_session.status, v_session.total_duration_seconds
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
      'exam', p_session_id, v_question_seconds, p_was_skipped
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
      'exam', p_session_id, v_question_seconds, p_was_skipped
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

COMMENT ON FUNCTION public.submit_exam_answer(uuid, uuid, text, uuid, uuid, uuid, text, boolean, boolean) IS
  'Atomic exam attempt: token-validate + UPSERT attempt + recompute counters + refresh the wall-clock time cache. Returns jsonb {ok, remaining_seconds, error_code?}.';

-- ----------------------------------------------------------------------------
-- 4. bump_exam_session_time — pause anchor, wall-clock time
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_exam_session_time(
  p_session_id   uuid,
  p_window_token uuid,
  p_new_status   text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_session public.exam_sessions%ROWTYPE;
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

  -- Read BEFORE the status flip. On an active session there is no live pause
  -- to exclude; on an already-paused one the existing anchor is honoured, so
  -- a repeated pause call is idempotent and costs nothing.
  v_new_time := public.exam_elapsed_seconds(
    v_session.started_at, v_session.total_paused_seconds,
    v_session.paused_at, v_session.status, v_session.total_duration_seconds
  );

  IF p_new_status IS NULL THEN
    UPDATE public.exam_sessions SET
      time_used_seconds = v_new_time,
      last_activity_at = NOW()
    WHERE id = p_session_id;
  ELSIF p_new_status = 'paused' THEN
    UPDATE public.exam_sessions SET
      status            = 'paused',
      -- Preserve an existing anchor: abandonAndExitExam can call this on an
      -- already-paused session, and re-anchoring would hand back the pause
      -- so far as exam time.
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

COMMENT ON FUNCTION public.bump_exam_session_time(uuid, uuid, text) IS
  'Refresh the wall-clock time cache, optionally anchoring a pause, for pauseExam/abandonAndExitExam. Returns jsonb.';

-- ----------------------------------------------------------------------------
-- 5. resume_exam_session — bank the pause that just ended
-- ----------------------------------------------------------------------------
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
  v_paused_for integer;
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
  IF v_session.status <> 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_not_paused');
  END IF;

  -- The pause that is ending moves from "derived from paused_at" into the
  -- banked total. This is the whole reason the accumulator exists: once
  -- paused_at is cleared there is nothing left to derive it from.
  v_paused_for := GREATEST(0, COALESCE(
    EXTRACT(EPOCH FROM (NOW() - v_session.paused_at))::int, 0
  ));

  v_new_time := public.exam_elapsed_seconds(
    v_session.started_at, v_session.total_paused_seconds,
    v_session.paused_at, v_session.status, v_session.total_duration_seconds
  );

  UPDATE public.exam_sessions SET
    status               = 'active',
    total_paused_seconds = v_session.total_paused_seconds + v_paused_for,
    paused_at            = NULL,
    time_used_seconds    = v_new_time,
    last_activity_at     = NOW()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining_seconds',
      GREATEST(0, v_session.total_duration_seconds - v_new_time)
  );
END;
$$;

COMMENT ON FUNCTION public.resume_exam_session(uuid, uuid) IS
  'Atomic paused->active flip. Banks the finished pause into total_paused_seconds so it stays excluded from the wall-clock elapsed.';

-- ----------------------------------------------------------------------------
-- 6. submit_final_exam — freeze the clock at the real elapsed
-- ----------------------------------------------------------------------------
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

  -- Handles the paused case on its own: auto-submit at zero can fire while
  -- the sitting is paused, and the pause must still not be charged.
  v_new_time := public.exam_elapsed_seconds(
    v_session.started_at, v_session.total_paused_seconds,
    v_session.paused_at, v_session.status, v_session.total_duration_seconds
  );

  SELECT COUNT(*) INTO v_correct
  FROM public.attempts
  WHERE exam_session_id = p_session_id
    AND is_correct = true;
  v_passed := (v_correct >= 24);

  -- From here time_used_seconds stops being a cache and becomes the record:
  -- status is no longer live, so nothing recomputes it again.
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

COMMENT ON FUNCTION public.submit_final_exam(uuid, uuid) IS
  'Atomic final submit: freezes the wall-clock elapsed into time_used_seconds, scores from attempts, flips to completed. Idempotent.';
