-- Let a signed-in candidate actually SELECT the writing skeletons.
--
-- THE BUG THIS FIXES. 20260503000014 revoked the blanket default privileges on
-- public and re-granted them table by table, deliberately: a blanket default
-- also covers materialized views, which bypass RLS. The consequence is that a
-- NEW table starts with no privileges for `authenticated` at all, and RLS
-- policies on it are never reached — a policy decides which ROWS a role may
-- read, after the role has been granted the right to read the table.
--
-- open_question_templates, open_question_subject_areas and
-- open_question_legal_areas (20260924000002, 20260924000003) were created with
-- SELECT policies but without grants. Every read from a candidate's own session
-- returned nothing, the writing task page fell through to its "no skeleton"
-- state, and nothing logged an error — a permission denial on the PostgREST
-- path reads as an empty result to the caller.
--
-- It was invisible to testing because the loader and every check ran as the
-- service role, which is granted everything and bypasses RLS. The rows were
-- always there; the candidate's role simply could not see the table.
--
-- SELECT ONLY, and only for `authenticated`. These are reference tables a
-- candidate reads while writing; nothing in the app writes to them from a
-- browser session, and the loader runs as the service role. `anon` gets
-- nothing — the writing task lives behind the subscription gate.

GRANT SELECT ON public.open_question_templates    TO authenticated;
GRANT SELECT ON public.open_question_subject_areas TO authenticated;
GRANT SELECT ON public.open_question_legal_areas   TO authenticated;
