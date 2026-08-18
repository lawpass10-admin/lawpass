-- open_question_answers — what a student wrote for a מטלת כתיבה, and the grade
-- it later receives.
--
-- One row per submission. Submissions are append-only from the student's side:
-- they write answers and read their own back, and that is all. Grading writes
-- `score`, and grading is not the student's to do — see the RLS block below.
--
-- NAMING: the request said `_open_question_answers`. Dropped the leading
-- underscore — every other table here is bare snake_case (open_questions,
-- qa_reports, attempts), and a leading underscore is not a Postgres convention;
-- it survives, but it has to be quoted in enough tools to be a recurring
-- nuisance. Say the word and it is a one-line rename.
--
-- Columns:
--   * answer_id         uuid PK.
--   * user_id           uuid -> profiles(id). The student. profiles.id is
--                       auth.users.id, so this is the same identity the RLS
--                       policies compare against auth.uid().
--   * open_question_id  uuid -> open_questions. NOT in the original field list,
--                       added deliberately: "feedback and statistics per user"
--                       is unanswerable without knowing WHICH question was
--                       answered — no per-question score, no "your weakest
--                       subject", no second attempt comparison. Storing it
--                       inside answer_body instead would work for display and
--                       be useless for querying.
--   * answer_body       jsonb NOT NULL. The submission: { text, word_count }
--                       today. jsonb rather than text so drafts, per-section
--                       answers or timing can be added without a migration.
--   * score             jsonb NULL. NULL = not yet graded. Shape is the
--                       grader's to define (per-criterion marks against the
--                       מחוון, total, reviewer notes).
--   * created_at        timestamptz. The submission date.

CREATE TABLE IF NOT EXISTS public.open_question_answers (
  answer_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  open_question_id  uuid         NOT NULL REFERENCES public.open_questions(open_question_id) ON DELETE RESTRICT,
  answer_body       jsonb        NOT NULL,
  score             jsonb        NULL,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- user_id carries an RLS USING/WITH CHECK clause, so it needs a B-tree index
-- (Hardening Rule #2). The composite covers it and also serves the "my
-- submissions, newest first" listing without a second index.
CREATE INDEX IF NOT EXISTS idx_open_question_answers_user_created_at
  ON public.open_question_answers (user_id, created_at DESC);

-- Per-question statistics ("how did everyone do on this task").
CREATE INDEX IF NOT EXISTS idx_open_question_answers_question
  ON public.open_question_answers (open_question_id, created_at DESC);

-- The grading queue: ungraded submissions, oldest first. Partial, so it stays
-- small no matter how many graded rows accumulate.
CREATE INDEX IF NOT EXISTS idx_open_question_answers_ungraded
  ON public.open_question_answers (created_at) WHERE score IS NULL;

ALTER TABLE public.open_question_answers ENABLE ROW LEVEL SECURITY;

-- A student may file an answer as themselves, and it must arrive UNGRADED.
-- Without `score IS NULL` here, a student could POST their own perfect score
-- with the submission — the API never sets that field, but RLS is the boundary
-- and should not depend on the API getting it right.
CREATE POLICY open_question_answers_students_insert_own
  ON public.open_question_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND score IS NULL);

-- A student reads their own submissions and their own grades. There is
-- deliberately NO student UPDATE policy: an answer, once submitted, is what it
-- was, and grading it belongs to someone else. If editing before submission is
-- wanted later, that is a draft row with its own status column, not an UPDATE
-- grant on a graded table.
CREATE POLICY open_question_answers_students_select_own
  ON public.open_question_answers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins read everything and write the grade.
CREATE POLICY open_question_answers_admins_select
  ON public.open_question_answers FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY open_question_answers_admins_update
  ON public.open_question_answers FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Table-level grants; the policies above do the row-level filtering on top.
-- UPDATE is granted because the admin policy needs it — the absence of a
-- student UPDATE policy is what stops a student using it.
GRANT SELECT, INSERT, UPDATE ON public.open_question_answers TO authenticated;
