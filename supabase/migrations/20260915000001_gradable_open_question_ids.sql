-- Which writing-task questions can actually be marked.
--
-- A question is gradable only if it has an APPROVED rubric — getGradingContext
-- in lawpass_server/db/grading.js refuses to mark against anything else, by
-- design: a draft rubric is generated text nobody has read. But nothing stopped
-- a DRAFT-rubric question from being offered to students. 2026-S-Q1-G was
-- loaded by generate_sets.mjs with its rubric as a draft, appeared in the
-- subject picker straight away, and a student sat it and filed an answer that
-- then failed grading — and would have failed identically on every retry.
--
-- WHY A FUNCTION RATHER THAN A JOIN. The student's queries run under their own
-- RLS-scoped client, and open_question_rubrics is admin-only
-- (20260817000004): a student may not read a rubric, which is correct — it is
-- the marking scheme. So a join from open_questions to the rubrics through that
-- client does not filter the list, it EMPTIES it, because every rubric row is
-- invisible. This function runs as its owner to look past that policy, and
-- returns only question ids: whether a question can be marked is not secret;
-- what it will be marked against is, and nothing of the rubric leaves here.
--
-- SECURITY DEFINER with an empty search_path, so a caller cannot put a
-- same-named table ahead of public.open_question_rubrics and have this function
-- read it with the owner's rights. Every name below is schema-qualified for the
-- same reason.
--
-- No index added: open_question_rubrics holds one row per generated question
-- (tens), and a filter on it is a sequential scan of a page.

CREATE OR REPLACE FUNCTION public.gradable_open_question_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT r.open_question_id
  FROM public.open_question_rubrics AS r
  WHERE r.status = 'approved'
$$;

COMMENT ON FUNCTION public.gradable_open_question_ids() IS
  'Ids of open questions with an approved rubric — the ones the grader can mark. Returns ids only; rubric content stays behind its admin-only policy.';

-- Functions are executable by PUBLIC by default. Revoke that and grant only the
-- roles that call it: signed-in students through PostgREST, and the service
-- role the API server and worker use.
REVOKE ALL ON FUNCTION public.gradable_open_question_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gradable_open_question_ids() TO authenticated, service_role;
