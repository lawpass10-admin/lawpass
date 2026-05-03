-- Migration 0004: Content tables (SPEC 8.3)
-- chapters → subtopics → source_questions → source_choices
--                       → angle_questions  → angle_choices

-- ============================================================
-- chapters (SPEC 8.3.1)
-- ============================================================
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL COLLATE hebrew,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chapters_display_order ON chapters(display_order);

-- ============================================================
-- subtopics (SPEC 8.3.2)
-- ============================================================
CREATE TABLE subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL COLLATE hebrew,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, code),
  UNIQUE (chapter_id, title)
);

CREATE INDEX idx_subtopics_chapter ON subtopics(chapter_id);
CREATE INDEX idx_subtopics_code ON subtopics(code);

-- ============================================================
-- source_questions (SPEC 8.3.3)
-- ============================================================
CREATE TABLE source_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_group_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  external_id TEXT NOT NULL,
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  subtopic_id UUID NOT NULL REFERENCES subtopics(id),

  question_text TEXT NOT NULL COLLATE hebrew,
  source_metadata JSONB,

  -- learning_360 fields
  legal_topic_analysis TEXT NOT NULL COLLATE hebrew,
  full_explanation TEXT NOT NULL COLLATE hebrew,
  common_pitfall TEXT NOT NULL COLLATE hebrew,
  concepts_and_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  quick_thinking_360 TEXT NOT NULL COLLATE hebrew,
  summary_for_memory TEXT NOT NULL COLLATE hebrew,
  references_list JSONB NOT NULL DEFAULT '[]'::jsonb,

  notes_for_admin TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (question_group_id, version)
);

CREATE INDEX idx_source_q_group ON source_questions(question_group_id);
CREATE INDEX idx_source_q_chapter ON source_questions(chapter_id);
CREATE INDEX idx_source_q_subtopic ON source_questions(subtopic_id);
CREATE INDEX idx_source_q_status_current ON source_questions(status, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_source_q_external_id ON source_questions(external_id);
CREATE INDEX idx_source_q_concepts ON source_questions USING GIN (concepts_and_skills);

CREATE TRIGGER set_source_questions_updated_at
  BEFORE UPDATE ON source_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- source_choices (SPEC 8.3.4)
-- ============================================================
CREATE TABLE source_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_question_id UUID NOT NULL REFERENCES source_questions(id) ON DELETE CASCADE,
  letter TEXT NOT NULL CHECK (letter IN ('א', 'ב', 'ג', 'ד')),
  choice_text TEXT NOT NULL COLLATE hebrew,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  distractor_analysis TEXT COLLATE hebrew,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (source_question_id, letter)
);

CREATE INDEX idx_source_ch_question ON source_choices(source_question_id);

-- Partial unique index: exactly one correct answer per source question
CREATE UNIQUE INDEX idx_source_ch_one_correct
  ON source_choices(source_question_id)
  WHERE is_correct = TRUE;

-- ============================================================
-- angle_questions (SPEC 8.3.5)
-- ============================================================
CREATE TABLE angle_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_question_id UUID NOT NULL REFERENCES source_questions(id) ON DELETE CASCADE,

  angle_letter TEXT NOT NULL CHECK (angle_letter IN ('א', 'ב', 'ג', 'ד', 'ה')),
  angle_title TEXT COLLATE hebrew,
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 5),

  question_text TEXT NOT NULL COLLATE hebrew,

  -- learning_360 fields
  legal_topic_analysis TEXT NOT NULL COLLATE hebrew,
  full_explanation TEXT NOT NULL COLLATE hebrew,
  common_pitfall TEXT NOT NULL COLLATE hebrew,
  concepts_and_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  quick_thinking_360 TEXT NOT NULL COLLATE hebrew,
  summary_for_memory TEXT NOT NULL COLLATE hebrew,
  references_list JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (source_question_id, angle_letter),
  UNIQUE (source_question_id, display_order)
);

CREATE INDEX idx_angle_q_source ON angle_questions(source_question_id);
CREATE INDEX idx_angle_q_concepts ON angle_questions USING GIN (concepts_and_skills);

CREATE TRIGGER set_angle_questions_updated_at
  BEFORE UPDATE ON angle_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- angle_choices (SPEC 8.3.6)
-- ============================================================
CREATE TABLE angle_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angle_question_id UUID NOT NULL REFERENCES angle_questions(id) ON DELETE CASCADE,
  letter TEXT NOT NULL CHECK (letter IN ('א', 'ב', 'ג', 'ד')),
  choice_text TEXT NOT NULL COLLATE hebrew,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  distractor_analysis TEXT COLLATE hebrew,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (angle_question_id, letter)
);

CREATE INDEX idx_angle_ch_question ON angle_choices(angle_question_id);

-- Partial unique index: exactly one correct answer per angle question
CREATE UNIQUE INDEX idx_angle_ch_one_correct
  ON angle_choices(angle_question_id)
  WHERE is_correct = TRUE;

-- ============================================================
-- RLS for content tables
-- ============================================================

-- chapters: read by any authenticated user, full access for admin
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_view_chapters" ON chapters
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "admins_full_access_chapters" ON chapters
  FOR ALL USING (public.is_admin());

-- subtopics: read by any authenticated user, full access for admin
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_view_subtopics" ON subtopics
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "admins_full_access_subtopics" ON subtopics
  FOR ALL USING (public.is_admin());

-- source_questions: active subscribers see active+current, admin full access
ALTER TABLE source_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_users_view_active_source_questions" ON source_questions
  FOR SELECT USING (
    status = 'active'
    AND is_current = TRUE
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_full_access_source_questions" ON source_questions
  FOR ALL USING (public.is_admin());

-- source_choices: active subscribers see via source question, admin full access
ALTER TABLE source_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_users_view_source_choices" ON source_choices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM source_questions sq
      WHERE sq.id = source_choices.source_question_id
        AND sq.status = 'active'
        AND sq.is_current = TRUE
    )
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_full_access_source_choices" ON source_choices
  FOR ALL USING (public.is_admin());

-- angle_questions: active subscribers see via source question, admin full access
ALTER TABLE angle_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_users_view_angle_questions" ON angle_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM source_questions sq
      WHERE sq.id = angle_questions.source_question_id
        AND sq.status = 'active'
        AND sq.is_current = TRUE
    )
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_full_access_angle_questions" ON angle_questions
  FOR ALL USING (public.is_admin());

-- angle_choices: active subscribers see via angle→source, admin full access
ALTER TABLE angle_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_users_view_angle_choices" ON angle_choices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM angle_questions aq
      JOIN source_questions sq ON sq.id = aq.source_question_id
      WHERE aq.id = angle_choices.angle_question_id
        AND sq.status = 'active'
        AND sq.is_current = TRUE
    )
    AND public.has_active_subscription()
  );

CREATE POLICY "admins_full_access_angle_choices" ON angle_choices
  FOR ALL USING (public.is_admin());
