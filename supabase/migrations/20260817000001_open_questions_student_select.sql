-- open_questions — let students read the questions.
--
-- The follow-up that 20260816000001_open_questions.sql anticipated: that
-- migration deliberately failed closed (admins only) "while this is
-- authoring-only content", and left a note to add a SELECT policy for the
-- `authenticated` role when the student-facing HTML page ships. It ships here
-- (/writing-task), so the policy lands here.
--
-- READ ONLY, AND type='new' ONLY. The existing admins_insert / admins_update
-- policies are untouched, so a student can select rows and nothing else;
-- writing stays admin-only and the ingestion scripts keep bypassing RLS via the
-- service-role key.
--
-- The type filter is the point of doing this in RLS rather than only in the
-- query. 'source' rows are the real exam papers, kept here as INPUT to the
-- offline generator: handing one to a student would set them a past paper whose
-- official model answer is published. The server's queries filter on type too,
-- but a filter in application code is one forgotten `.eq()` away from leaking;
-- here the database refuses, for every caller and every future endpoint.
-- Admins keep full read access through open_questions_admins_select, so the
-- admin tooling and the generator pipeline are unaffected.
--
-- The SELECT grant to `authenticated` is already in place from the first
-- migration, so there is no new GRANT here — only the row-level policy that
-- decides which rows that grant can actually reach.
--
-- ⚠ EVERY ROW IN THIS TABLE IS CURRENTLY A DRAFT. The generator writes
-- question.status = 'draft' and nothing flips it; this policy therefore exposes
-- unreviewed, machine-written questions to any signed-in user. That is fine
-- while the page is being built and while the only signed-in users are the
-- team. Before real students arrive, tighten the USING clause below rather than
-- filtering in app code — the database then enforces it for every caller:
--
--   USING (type = 'new' AND question->>'status' = 'approved')
--
-- and have whatever approves a question set that field.

-- DROP first so re-applying this file is safe (CREATE POLICY has no
-- IF NOT EXISTS, and this migration was revised after its first version).
DROP POLICY IF EXISTS open_questions_students_select ON public.open_questions;

CREATE POLICY open_questions_students_select
  ON public.open_questions FOR SELECT TO authenticated
  USING (type = 'new');
