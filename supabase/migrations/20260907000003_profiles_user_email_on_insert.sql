-- profiles.user_email is never populated for NEW accounts. Fix, and backfill.
--
-- ── The bug ────────────────────────────────────────────────────────────────
-- 20260827000001 added profiles.user_email and a trigger to keep it in step
-- with auth.users:
--
--     CREATE TRIGGER trg_sync_profile_email
--       AFTER UPDATE OF email ON auth.users ...
--
-- UPDATE OF email only. It fires when an address is CHANGED and never when an
-- account is created — and at signup the address is not changed, it is
-- inserted. The profile row is written afterwards by the app, which does not
-- set user_email either. So the column is populated for exactly one group:
-- rows backfilled by that migration. Every account created since has NULL,
-- which is all three signups between 2026-08-30 and 2026-08-31.
--
-- It failed quietly because nothing read the column until now. The
-- re-engagement nudge does — it cannot email an address it does not have — so
-- without this fix the feature would work for existing users, appear healthy,
-- and never reach a single new one.
--
-- ── Why the new trigger is on profiles, not auth.users ─────────────────────
-- Ordering. The auth row exists before the profile row, so an AFTER INSERT
-- trigger on auth.users would UPDATE a profile that is not there yet and
-- silently do nothing — the same class of bug again. Filling the column as the
-- profile is inserted cannot race: the auth row is already committed by then.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill what was missed
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.profiles p
   SET user_email = u.email
  FROM auth.users u
 WHERE u.id = p.id
   AND (p.user_email IS NULL OR p.user_email = '')
   AND u.email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fill it on insert, from now on
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fill_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER: auth.users is not readable by the role inserting a
-- profile. search_path pinned, as for any definer function.
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Only when the caller did not supply one. An explicit value is left alone
  -- so this cannot overwrite a deliberate choice.
  IF NEW.user_email IS NULL OR NEW.user_email = '' THEN
    SELECT u.email INTO NEW.user_email FROM auth.users u WHERE u.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_profile_email ON public.profiles;
CREATE TRIGGER trg_fill_profile_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fill_profile_email();

COMMENT ON FUNCTION public.fill_profile_email() IS
  'Copies auth.users.email into profiles.user_email as the profile is created. '
  'Complements trg_sync_profile_email on auth.users, which handles only later '
  'changes to an address.';
