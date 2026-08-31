-- diuni_questions — one row per generated דין דיוני paper: the questions and
-- the review content for those same questions.
--
-- Pipeline: verdict_list (scraped judgments) -> diuni-LLM-Params -> generator
-- -> this table. The sibling of mahoti_questions, and deliberately the same
-- shape so both study screens read the same way:
--
--     mahoti_questions              diuni_questions
--     ----------------              ---------------
--     question_notebook  jsonb      verdict_ids  uuid[]     <- see below
--     questions          jsonb      questions    jsonb      (same shape)
--     question_review    jsonb      question_review jsonb   (same shape)
--
-- WHAT REPLACES THE NOTEBOOK, AND WHY IT IS NOT A COPY OF THE JUDGMENTS.
-- mahoti keeps its notebook INSIDE the row because the notebook exists nowhere
-- else: it is a sampled subset of legislation assembled for that one paper, and
-- holding it beside the questions is what makes every quote checkable against
-- the exact material the model saw. A diuni paper's material is different — the
-- judgments are already rows in verdict_list, with their own text, their own
-- classification and their own id. Copying them in here would give us two
-- copies of a 19,000-character judgment that can drift apart, and the second
-- copy would be the one nobody re-scrapes.
--
-- So the provenance is a REFERENCE, not a copy: verdict_ids holds the judgments
-- the paper was built from. "Which judgment is question 7 grounded in" is a
-- join, and the grounding quotes stored on each question are checkable against
-- verdict_list.full_text->>'body' exactly as mahoti's are checkable against its
-- notebook. That is the whole of "similar to mahoti_questions without the
-- notebook".
--
-- Columns:
--   * question_id      uuid PK.
--   * verdict_ids      uuid[] NOT NULL. The judgments this paper draws on, in
--                      question order. NOT a foreign key: Postgres has no
--                      per-element FK on an array, and the alternative — a join
--                      table — buys referential integrity at the cost of making
--                      the common read ("give me this paper") a three-way join.
--                      A judgment is never deleted from verdict_list (the
--                      loader upserts, it does not remove), so the risk this
--                      would defend against does not arise. The GIN index below
--                      makes "which papers used this judgment" fast anyway.
--   * questions        jsonb NULL. The paper:
--                        { "exam": { "title", "generated_at", "question_count" },
--                          "questions": [ { "number", "fact_pattern", "stem",
--                                           "options": [ { "letter", "text" } ],
--                                           "correct_answer",
--                                           "sources": [ … ] }, … ] }
--                      Same shape mahoti uses, so lib/db/mahoti.ts's stripAnswers
--                      discipline ports across unchanged: `correct_answer` lives
--                      in the row and is removed server-side before the paper
--                      reaches a browser.
--                      NULL is a legal intermediate state — a row can be created
--                      before its questions are generated, as mahoti's is.
--   * question_review  jsonb NULL. One entry per question, aligned to
--                      `questions` by `number`:
--                        { "questions": [ { "number", "legal_topic_analysis",
--                                           "explanation", "common_pitfall",
--                                           "quick_thinking_360",
--                                           "summary_for_memory",
--                                           "concepts_and_skills",
--                                           "distractor_analysis" }, … ] }
--                      Field names follow mahoti's StoredReview EXACTLY —
--                      note `explanation`, not `full_explanation`. The
--                      Learning360Panel maps it to full_explanation on read, and
--                      a row that spells it the panel's way would render an
--                      empty "הסבר משפטי מלא" section with no error anywhere.
--                      `quick_thinking_360` is the panel's string format:
--                      `**וריאציה N — title:** question ← answer`, one per line.
--   * generation_meta  jsonb NULL. Model, effort, prompt_version, the exemplars
--                      shown, and token usage — a snapshot, because
--                      diuni-LLM-Params.json is a live file that keeps no
--                      history. Mirrors open_questions.generation_meta.
--   * created_at       timestamptz. When the row was first written; a re-load
--                      of the same paper refreshes the payloads and leaves this
--                      standing.
--
-- The two jsonb payloads are split, not merged: the candidate-facing paper can
-- be served from `questions` alone without shipping the answers' reasoning to
-- the client, while the review screen reads both columns of the one row it
-- already has.
--
-- RLS: fails closed, matching mahoti_questions, mahoti_laws and open_questions.
-- Admin-only — this is authoring-side content, and the service role used by the
-- loader bypasses RLS.

CREATE TABLE IF NOT EXISTS public.diuni_questions (
  question_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  verdict_ids      uuid[]       NOT NULL DEFAULT '{}',
  questions        jsonb        NULL,
  question_review  jsonb        NULL,
  generation_meta  jsonb        NULL,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- "Which papers were built on this judgment" — the coverage question, and the
-- one that stops the same judgment being mined twice without anyone noticing.
CREATE INDEX IF NOT EXISTS idx_diuni_questions_verdict_ids
  ON public.diuni_questions USING gin (verdict_ids);

-- Listing newest-first, and finding rows still awaiting generation.
CREATE INDEX IF NOT EXISTS idx_diuni_questions_created_at
  ON public.diuni_questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diuni_questions_pending
  ON public.diuni_questions (created_at DESC) WHERE questions IS NULL;

ALTER TABLE public.diuni_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only. Hardening Rule #2 asks for an index on every column named in a
-- USING/CHECK clause; is_admin() reads profiles rather than any column of this
-- table, so there is none to index here.
DROP POLICY IF EXISTS diuni_questions_admins_select ON public.diuni_questions;
DROP POLICY IF EXISTS diuni_questions_admins_insert ON public.diuni_questions;
DROP POLICY IF EXISTS diuni_questions_admins_update ON public.diuni_questions;

CREATE POLICY diuni_questions_admins_select
  ON public.diuni_questions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY diuni_questions_admins_insert
  ON public.diuni_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY diuni_questions_admins_update
  ON public.diuni_questions FOR UPDATE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.diuni_questions TO authenticated;

COMMENT ON TABLE public.diuni_questions
  IS 'One row per generated דין דיוני paper: questions + review, grounded in the judgments named by verdict_ids. Sibling of mahoti_questions; the notebook is replaced by a reference into verdict_list.';
COMMENT ON COLUMN public.diuni_questions.verdict_ids
  IS 'verdict_list.verdict_id values the paper draws on, in question order.';
COMMENT ON COLUMN public.diuni_questions.question_review
  IS 'Aligned to questions by `number`. Field names follow mahoti StoredReview — note `explanation`, not `full_explanation`.';
