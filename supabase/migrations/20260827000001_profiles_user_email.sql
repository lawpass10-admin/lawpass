-- profiles.user_email — the address the account was registered with, readable
-- alongside the rest of the profile.
--
-- WHY IT IS WORTH DUPLICATING. The address already exists, once, on
-- auth.users.email. But auth is a schema the `authenticated` role cannot
-- SELECT from, so today every screen that wants to show "who is this" either
-- reads the email off the session (only works for the person themselves) or
-- goes through the service role (admin tooling only). A column here makes
-- "list the students and their emails", "search by email" and "join answers to
-- an address" ordinary queries against a table the app already reads.
--
-- The cost of duplicating is that the copy can go stale, so this migration
-- does not leave that to chance:
--   * the copy is written by the database, never by the app (see the RPC
--     below) — an insert cannot disagree with auth.users because it is not
--     told what to write;
--   * a trigger on auth.users follows later changes, so an address edited in
--     the Supabase dashboard lands here too.
--
-- NULLABLE, deliberately. Backfilling cannot invent an address for a row whose
-- auth user is gone, and a NOT NULL added over live data would fail the
-- migration rather than tell you that. Every row written from here on gets one.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_email TEXT;

COMMENT ON COLUMN public.profiles.user_email
  IS 'The address this account registered with. Mirrors auth.users.email; written by complete_user_profile() and kept in sync by trg_sync_profile_email. Never set from client input.';

-- Backfill every existing profile from the auth row it points at.
UPDATE public.profiles AS p
   SET user_email = u.email
  FROM auth.users AS u
 WHERE u.id = p.id
   AND p.user_email IS DISTINCT FROM u.email;

-- Lookup by address, case-insensitively — "find the student who wrote in".
-- Functional index on lower() because addresses get typed with any casing;
-- NOT unique, because auth.users already owns that uniqueness and a second
-- constraint here could only ever disagree with it.
CREATE INDEX IF NOT EXISTS idx_profiles_user_email_lower
  ON public.profiles (lower(user_email));

-- ---------------------------------------------------------------------------
-- Writing it: the RPC, not the app
-- ---------------------------------------------------------------------------
-- complete_user_profile is the single source of truth for creating a profile
-- row (see 20260504000003), called by both the email flow and the Google flow.
-- The email is read from auth.users INSIDE the function rather than added as a
-- parameter: it is already SECURITY DEFINER and already looks that row up for
-- the email-confirmed check, and a parameter would be one more thing a caller
-- could get wrong — or forge. Nothing about the signature changes, so both call
-- sites keep working untouched.
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
  v_email           TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_signup_source NOT IN ('email', 'google') THEN
    RAISE EXCEPTION 'invalid signup_source: %', p_signup_source;
  END IF;

  -- One read now serves both the confirmation gate and the stored address.
  SELECT email_confirmed_at, email
    INTO v_email_confirmed, v_email
    FROM auth.users
   WHERE id = v_user_id;

  -- For email-flow users, the email must be confirmed before we'll create the
  -- profile. Implicit in the call site (verifyOtpAction only reaches
  -- createProfile after a successful verifyOtp), but defense in depth: any
  -- caller who invoked the RPC without going through verifyOtp is rejected.
  IF p_signup_source = 'email' AND v_email_confirmed IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    gender,
    birth_date,
    exam_date_planned,
    terms_accepted_at,
    signup_source,
    user_email
  ) VALUES (
    v_user_id,
    p_full_name,
    p_phone,
    p_gender,
    p_birth_date,
    p_exam_date_planned,
    p_terms_accepted_at,
    p_signup_source,
    v_email
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Keeping it true: follow later changes to the address
-- ---------------------------------------------------------------------------
-- An address can change after signup — a user updates it, or you edit it in
-- Authentication → Users in the dashboard. Without this the copy would quietly
-- describe an address nobody can be reached at any more, which is worse than
-- not having the column.
--
-- A trigger on auth.users is the same mechanism Supabase's own new-user hooks
-- use. It fires only on an actual change to `email`, does one UPDATE by primary
-- key, and cannot fail the auth write in a way that matters: a profile row that
-- does not exist yet simply matches nothing.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET user_email = NEW.email
   WHERE id = NEW.id
     AND user_email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;

CREATE TRIGGER trg_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();
