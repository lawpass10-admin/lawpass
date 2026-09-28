-- study_material — a study document's source text beside LawPass's own version.
--
-- WHY THE TWO TEXTS SIT IN ONE ROW. The pipeline has two stages that happen at
-- different times: scripts/ingestion/docx2json.mjs extracts a document, and
-- scripts/ingestion/rewrite-source.mjs later produces LawPass's independently
-- authored version of it under LLM-text-converting.json. Keeping both on one
-- row means "what has been converted, and what has not" is a column test rather
-- than a join, and the pair can never drift apart.
--
-- lawpass_text is therefore NULLABLE: a row exists as soon as the source is
-- extracted, and is filled in when the conversion runs.
--
-- WHY jsonb AND NOT text. The extractors do not produce a blob — they produce
-- structure (sections, tables with named columns, templates with a part, title
-- and body). Storing that as text would throw the structure away and force
-- every later reader to re-parse it. jsonb keeps it queryable: `->>` reaches a
-- field, `@>` tests containment, and the GIN indexes below make both fast.
--
-- THE SOURCE IS STORED, NOT PUBLISHED. original_text holds someone else's
-- copyrighted expression. It lives here so the conversion can be checked
-- against it and re-run, which is a legitimate internal use — but nothing that
-- serves a candidate may read this column. Only lawpass_text is publishable.
-- The RLS policies below enforce that: `authenticated` cannot read the table at
-- all, and the app is expected to expose lawpass_text through a view or a
-- server-side query, never by selecting the whole row into a browser session.

CREATE TABLE IF NOT EXISTS public.study_material (
  study_material_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which document this came from. Deliberately text and deliberately NOT a
  -- foreign key: the three kinds of material live in three different tables
  -- (diuni_real_questions, mahoti_real_questions, open_questions) and the
  -- classification is not settled yet. A filename, a slug or a uuid string all
  -- work. Add the constraint once the classification is decided.
  paper_id text NOT NULL,

  -- Which part of the product the material belongs to. Values match the names
  -- already used across the schema, so this column can be joined or filtered
  -- against them without a translation step.
  text_field text NOT NULL
    CHECK (text_field IN ('diuni', 'mahoti', 'open_questions')),

  -- The extracted source, as the extractor produced it.
  original_text jsonb NOT NULL,

  -- LawPass's own version. NULL until the conversion has run.
  lawpass_text jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── keeping updated_at honest ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS study_material_updated_at ON public.study_material;
CREATE TRIGGER study_material_updated_at
  BEFORE UPDATE ON public.study_material
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_study_material_text_field
  ON public.study_material (text_field);

CREATE INDEX IF NOT EXISTS idx_study_material_paper_id
  ON public.study_material (paper_id);

-- The point of storing jsonb. GIN with the default operator class supports key
-- existence (?), containment (@>) and path queries, which is what searching
-- inside an extracted document actually needs.
CREATE INDEX IF NOT EXISTS idx_study_material_original_gin
  ON public.study_material USING gin (original_text);

CREATE INDEX IF NOT EXISTS idx_study_material_lawpass_gin
  ON public.study_material USING gin (lawpass_text);

-- "What still needs converting" is the pipeline's most frequent question, and a
-- partial index answers it without scanning converted rows.
CREATE INDEX IF NOT EXISTS idx_study_material_unconverted
  ON public.study_material (text_field, created_at)
  WHERE lawpass_text IS NULL;

-- ── row level security ───────────────────────────────────────────────────────
--
-- Admin-only, deliberately. This table holds the source's protected expression
-- in original_text, so a candidate's session has no business reading a row of
-- it. When the app serves LawPass's version to candidates, do it through a view
-- that exposes lawpass_text alone, or from the server with the service role —
-- and grant SELECT on that view rather than on this table.

ALTER TABLE public.study_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY study_material_admins_all
  ON public.study_material FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- A new table starts with NO privileges for `authenticated`, because
-- 20260503000014 revoked the blanket defaults and re-grants table by table.
-- Without a grant the policy above is never even reached and every admin query
-- returns empty with no error — the failure that cost a day on
-- open_question_templates (see 20260924000004). Granted here, in the same
-- migration that creates the table, so the two cannot drift apart.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_material TO authenticated;

-- ── documentation ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.study_material IS
  'A study document''s extracted source text beside LawPass''s own converted version. original_text is the copyrighted source and is admin-only; lawpass_text is the publishable version and is NULL until the conversion has run.';
COMMENT ON COLUMN public.study_material.paper_id IS
  'Identifies the source document. Not a foreign key yet: the three material types live in different tables and the classification is not settled.';
COMMENT ON COLUMN public.study_material.text_field IS
  'Which part of the product this belongs to: diuni, mahoti or open_questions. Matches the naming used elsewhere in the schema.';
COMMENT ON COLUMN public.study_material.original_text IS
  'The extracted source as jsonb, structure intact. Someone else''s copyrighted expression — kept for re-running and checking the conversion, never served to a candidate.';
COMMENT ON COLUMN public.study_material.lawpass_text IS
  'LawPass''s independently authored version, produced under scripts/ingestion/LLM-text-converting.json. NULL until converted. This is the only column that may be published.';
