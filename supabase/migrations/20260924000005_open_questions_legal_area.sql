-- Put the legal area on the QUESTION, not only on its subject.
--
-- WHY. Area is currently derived: open_questions.subject -> the row for it in
-- open_question_subject_areas. That is right for most questions and wrong for
-- the ones that do not follow their subject — a task built on תקנות סדר הדין
-- האזרחי can be a labour matter, and a task built on a judgment can be about
-- anything. The subject says which law the paper was drawn from; the area says
-- what kind of proceeding the candidate is writing into, and those are not the
-- same fact.
--
-- The derived path stays as the DEFAULT. This column overrides it when set, so
-- the mapping table keeps doing the work for the ordinary case and nobody has
-- to fill this in for every question — it exists for the exceptions, and for an
-- ingestion pipeline that knows the area outright.
--
-- Backfilled from the subject mapping, so behaviour is unchanged the moment
-- this lands: every question that resolved to an area still resolves to the
-- same one, now without the join.

ALTER TABLE public.open_questions
  ADD COLUMN IF NOT EXISTS legal_area text
    REFERENCES public.open_question_legal_areas (legal_area);

UPDATE public.open_questions q
   SET legal_area = sa.legal_area
  FROM public.open_question_subject_areas sa
 WHERE sa.subject = q.subject
   AND q.legal_area IS NULL;

CREATE INDEX IF NOT EXISTS idx_open_questions_legal_area
  ON public.open_questions (legal_area);

COMMENT ON COLUMN public.open_questions.legal_area IS
  'The kind of proceeding this task is written into, which decides the writing skeletons offered. Overrides the subject -> area mapping in open_question_subject_areas; NULL falls back to it. Backfilled from that mapping in 20260924000005.';
