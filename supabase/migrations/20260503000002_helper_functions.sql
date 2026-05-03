-- Migration 0002: Helper Functions
-- SECURITY DEFINER functions used by RLS policies (SPEC 19.3.3).

-- is_admin(): checks if the current authenticated user is an admin.
-- SECURITY DEFINER bypasses RLS on the profiles table itself,
-- so this function can be called from any RLS policy without circular dependency.
-- STABLE = safe to cache within a single statement.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = TRUE
  );
END;
$$;

-- has_active_subscription(): checks if the current user has a valid subscription.
-- Used by RLS policies on content and activity tables.
CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = (SELECT auth.uid())
      AND is_current = TRUE
      AND status = 'active'
      AND ends_at > NOW()
  );
END;
$$;

-- updated_at trigger function: auto-sets updated_at on UPDATE.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
