-- Put the study-material paywall in the database, where the other paid
-- surfaces already keep theirs.
--
-- THE HOLE. study_material_public (20260928000002, re-created by
-- 20260930000001) is granted to `authenticated` with no subscription
-- predicate:
--
--   GRANT SELECT ON public.study_material_public TO authenticated;
--
-- and the view is deliberately NOT security_invoker, so it reads the
-- admin-only base table under its owner's rights. That is correct and is how
-- `original_text` stays hidden — but it means the only thing standing between
-- a signed-in non-subscriber and the whole library was the redirect in
-- app/(app)/layout.tsx. Any session could skip the app entirely:
--
--   GET /rest/v1/study_material_public
--
-- Every other paid surface already gates in the database:
-- users_own_exam_sessions and users_own_attempts_with_subscription both call
-- public.has_active_subscription(). This brings the view into line, and with
-- CLAUDE.md's own rule — "RLS-first: authorization is enforced in the
-- database, not only in app code".
--
-- It is also what lib/auth/subscription-gate.ts:24-28 already says should
-- happen: the RLS layer is "the REAL boundary, at the database, and it is not
-- something an app-level flag should be able to switch off."
--
-- WHY A PREDICATE IN THE VIEW RATHER THAN A POLICY. RLS policies attach to
-- tables, not views, and this view exists precisely to bypass the base table's
-- admin-only policy. The WHERE clause is the view's equivalent of a policy, so
-- the gate goes there. has_active_subscription() is STABLE, so the planner
-- evaluates it once per query rather than per row.
--
-- auth.uid() still resolves to the CALLER inside a non-invoker view — it reads
-- the request's JWT claims, not the view owner's identity — so the subscription
-- being checked is the reader's.
--
-- ADMINS ARE EXEMPT, which is the one addition to the shape used elsewhere.
-- On the tables, admin access is a SECOND policy (admins_view_exam_sessions
-- beside the user one). A view has no policies to add, so the admin allowance
-- has to be an OR in the predicate. Without it an admin with no subscription
-- would open the candidate-facing page and find it empty. is_admin() is itself
-- safe to lean on again as of 20261001000009, which stopped users writing
-- profiles.is_admin.
--
-- EFFECT WHILE THE PAYWALL SWITCH IS OFF. SUBSCRIPTION_GATE_ENABLED is
-- currently false, so nobody is forced through /pricing and some accounts have
-- no subscription row. Those accounts will now see the study-material index as
-- empty and a direct document link as 404 — the same thing that already
-- happens to them on exam and practice content, which has gated in the
-- database since 20260503000005. This was the operator's explicit decision on
-- 2026-10-01: enforce now, consistently, rather than leave one paid surface
-- open.
--
-- NOT DESTRUCTIVE: CREATE OR REPLACE on a view. Same columns, same order, same
-- types; no row or column is touched and the base table is untouched.
-- Re-runnable. To reverse it, re-run 20260930000001.

CREATE OR REPLACE VIEW public.study_material_public AS
SELECT
  study_material_id,
  paper_id,
  text_field,
  -- rewrite-source.mjs wraps the document in run metadata (contract version,
  -- model, cost). The candidate wants the document; the metadata is an
  -- operational record and stays behind the admin table.
  lawpass_text -> 'doc' AS doc,
  updated_at
FROM public.study_material
WHERE lawpass_text IS NOT NULL
  -- Absent provenance reads as 'approved', so rows written before the
  -- publication gate existed are unaffected. Only an explicit hold takes a row
  -- out. (20260930000001)
  AND COALESCE(lawpass_text -> 'provenance' ->> 'publication', 'approved') = 'approved'
  -- The paywall. Everything above decides whether a row MAY be published; this
  -- decides whether the person asking may read it.
  AND (public.is_admin() OR public.has_active_subscription());

COMMENT ON VIEW public.study_material_public IS
  'The LawPass-authored half of study_material, for candidate-facing reads. original_text is deliberately absent: RLS cannot hide a column, so the safe subset is expressed as a view. Rows without a conversion are excluded, as are rows whose lawpass_text provenance marks publication as pending. Readable only by an active subscriber or an admin (20261001000011) — the paywall is enforced here, not only in app code.';

-- Unchanged, and still needed: the predicate above decides WHO reads, the
-- grant decides that the role may reach the view at all.
GRANT SELECT ON public.study_material_public TO authenticated;
