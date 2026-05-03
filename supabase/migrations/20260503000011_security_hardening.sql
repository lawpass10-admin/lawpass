-- Migration 0011: Security advisor fixes

-- Fix 1 — Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public.
-- They should only be callable from inside RLS policies, never via REST /rpc/.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription() FROM PUBLIC, anon, authenticated;

-- Fix 2 — Add search_path to handle_updated_at trigger function.
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;

-- Fix 3 — Move pg_trgm and btree_gist out of public schema.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

-- Grant usage on extensions schema to roles that need it.
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
