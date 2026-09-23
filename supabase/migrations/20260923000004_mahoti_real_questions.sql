-- The real דין מהותי questions, as a pool a generated paper can draw from.
--
-- The מהותי twin of diuni_real_questions (20260923000001), and deliberately
-- the same shape: 157 questions written by the lawyers who set the Bar's own
-- חלק ג' papers, from four sittings — קיץ 2022, חורף 2022, קיץ 2023 and
-- חורף 2023-2024 — each with the letter the Bar published as correct and the
-- provision its key cites for it. A 40-question generated paper mixes some of
-- them in, so part of every exam is the real thing rather than an imitation.
--
-- NOT A CANDIDATE-FACING TABLE. Nothing a student reads points here. A drawn
-- question is COPIED into the paper's own questions payload, exactly as a
-- generated one is, so the study screen keeps reading one shape from one place.
-- RLS is admin-only, mirroring mahoti_questions and diuni_real_questions.
--
-- Filled by scripts/mahoti/load-real-questions.mjs from
-- scripts/mahoti/real-questions.json, which scripts/mahoti/extract-real-questions.mjs
-- builds out of the Bar's own PDFs (paper + פתרון) in one pass.
--
-- מועד דצמבר 2025 is missing on purpose: the exam bank holds its paper but not
-- its answer key, and correct_answer is NOT NULL here because a pooled question
-- a candidate cannot be marked on is not a question. It joins the pool when the
-- key turns up.

CREATE TABLE IF NOT EXISTS public.mahoti_real_questions (
  real_question_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which sitting this question came from ("2024-02-12") and its number in that
  -- paper. Together they identify the question, so re-running the loader
  -- refreshes rows instead of duplicating them.
  paper            text        NOT NULL,
  number           integer     NOT NULL,

  -- A passage several questions of the paper shared ("קראו את הקטע שלהלן
  -- והשיבו על 3 השאלות הבאות"), copied onto each of them so that a question
  -- drawn ALONE is still answerable. Where the paper instead chained two
  -- questions ("ענו על 2 השאלות הקשורות זו לזו"), the second one's passage
  -- carries the first one's facts, for the same reason: the extractor resolves
  -- the dependency so the pool never holds a question that needs a neighbour.
  -- NULL for the great majority, which stand alone in the source paper too.
  shared_passage   text,
  -- The run this question belonged to IN THE SOURCE PAPER, e.g. {10,11,12}.
  -- A record of the paper, not an instruction to the assembler: every row is
  -- self-contained, and an annulled member of a run is simply absent here.
  linked_numbers   integer[],

  -- NULL for a pure knowledge question — "שלושת מבחני העזר לקביעת קיומו של קשר
  -- סיבתי משפטי בתביעת רשלנות בנזיקין הם:" has a stem and no facts, and 16 of
  -- the 157 are of that kind. Rejecting them would lose real exam questions
  -- over their punctuation.
  fact_pattern     text,
  stem             text        NOT NULL,
  -- [{ "letter": "א", "text": "…" }, …] — the same shape a generated question
  -- carries, so the assembler copies it across untouched.
  options          jsonb       NOT NULL,
  correct_answer   text        NOT NULL,
  -- The provision the paper's key cites for the answer, as printed. Kept
  -- verbatim, bidi damage and all: it is a record of the source paper, not a
  -- display string, and repairing it here would make it disagree with the PDF.
  source_citation  text,

  -- mahoti_laws.law_id of the law the answer turns on, for the dashboard's
  -- תחום התמחות charts — the same use diuni_real_questions puts it to
  -- (20260923000002). NULL until mapped by hand from source_citation, which
  -- reads as "not yet classified" rather than as a guess.
  law_id           integer,
  law_name         text,

  -- The nine-section 360° review, written once and reused by every paper that
  -- draws this question. NULL until that has run, and the assembler will not
  -- draw a question whose review is NULL: a real question without a review
  -- would reach a student as an exam question with nothing behind it.
  review           jsonb,

  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mahoti_real_questions_paper_number_key UNIQUE (paper, number),
  -- Four options, one correct letter. The check is cheap and the alternative is
  -- a paper that renders three answers or none.
  CONSTRAINT mahoti_real_questions_answer_letter
    CHECK (correct_answer IN ('א', 'ב', 'ג', 'ד')),
  CONSTRAINT mahoti_real_questions_four_options
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4)
);

-- No index beyond the key. The table is ~160 rows and the assembler reads all
-- of the reviewed ones in one pass to draw from; an index would be read once
-- and maintained forever for nothing.

ALTER TABLE public.mahoti_real_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only, exactly as mahoti_questions (20260823000003) and
-- diuni_real_questions. These are unseen exam questions: a candidate who could
-- read this table could read the answer to every real question the generator
-- might put in front of them. Hardening Rule 2 asks for an index on every
-- column named in a USING/CHECK clause; is_admin() reads profiles rather than
-- any column of this table, so there is none to add.
CREATE POLICY mahoti_real_questions_admins_select
  ON public.mahoti_real_questions FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY mahoti_real_questions_admins_insert
  ON public.mahoti_real_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY mahoti_real_questions_admins_update
  ON public.mahoti_real_questions FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY mahoti_real_questions_admins_delete
  ON public.mahoti_real_questions FOR DELETE TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.mahoti_real_questions IS
  'Real Bar-exam דין מהותי questions, drawn from by generated papers. Admin-only; a drawn question is copied into the paper it appears in.';
COMMENT ON COLUMN public.mahoti_real_questions.shared_passage IS
  'Passage the source paper shared across a run of questions, copied onto each so a question drawn alone is still answerable. NULL when the question stood alone.';
COMMENT ON COLUMN public.mahoti_real_questions.law_id IS
  'mahoti_laws.law_id of the law the answer turns on, for the dashboard topic charts. NULL = not yet classified.';
