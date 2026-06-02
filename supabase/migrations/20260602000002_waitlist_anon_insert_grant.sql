-- Slice 45 — corrective grant for the /early-access waitlist write path.
--
-- The PM already applied this GRANT to the live database. This migration file
-- keeps the repo's history matching live so `supabase db reset` reproduces the
-- working state (the RLS policy alone permits the INSERT, but the role's table-
-- level INSERT privilege must also be granted on top of RLS; the first
-- waitlist migration only created the policy, not the underlying GRANT).
--
-- DO NOT run `supabase db push` against this file.

GRANT INSERT ON public.waitlist_signups TO anon;
