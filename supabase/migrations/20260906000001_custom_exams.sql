-- Custom exams — "שאלון מותאם אישית", built by a candidate from questions that
-- already exist, rather than generated.
--
-- WHY A COLUMN AND NOT A NEW TABLE. public.mahoti_answers.question_id and
-- public.diuni_answers.question_id are FOREIGN KEYS into these two tables. A
-- custom exam kept anywhere else could not be sat: filing the attempt would
-- violate the constraint. Adding the exam as a row here means every existing
-- path keeps working unchanged — the study screen reads it by question_id, the
-- marking reads its answer key, the results screen reads the filed row.
--
-- WHAT built_for MEANS.
--   NULL           an authored paper. Shared content, shown to everyone.
--   <a user's id>  an exam that candidate built for themselves.
--
-- THIS COLUMN IS LOAD-BEARING, not a label. getMahotiSet()/getDiuniSet() answer
-- "no id given" with the NEWEST row, so without a way to exclude custom exams
-- the first one built would silently become the default paper served to every
-- other candidate. The readers filter on `built_for IS NULL`; this column is
-- what lets them.
--
-- Additive only: one nullable column and one partial index per table. No
-- existing row changes, nothing is dropped, and every existing paper keeps
-- built_for = NULL, which is exactly the "authored" meaning above.

-- ---------------------------------------------------------------- mahoti

ALTER TABLE public.mahoti_questions
  ADD COLUMN IF NOT EXISTS built_for uuid NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.mahoti_questions.built_for IS
  'NULL = an authored paper, shared with everyone. Otherwise the candidate who built this exam for themselves; readers must exclude these from the default paper.';

-- Partial: authored papers are the overwhelming majority and are found by
-- created_at, not by this column. Only the custom rows need to be looked up
-- by owner.
CREATE INDEX IF NOT EXISTS idx_mahoti_questions_built_for
  ON public.mahoti_questions (built_for)
  WHERE built_for IS NOT NULL;

-- ---------------------------------------------------------------- diuni

ALTER TABLE public.diuni_questions
  ADD COLUMN IF NOT EXISTS built_for uuid NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.diuni_questions.built_for IS
  'NULL = an authored paper, shared with everyone. Otherwise the candidate who built this exam for themselves; readers must exclude these from the default paper.';

CREATE INDEX IF NOT EXISTS idx_diuni_questions_built_for
  ON public.diuni_questions (built_for)
  WHERE built_for IS NOT NULL;

-- ------------------------------------------------------------------ RLS
--
-- Both tables stay admin-only for SELECT: the answer key lives in `questions`,
-- so a candidate who could read the row could read the answers to the exam they
-- are about to sit. Custom exams are served the same way authored papers are —
-- through the service-role client on the server, which strips `correct_answer`
-- before anything reaches the browser (see lib/db/mahoti.ts, lib/db/diuni.ts).
--
-- So there is deliberately NO new student-facing policy here. Ownership is
-- enforced by the server passing req.user.id when it reads a custom exam, the
-- same way marking is scoped today.
