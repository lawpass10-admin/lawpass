-- login_gate() — take the user id from the caller instead of guessing it.
--
-- ── The bug ────────────────────────────────────────────────────────────────
-- The first version resolved the caller itself, with auth.uid() inside the
-- function. That reads `request.jwt.claims`, a setting PostgREST populates
-- from the Authorization header — so the answer depended on the JWT making it
-- all the way into the RPC request.
--
-- It did on localhost and did not in production: a signed-in ADMIN was still
-- being sent to /maintenance, because the function saw auth.uid() = NULL,
-- concluded is_admin = false, and refused them. The lock kept out the only
-- people who could lift it, for the second time.
--
-- ── The fix ────────────────────────────────────────────────────────────────
-- The Next middleware has just called supabase.auth.getUser() and holds a
-- VERIFIED user id by the time it asks this question. Passing that id is both
-- simpler and strictly more reliable than asking Postgres to re-derive it
-- from a header that may or may not have survived the hop.
--
-- auth.uid() stays as the fallback for a caller that passes nothing, so
-- existing callers and SQL-editor use keep working.
--
-- ── Is the parameter a hole? ───────────────────────────────────────────────
-- No. Someone calling login_gate('<an-admin-uuid>') learns one boolean they
-- could have guessed: whether the app is locked. It grants nothing — RLS is
-- untouched by any of this, and the middleware passes the id from the
-- verified session, never from user input. The lock is an operational switch,
-- not a security boundary; see the table comment in the previous migration.

-- Dropped rather than replaced: adding a parameter creates an OVERLOAD, and
-- two functions with the same name is how a caller ends up reaching the old
-- one by accident.
DROP FUNCTION IF EXISTS public.login_gate();

CREATE OR REPLACE FUNCTION public.login_gate(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (locked boolean, is_admin boolean, allowed boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locked boolean;
  v_admin  boolean;
  -- The caller's id when it supplied one, the JWT's otherwise.
  v_uid    uuid := coalesce(p_user_id, (SELECT auth.uid()));
BEGIN
  SELECT coalesce((value)::text = 'true', false)
    INTO v_locked
    FROM public.app_settings
   WHERE key = 'login_locked';

  -- No row means no lock: a deleted switch must not lock out the product.
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

REVOKE EXECUTE ON FUNCTION public.login_gate(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.login_gate(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.login_gate(uuid) IS
  'Is this user allowed in? Reads app_settings.login_locked and profiles.is_admin in one round trip. '
  'The Next middleware passes the id it just verified with getUser(); auth.uid() is the fallback.';
