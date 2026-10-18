-- app_settings — operational switches that are flipped with SQL, not a deploy.
--
-- First switch: `login_locked`. When true, everyone except an admin is kept
-- out of the whole app — they cannot sign in, cannot sign up, and an existing
-- session stops working on its next request.
--
-- ── Why a table and not an environment variable ────────────────────────────
-- An env var would mean a Vercel redeploy to lock and another to unlock, with
-- a build in between. A lockdown is the one setting you reach for when
-- something is wrong, which is exactly when you cannot wait several minutes
-- for a build — and exactly when you most want to be able to undo it in two
-- seconds. One UPDATE does both directions:
--
--   -- lock the app to admins only
--   UPDATE public.app_settings SET value = 'true'::jsonb  WHERE key = 'login_locked';
--
--   -- open it back up
--   UPDATE public.app_settings SET value = 'false'::jsonb WHERE key = 'login_locked';
--
--   -- check the current state
--   SELECT key, value, updated_at FROM public.app_settings;
--
-- ── Who can read it ────────────────────────────────────────────────────────
-- Everyone, including anon. The flag is not a secret — a locked-out visitor
-- can see the maintenance page anyway, and the gate has to be readable by the
-- middleware on a request that has no session yet (a sign-in attempt).
--
-- ── Who can write it ───────────────────────────────────────────────────────
-- Nobody through the API. There is no INSERT/UPDATE/DELETE policy and no
-- write grant, so the anon and authenticated roles cannot reach it at all.
-- It is changed with the SQL editor or the service role, deliberately: a
-- switch that locks out every user should not be reachable from a browser.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  -- What this switch is for, readable by whoever finds the row at 3am.
  note       text        NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS
  'Operational switches flipped with SQL rather than a deploy. See login_locked.';

-- Keeps `updated_at` honest without the UPDATE having to remember it — the
-- whole point of the column is answering "when did someone lock this".
CREATE OR REPLACE FUNCTION public.app_settings_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch();

-- Seeded UNLOCKED. A migration that locked the app on deploy would be a
-- migration that takes the site down when it runs.
INSERT INTO public.app_settings (key, value, note)
VALUES (
  'login_locked',
  'false'::jsonb,
  'true = only admins may use the app. Everyone else is blocked from signing in, signing up, and from any existing session.'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read_all ON public.app_settings;
CREATE POLICY app_settings_read_all
  ON public.app_settings FOR SELECT TO anon, authenticated
  USING (true);

-- SELECT only. No write grant and no write policy: see the header.
GRANT SELECT ON public.app_settings TO anon, authenticated;

-- ── The gate itself ────────────────────────────────────────────────────────
-- ONE round trip answering both halves of the question, because this runs in
-- the Next middleware on every request and two queries there is two round
-- trips on every page load.
--
-- SECURITY DEFINER so it can read `profiles.is_admin` for the caller without
-- depending on which policies happen to apply — and so a future change to the
-- profiles policies cannot quietly turn the lock off.
--
-- Returns `allowed`, already evaluated, rather than the two raw facts. The
-- rule — "locked AND not an admin means out" — then lives in one place
-- instead of being re-derived by every caller that gates on it.
CREATE OR REPLACE FUNCTION public.login_gate()
RETURNS TABLE (locked boolean, is_admin boolean, allowed boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locked boolean;
  v_admin  boolean;
  v_uid    uuid := (SELECT auth.uid());
BEGIN
  SELECT coalesce((value)::text = 'true', false)
    INTO v_locked
    FROM public.app_settings
   WHERE key = 'login_locked';

  -- No row means no lock. A missing switch must fail OPEN: the alternative is
  -- a deleted row locking every user out of the product with no obvious cause.
  v_locked := coalesce(v_locked, false);

  IF v_uid IS NULL THEN
    v_admin := false;
  ELSE
    SELECT coalesce(p.is_admin, false) INTO v_admin
      FROM public.profiles p
     WHERE p.id = v_uid;
    v_admin := coalesce(v_admin, false);
  END IF;

  RETURN QUERY SELECT v_locked, v_admin, (NOT v_locked) OR v_admin;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.login_gate() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.login_gate() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.login_gate() IS
  'Is the caller allowed in? Reads app_settings.login_locked and profiles.is_admin in one round trip. Called from the Next middleware on every request.';
