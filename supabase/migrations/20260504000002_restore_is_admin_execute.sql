-- Migration 0015: Restore EXECUTE on is_admin / has_active_subscription
--
-- Migration 0011_security_hardening.sql lines 5-6 revoked EXECUTE on these
-- two SECURITY DEFINER functions from `authenticated` (and PUBLIC, anon),
-- with the comment "should only be callable from inside RLS policies, never
-- via REST /rpc/". That reasoning is wrong: PostgreSQL evaluates RLS
-- policies in the *caller's* role context, so callers MUST have EXECUTE on
-- any function the policy invokes. Without it, every RLS policy that uses
-- `public.is_admin()` (profiles, subscriptions, attempts, admin_actions_log,
-- ...) silently fails for non-admin users with code 42501 ("permission
-- denied for function is_admin"). Same for `public.has_active_subscription()`
-- which gates content/activity reads.
--
-- The SECURITY DEFINER attribute on both functions still bounds what the
-- function body can do — they run as the function owner, not the caller.
-- Granting EXECUTE only changes who can *invoke* the function, not what it
-- can read. The /rpc/ exposure concern from 0011 is mitigated by the fact
-- that both functions return only a boolean about the current authenticated
-- user, which the user already knows.
--
-- Surfaced during Phase 3 manual signup test 2026-05-04: createProfile's
-- SELECT-then-INSERT idempotency check failed with 42501, breaking signup.
-- Same trigger affects (app)/layout.tsx's profile + subscription existence
-- checks (silent, returning null and causing wrong redirects).

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;
