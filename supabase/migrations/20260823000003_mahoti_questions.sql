-- mahoti_questions — one row per generated exam: the notebook the model was
-- shown, the questions it produced, and the review content for those same
-- questions.
--
-- Pipeline: mahoti_laws (corpus) -> notebook (a sampled subset of laws and
-- sections, the ONLY law the model sees) -> Mahoti_exam-LLM-Params -> exam.
-- Keeping the notebook in the same row as the questions is the point: every
-- quote in `questions` is checkable against `question_notebook` and nothing
-- else, so one row is self-contained evidence that the paper is grounded in
-- real legislation rather than in the model's memory.
--
-- Columns:
--   * question_id        uuid PK, default gen_random_uuid(). The loader
--                        derives a stable uuid5 from the notebook seed and
--                        the exam's generated_at, so re-loading the same
--                        exam refreshes its row instead of duplicating it.
--   * question_notebook  jsonb NOT NULL. The whole notebook_*.json: sampling
--                        parameters and seed, the table of contents, and the
--                        full text of every section shown to the model.
--   * questions          jsonb NULL. The paper: exam/generation/validation
--                        metadata plus the questions array — fact pattern,
--                        stem, the four options, the correct letter, and the
--                        cited sources with their verified quotes. NULL
--                        between building a notebook and running the model.
--   * question_review    jsonb NULL. The review content for those questions,
--                        one entry per question, aligned to `questions` by
--                        `number`: ניתוח הנושא המשפטי, הסבר משפטי מלא,
--                        ניתוח מסיחים per letter, מלכודת נפוצה, חשיבה 360°,
--                        מבט מסכם, מושגים ומיומנויות. NULL until generated.
--   * created_at         timestamptz NOT NULL, default now(). When the row
--                        was first written. The loader never sends it, so a
--                        re-load of the same exam refreshes the payloads and
--                        leaves the original creation time standing. When
--                        the model ran is a different fact, and lives in
--                        questions -> exam -> generated_at.
--
-- The two jsonb payloads are split, not duplicated: the candidate-facing
-- paper can be served from `questions` alone, without shipping the answers'
-- reasoning to the client, while the results screen reads both columns of
-- the one row it already has.
--
-- NOTE: 20260823000002_mahoti_question.sql defines a near-identical table in
-- the singular, with two extra columns (params_version, date). This table
-- supersedes it. If that migration has already been applied, drop the old
-- table separately — that is a data-losing statement and is deliberately not
-- included here.
--
-- RLS: fails closed, matching mahoti_laws and open_questions. Admin-only —
-- this is authoring-side content; the service role used by the loader
-- bypasses RLS.

CREATE TABLE IF NOT EXISTS public.mahoti_questions (
  question_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  question_notebook  jsonb        NOT NULL,
  questions          jsonb        NULL,
  question_review    jsonb        NULL,
  created_at         timestamptz  NOT NULL DEFAULT now()
);

-- Idempotent, so this migration also does the right thing on a database
-- where the table was created before created_at was added to it. Adding a
-- column with a default is not data-losing; existing rows get now().
ALTER TABLE public.mahoti_questions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Which laws a notebook drew on, for coverage queries across runs
-- ("which laws have never been sampled?").
CREATE INDEX IF NOT EXISTS idx_mahoti_questions_notebook
  ON public.mahoti_questions USING gin (question_notebook jsonb_path_ops);

-- Listing newest-first, and finding the rows still awaiting generation.
CREATE INDEX IF NOT EXISTS idx_mahoti_questions_created_at
  ON public.mahoti_questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mahoti_questions_pending
  ON public.mahoti_questions (created_at DESC) WHERE questions IS NULL;

ALTER TABLE public.mahoti_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only. Hardening Rule 2 asks for an index on every column named in a
-- USING/CHECK clause; is_admin() reads profiles rather than any column of
-- this table, so there is none to index here.
CREATE POLICY mahoti_questions_admins_select
  ON public.mahoti_questions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY mahoti_questions_admins_insert
  ON public.mahoti_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY mahoti_questions_admins_update
  ON public.mahoti_questions FOR UPDATE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.mahoti_questions TO authenticated;
