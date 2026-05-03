-- Migration 0007: User objects (SPEC 8.6)
-- bookmarks, mistakes, question_notes, question_feedback
-- These are objects a user attaches to questions.

-- ============================================================
-- bookmarks (SPEC 8.6.1)
-- ============================================================
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Either source or angle (not both)
  question_type TEXT NOT NULL CHECK (question_type IN ('source', 'angle')),
  source_question_group_id UUID,
  angle_question_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (question_type = 'source' AND source_question_group_id IS NOT NULL AND angle_question_id IS NULL)
    OR
    (question_type = 'angle' AND angle_question_id IS NOT NULL AND source_question_group_id IS NULL)
  ),

  UNIQUE (user_id, question_type, source_question_group_id, angle_question_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_user_type ON bookmarks(user_id, question_type);

-- ============================================================
-- mistakes (SPEC 8.6.2)
-- ============================================================
CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Either source or angle (not both)
  question_type TEXT NOT NULL CHECK (question_type IN ('source', 'angle')),
  source_question_group_id UUID,
  angle_question_id UUID,

  -- Tracking info
  first_mistake_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_mistake_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mistakes_count INTEGER NOT NULL DEFAULT 1,

  -- User can manually remove (mark as "got it")
  manually_removed BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at TIMESTAMPTZ,

  CHECK (
    (question_type = 'source' AND source_question_group_id IS NOT NULL AND angle_question_id IS NULL)
    OR
    (question_type = 'angle' AND angle_question_id IS NOT NULL AND source_question_group_id IS NULL)
  ),

  UNIQUE (user_id, question_type, source_question_group_id, angle_question_id)
);

CREATE INDEX idx_mistakes_user ON mistakes(user_id) WHERE manually_removed = FALSE;
CREATE INDEX idx_mistakes_user_type ON mistakes(user_id, question_type) WHERE manually_removed = FALSE;

-- ============================================================
-- question_notes (SPEC 8.6.3)
-- ============================================================
CREATE TABLE question_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Linkage by question type
  question_type TEXT NOT NULL CHECK (question_type IN ('source', 'angle')),

  -- For source questions: link to question_group_id (survives versioning)
  source_question_group_id UUID,

  -- For angle questions: link by source group + position (1-5)
  angle_position INTEGER CHECK (angle_position BETWEEN 1 AND 5),

  -- Rich text content
  content_json JSONB NOT NULL,     -- TipTap original JSON
  content_html TEXT NOT NULL,      -- Sanitized HTML (cached for display)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: type-specific fields must match
  CHECK (
    (question_type = 'source' AND source_question_group_id IS NOT NULL AND angle_position IS NULL)
    OR
    (question_type = 'angle' AND source_question_group_id IS NOT NULL AND angle_position IS NOT NULL)
  ),

  -- One note per user per question
  UNIQUE (user_id, question_type, source_question_group_id, angle_position)
);

CREATE INDEX idx_question_notes_user ON question_notes(user_id);
CREATE INDEX idx_question_notes_lookup ON question_notes(user_id, source_question_group_id);

CREATE TRIGGER set_question_notes_updated_at
  BEFORE UPDATE ON question_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- question_feedback (SPEC 8.6.4)
-- ============================================================
CREATE TABLE question_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Linkage by question type (same pattern as question_notes)
  question_type TEXT NOT NULL CHECK (question_type IN ('source', 'angle')),
  source_question_group_id UUID NOT NULL,
  angle_position INTEGER CHECK (angle_position BETWEEN 1 AND 5),

  -- Feedback content
  category TEXT NOT NULL CHECK (
    category IN ('error_in_question', 'error_in_correct_answer', 'unclear_explanation', 'other')
  ),
  message TEXT NOT NULL COLLATE hebrew CHECK (length(message) BETWEEN 10 AND 1000),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: type-specific fields must match
  CHECK (
    (question_type = 'source' AND angle_position IS NULL)
    OR
    (question_type = 'angle' AND angle_position IS NOT NULL)
  )
);

CREATE INDEX idx_question_feedback_created ON question_feedback(created_at DESC);
CREATE INDEX idx_question_feedback_question ON question_feedback(source_question_group_id);
CREATE INDEX idx_question_feedback_category ON question_feedback(category);

-- ============================================================
-- RLS for user objects
-- ============================================================

-- bookmarks: active subscribers CRUD own, admin BLOCKED (SPEC 19.3.1)
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bookmarks" ON bookmarks
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

-- mistakes: active subscribers CRUD own, admin BLOCKED (SPEC 19.3.1)
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_mistakes" ON mistakes
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

-- question_notes: active subscribers CRUD own, admin BLOCKED (private — SPEC 19.3.1)
ALTER TABLE question_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notes" ON question_notes
  FOR ALL USING (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

-- question_feedback: active subscribers INSERT only, admin SELECT all (SPEC 19.3.1)
ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_feedback" ON question_feedback
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_view_all_feedback" ON question_feedback
  FOR SELECT USING (public.is_admin());
