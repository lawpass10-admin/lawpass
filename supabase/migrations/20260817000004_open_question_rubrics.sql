-- open_question_rubrics — the per-question marking scheme (מחוון) that grading
-- runs against.
--
-- WHY A SEPARATE TABLE RATHER THAN A COLUMN ON open_questions.
-- A rubric is answer-key material: it lists what a full answer contains, item by
-- item, with the points attached. open_questions carries a student SELECT policy
-- (open_questions_students_select, type='new'), and RLS is ROW-level — a policy
-- that lets a student read the row lets them read every column of it. The
-- server's query allowlist keeps `answers` and the writer-only question fields
-- out of the API response, but that is application code, not the database. A
-- rubric column on that table would be one direct PostgREST call away from the
-- browser. Here there is no student policy at all, so no student token can reach
-- it under any query.
--
-- Columns:
--   * rubric_id         uuid PK.
--   * open_question_id  uuid -> open_questions. ON DELETE CASCADE: a rubric for
--                       a question that no longer exists grades nothing.
--   * rubric            jsonb NOT NULL. The artifact written by
--                       lawpass_server/scripts/generate-rubric.js — challenges,
--                       the לשון/ארגון bands, the 12 content items, deductions.
--   * status            draft -> approved -> retired. Only `approved` is
--                       gradeable; see the unique index below.
--   * version           1 upward per question. A rubric is never edited in place
--                       once answers have been graded with it — the old row is
--                       retired and a new version inserted, so an existing grade
--                       can always be traced to the exact text that produced it.
--   * approved_by/at    who signed it off. A machine-written rubric decides real
--                       marks; the row records that a human read it.
--
-- The point invariants (content items summing to exactly 12, band edges, id
-- sequence) are enforced by the generator and the loader, not by a CHECK: they
-- are structural facts about a jsonb document, and expressing them in SQL costs
-- more than it catches when the only writers are those two scripts.

CREATE TABLE IF NOT EXISTS public.open_question_rubrics (
  rubric_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  open_question_id  uuid         NOT NULL REFERENCES public.open_questions(open_question_id) ON DELETE CASCADE,
  rubric            jsonb        NOT NULL,
  status            text         NOT NULL DEFAULT 'draft'
    CONSTRAINT open_question_rubrics_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  version           integer      NOT NULL DEFAULT 1,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  approved_at       timestamptz  NULL,
  approved_by       uuid         NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- At most ONE approved rubric per question. This is the invariant the grader
-- depends on: "the rubric for this question" has to resolve to exactly one row,
-- or two students sitting the same task get marked against different schemes.
-- Drafts and retired versions are unconstrained — that is where revisions live.
CREATE UNIQUE INDEX IF NOT EXISTS idx_open_question_rubrics_one_approved
  ON public.open_question_rubrics (open_question_id)
  WHERE status = 'approved';

-- The grading lookup: question -> its approved rubric.
CREATE INDEX IF NOT EXISTS idx_open_question_rubrics_question
  ON public.open_question_rubrics (open_question_id, status);

ALTER TABLE public.open_question_rubrics ENABLE ROW LEVEL SECURITY;

-- Admins only, all four verbs. There is deliberately NO policy for the ordinary
-- authenticated student: without one, RLS denies every row, so a student token
-- reading this table directly gets an empty set rather than the answer key.
-- Grading runs server-side under the service-role key, which bypasses RLS.
CREATE POLICY open_question_rubrics_admins_select
  ON public.open_question_rubrics FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY open_question_rubrics_admins_insert
  ON public.open_question_rubrics FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY open_question_rubrics_admins_update
  ON public.open_question_rubrics FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY open_question_rubrics_admins_delete
  ON public.open_question_rubrics FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_question_rubrics TO authenticated;

COMMENT ON TABLE public.open_question_rubrics
  IS 'Per-question marking scheme (מחוון) for the writing task. Answer-key material: admin-only by RLS, never exposed to students.';
COMMENT ON COLUMN public.open_question_rubrics.status
  IS 'draft = written, unreviewed, not gradeable. approved = signed off, at most one per question. retired = superseded, kept so old grades stay traceable.';
