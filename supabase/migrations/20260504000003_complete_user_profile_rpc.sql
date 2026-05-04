-- Migration 0017: complete_user_profile RPC
--
-- Centralizes profile-row creation as a SECURITY DEFINER function called from
-- both the email/password flow (verifyOtpAction in app/(auth)/_actions.ts) and
-- — when Phase 5 lands — the OAuth completion flow at /onboarding/complete-profile.
--
-- Why a function (vs the previous direct INSERT in app code):
--   - Single source of truth for the profiles row contract. Adding a column
--     means updating one place, not two flows × N call sites.
--   - Defense-in-depth checks live next to the data: caller must be
--     authenticated, signup_source must be a known value, and (for email-
--     flow) the email must be confirmed before a profile is created.
--   - Phase 5 OAuth users skip OTP entirely; the same RPC handles them by
--     branching on p_signup_source.
--
-- SECURITY DEFINER bounds:
--   - search_path = public, pg_temp (prevents schema-shadowing attacks)
--   - Function can read auth.users (needs SECURITY DEFINER because the
--     authenticated role can't directly SELECT from auth schema)
--   - Function INSERTs into profiles bypassing RLS via SECURITY DEFINER, but
--     only the caller's own row (uses (SELECT auth.uid()) for id, never a
--     parameter). A malicious caller cannot create a profile for someone else.
--
-- Idempotency:
--   - ON CONFLICT (id) DO NOTHING. Concurrent calls and re-runs both succeed
--     with no error. Replaces the previous TS-side 23505 handling.

CREATE OR REPLACE FUNCTION public.complete_user_profile(
  p_full_name           TEXT,
  p_phone               TEXT,
  p_gender              TEXT,
  p_birth_date          DATE,
  p_exam_date_planned   DATE,
  p_terms_accepted_at   TIMESTAMPTZ,
  p_signup_source       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id         UUID := (SELECT auth.uid());
  v_email_confirmed TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_signup_source NOT IN ('email', 'google') THEN
    RAISE EXCEPTION 'invalid signup_source: %', p_signup_source;
  END IF;

  -- For email-flow users, the email must be confirmed before we'll create
  -- the profile. This is implicit in the call site (verifyOtpAction only
  -- reaches createProfile after a successful verifyOtp), but defense in
  -- depth: any caller who manages to invoke the RPC without going through
  -- verifyOtp would be rejected here.
  IF p_signup_source = 'email' THEN
    SELECT email_confirmed_at INTO v_email_confirmed
    FROM auth.users WHERE id = v_user_id;
    IF v_email_confirmed IS NULL THEN
      RAISE EXCEPTION 'email not confirmed';
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    gender,
    birth_date,
    exam_date_planned,
    terms_accepted_at,
    signup_source
  ) VALUES (
    v_user_id,
    p_full_name,
    p_phone,
    p_gender,
    p_birth_date,
    p_exam_date_planned,
    p_terms_accepted_at,
    p_signup_source
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default. Lock that down so only
-- authenticated callers can invoke this RPC. Anon callers would fail at the
-- auth.uid() IS NULL check anyway, but defense in depth.
REVOKE EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT
) TO authenticated;
