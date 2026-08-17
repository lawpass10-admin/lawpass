-- open_questions — storage for open (essay-style) questions and their answers.
--
-- Replaces the PDF-based flow: the question is stored as structured JSON and
-- rendered as HTML in the app, so no PDF asset is referenced here.
--
-- Columns:
--   * open_question_id  uuid PK, default gen_random_uuid().
--   * question          jsonb NOT NULL. The question content in the structured
--                       shape the HTML page renders (sections, facts, sub-parts).
--   * answers           jsonb NULL. Filled by the LLM answer generator; NULL
--                       until an answer has been generated for the question.
--   * subject           text NULL. The law / subject name, extracted from the
--                       question in a later slice. NULL until extraction runs.
--   * type              text NOT NULL. 'source' = question+answer JSONs we
--                       already have; 'new' = generated later.
--   * created_at        timestamptz NOT NULL, default now().
--
-- RLS: fails closed. Only admins can read or write while this is authoring-only
-- content. When the student-facing HTML page ships, add a SELECT policy for the
-- `authenticated` role (plus the matching GRANT) in a follow-up migration.

CREATE TABLE IF NOT EXISTS public.open_questions (
  open_question_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  question          jsonb        NOT NULL,
  answers           jsonb        NULL,
  subject           text         NULL,
  type              text         NOT NULL
    CONSTRAINT open_questions_type_check CHECK (type IN ('source', 'new')),
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- Listing/filtering by origin ('source' backfill vs 'new' generated) and by
-- subject once extraction has populated it.
CREATE INDEX IF NOT EXISTS idx_open_questions_type_created_at
  ON public.open_questions (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_questions_subject
  ON public.open_questions (subject) WHERE subject IS NOT NULL;

ALTER TABLE public.open_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only for now. Service-role (ingestion + LLM generator) bypasses RLS.
CREATE POLICY open_questions_admins_select
  ON public.open_questions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY open_questions_admins_insert
  ON public.open_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY open_questions_admins_update
  ON public.open_questions FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Table-level grants; RLS above does the row-level filtering on top.
GRANT SELECT, INSERT, UPDATE ON public.open_questions TO authenticated;
