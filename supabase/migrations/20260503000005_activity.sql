-- Migration 0005: Activity tables (SPEC 8.4)
-- practice_sessions, exam_sessions, attempts
-- Note: sessions must be created BEFORE attempts due to FK references.

-- ============================================================
-- practice_sessions (SPEC 8.4.2)
-- ============================================================
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- User selections before starting
  selected_chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_subtopics JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_count_target INTEGER NOT NULL,
  angles_per_source INTEGER NOT NULL DEFAULT 0 CHECK (angles_per_source BETWEEN 0 AND 5),
  time_per_question_seconds INTEGER NOT NULL DEFAULT 150,

  -- Pre-computed ordered list of questions for this session
  question_list JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  questions_answered INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_sessions_user ON practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_active ON practice_sessions(user_id, status) WHERE status = 'active';

-- ============================================================
-- exam_sessions (SPEC 8.4.3)
-- ============================================================
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The 40 questions selected for this exam
  question_list JSONB NOT NULL,

  total_duration_seconds INTEGER NOT NULL DEFAULT 6000,  -- 100 minutes
  time_used_seconds INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  questions_answered INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER,   -- 0-40
  passed BOOLEAN,        -- true if final_score >= 24

  active_window_token UUID,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_sessions_user ON exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_active ON exam_sessions(user_id, status) WHERE status IN ('active', 'paused');

-- ============================================================
-- attempts (SPEC 8.4.1)
-- The largest table at scale (~24M rows).
-- ============================================================
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Either source_question_id OR angle_question_id is populated (not both)
  question_type TEXT NOT NULL CHECK (question_type IN ('source', 'angle')),
  source_question_id UUID REFERENCES source_questions(id),
  angle_question_id UUID REFERENCES angle_questions(id),

  -- The choice the user selected (NULL if skipped)
  selected_choice_id UUID,
  selected_letter TEXT CHECK (selected_letter IN ('א', 'ב', 'ג', 'ד')),
  is_correct BOOLEAN,

  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  practice_session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
  exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,

  duration_seconds INTEGER,
  was_skipped BOOLEAN NOT NULL DEFAULT FALSE,

  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: exactly one of source_question_id or angle_question_id
  CHECK (
    (question_type = 'source' AND source_question_id IS NOT NULL AND angle_question_id IS NULL)
    OR
    (question_type = 'angle' AND angle_question_id IS NOT NULL AND source_question_id IS NULL)
  )
);

-- Standard indexes
CREATE INDEX idx_attempts_user ON attempts(user_id);
CREATE INDEX idx_attempts_user_source ON attempts(user_id, source_question_id) WHERE source_question_id IS NOT NULL;
CREATE INDEX idx_attempts_user_angle ON attempts(user_id, angle_question_id) WHERE angle_question_id IS NOT NULL;
CREATE INDEX idx_attempts_user_mode ON attempts(user_id, mode);
CREATE INDEX idx_attempts_session ON attempts(practice_session_id) WHERE practice_session_id IS NOT NULL;
CREATE INDEX idx_attempts_exam ON attempts(exam_session_id) WHERE exam_session_id IS NOT NULL;
CREATE INDEX idx_attempts_attempted_at ON attempts(attempted_at DESC);

-- Composite index for "last 30 days" user analytics (SPEC 8.8)
CREATE INDEX idx_attempts_user_date ON attempts(user_id, attempted_at DESC);

-- BRIN index for global aggregation queries (SPEC 8.8 — 1000x less space than B-tree)
CREATE INDEX idx_attempts_created_brin ON attempts USING BRIN (attempted_at);

-- ============================================================
-- RLS for activity tables
-- ============================================================

-- practice_sessions: active subscribers CRUD own, admin SELECT all
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_practice_sessions" ON practice_sessions
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_view_practice_sessions" ON practice_sessions
  FOR SELECT USING (public.is_admin());

-- exam_sessions: active subscribers CRUD own, admin SELECT all
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_exam_sessions" ON exam_sessions
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_view_exam_sessions" ON exam_sessions
  FOR SELECT USING (public.is_admin());

-- attempts: active subscribers CRUD own, admin SELECT all
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_attempts_with_subscription" ON attempts
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_view_all_attempts" ON attempts
  FOR SELECT USING (public.is_admin());
