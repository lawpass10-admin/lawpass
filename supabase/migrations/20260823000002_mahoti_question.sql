-- mahoti_question — one row per generated exam: the notebook it was built
-- from, the questions the model produced, and the review payload.
--
-- Pipeline: mahoti_laws (corpus) -> notebook (a sampled subset of laws and
-- sections, the only law the model is shown) -> mahoti_exam LLM -> questions.
-- Keeping the notebook alongside the questions is the point: every quote in
-- `questions` is verifiable against `question_notebook` and nothing else, so
-- a row is self-contained evidence that the paper is grounded.
--
-- Columns:
--   * mahoti_question_id  uuid PK, default gen_random_uuid().
--   * question_notebook   jsonb NOT NULL. The notebook: its sampling
--                         parameters, the table of contents, and the full
--                         text of every section shown to the model.
--   * questions           jsonb NULL. The generator's output — the questions
--                         array plus its exam/generation/validation blocks.
--                         NULL between building a notebook and running the
--                         model against it.
--   * question_review     jsonb NULL. The review payload: the per-question
--                         360° learning content (ניתוח מסיחים, חשיבה 360°,
--                         מבט מסכם, …) in the shape the app's Source360 type
--                         expects. NULL until the review pass has run.
--   * params_version      text NULL. Which Mahoti_exam-LLM-Params.json
--                         version produced `questions` (e.g. '1.6'). Recorded
--                         because the schema of `questions` changes between
--                         versions — 1.5 moved distractor analysis onto the
--                         option, 1.6 added four Source360 fields.
--   * date                timestamptz NOT NULL, default now().
--
-- RLS: fails closed, matching mahoti_laws and open_questions. Admin-only
-- while this is authoring-side content; the service role used by the
-- generator bypasses RLS.

CREATE TABLE IF NOT EXISTS public.mahoti_question (
  mahoti_question_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  question_notebook   jsonb        NOT NULL,
  questions           jsonb        NULL,
  question_review     jsonb        NULL,
  params_version      text         NULL,
  date                timestamptz  NOT NULL DEFAULT now()
);

-- Listing newest-first, and finding the rows still awaiting generation.
CREATE INDEX IF NOT EXISTS idx_mahoti_question_date
  ON public.mahoti_question (date DESC);
CREATE INDEX IF NOT EXISTS idx_mahoti_question_pending
  ON public.mahoti_question (date DESC) WHERE questions IS NULL;

-- Which laws a notebook drew on, for coverage queries across runs
-- ("which laws have never been sampled?").
CREATE INDEX IF NOT EXISTS idx_mahoti_question_notebook
  ON public.mahoti_question USING gin (question_notebook jsonb_path_ops);

ALTER TABLE public.mahoti_question ENABLE ROW LEVEL SECURITY;

-- Admin-only. No index for the policy predicate: is_admin() reads profiles,
-- not a column of this table (Hardening Rule 2 covers columns named in
-- USING/CHECK, and there are none here).
CREATE POLICY mahoti_question_admins_select
  ON public.mahoti_question FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY mahoti_question_admins_insert
  ON public.mahoti_question FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY mahoti_question_admins_update
  ON public.mahoti_question FOR UPDATE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.mahoti_question TO authenticated;
