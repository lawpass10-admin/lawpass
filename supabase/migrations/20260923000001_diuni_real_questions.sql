-- The real דין דיוני questions, as a pool a generated paper can draw from.
--
-- WHAT THESE ARE. 106 questions written by the lawyers who set the Bar's own
-- papers, extracted from three sittings' PDFs
-- (scripts/diuni/extract-exam-pdf.mjs -> exemplars.json). Until now they lived
-- only as a file the generator was shown for STYLE. This table makes them
-- content: a 40-question paper mixes in 5-10 of them, so part of every exam is
-- the real thing rather than an imitation of it.
--
-- WHY A TABLE AND NOT THE FILE. The assembler runs against the database and has
-- to draw a different handful each time, record which ones it drew, and know
-- which of them already carry a 360° review. A JSON file on the generating
-- machine can do none of that, and the review — see `review` below — is written
-- once per question and reused by every paper that draws it.
--
-- NOT A CANDIDATE-FACING TABLE. Nothing a student reads points here. A drawn
-- question is COPIED into the paper's own `questions` payload by
-- load-diuni-questions.mjs, exactly as a generated one is, so the study screen
-- keeps reading one shape from one place. RLS is admin-only, mirroring
-- diuni_questions.

CREATE TABLE IF NOT EXISTS public.diuni_real_questions (
  real_question_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which sitting this question came from ("2026-06-23") and its number in that
  -- paper. Together they identify the question, so re-running the loader
  -- refreshes rows instead of duplicating them.
  paper            text        NOT NULL,
  number           integer     NOT NULL,

  fact_pattern     text        NOT NULL,
  stem             text        NOT NULL,
  -- [{ "letter": "א", "text": "…" }, …] — the same shape a generated question
  -- carries, so the assembler copies it across untouched.
  options          jsonb       NOT NULL,
  correct_answer   text        NOT NULL,
  -- The provision the paper cites for the answer, as printed. Kept verbatim,
  -- bidi damage and all: it is a record of the source paper, not a display
  -- string, and repairing it here would make it disagree with the PDF.
  source_citation  text,

  -- The nine-section 360° review, written once by
  -- scripts/diuni/generate-real-reviews.mjs and reused by every paper that
  -- draws this question. NULL until that has run, and the assembler will not
  -- draw a question whose review is NULL: a real question without a review
  -- would reach a student as an exam question with nothing behind it.
  review           jsonb,

  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT diuni_real_questions_paper_number_key UNIQUE (paper, number),
  -- Four options, one correct letter. The check is cheap and the alternative is
  -- a paper that renders three answers or none.
  CONSTRAINT diuni_real_questions_answer_letter
    CHECK (correct_answer IN ('א', 'ב', 'ג', 'ד')),
  CONSTRAINT diuni_real_questions_four_options
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4)
);

-- No index beyond the key. The table is ~100 rows and the assembler reads all
-- of the reviewed ones in one pass to draw from; an index would be read once
-- and maintained forever for nothing.

ALTER TABLE public.diuni_real_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only, exactly as diuni_questions (20260831000003). These are unseen
-- exam questions: a candidate who could read this table could read the answer
-- to every real question the generator might put in front of them.
CREATE POLICY diuni_real_questions_admins_select
  ON public.diuni_real_questions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY diuni_real_questions_admins_insert
  ON public.diuni_real_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY diuni_real_questions_admins_update
  ON public.diuni_real_questions FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY diuni_real_questions_admins_delete
  ON public.diuni_real_questions FOR DELETE TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.diuni_real_questions IS
  'Real Bar-exam דין דיוני questions, drawn from by generated papers. Admin-only; a drawn question is copied into the paper it appears in.';
