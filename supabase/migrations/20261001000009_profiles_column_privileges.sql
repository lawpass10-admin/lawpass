-- Close the privilege-escalation hole on public.profiles.
--
-- THE HOLE. `profiles.is_admin` is an ordinary column on a table where every
-- signed-in user could write their own row:
--
--   20260503000014:18  GRANT SELECT, INSERT, UPDATE, DELETE ON profiles
--                      TO authenticated;          -- table-wide, no column list
--   20260503000003:40  CREATE POLICY "users_update_own_profile" ON profiles
--                        FOR UPDATE USING ((SELECT auth.uid()) = id);
--
-- RLS is ROW-level. The policy correctly stops you writing somebody else's row
-- and it cannot do anything about WHICH COLUMNS you write in your own. So any
-- authenticated session — the publishable key and the user's own JWT are both
-- in the browser — could send
--
--   PATCH /rest/v1/profiles?id=eq.<own id>   {"is_admin": true}
--
-- and public.is_admin() would return true from that moment. That unlocks
-- admins_view_all_profiles (every user's name, phone, birth date, email),
-- admins_update_all_profiles, admins_full_access_subscriptions — which is
-- FOR ALL, so a free subscription — the whole *_admins_update content family,
-- and /admin itself. `is_qa_tester` and `is_test_account` went the same way.
--
-- THE FIX IS COLUMN-LEVEL PRIVILEGES, not another policy. Postgres checks
-- column privileges against the SET list of the statement, independently of
-- RLS, so it is the only mechanism that can express "you may edit your name but
-- not your admin flag". The table GRANT goes, and a two-column GRANT replaces
-- it.
--
-- WHAT THE APP ACTUALLY WRITES FROM A USER SESSION, which is what the list
-- below is derived from:
--   - lawpass_server/controllers/account.controller.js:17
--       full_name, exam_date_planned           (the account screen, L1)
--   - app/(app)/admin/_actions.ts:95  and  admin.controller.js:64
--       full_name                               (an admin editing a user)
--   - app/(app)/admin/_actions.ts:369 and  admin.controller.js:173
--       is_qa_tester                            (an admin granting QA access)
--
-- The first three are ordinary profile fields and stay writable. The fourth is
-- a PRIVILEGE, and it moves to an RPC in part 3 — admins are the `authenticated`
-- role too, so a column grant cannot separate "admin toggling a flag" from
-- "user toggling their own flag". An RPC can, because it checks is_admin()
-- inside.
--
-- EVERYTHING ELSE IS WRITTEN BY SOMETHING THAT IS NOT A USER SESSION and is
-- therefore unaffected: complete_user_profile (SECURITY DEFINER) creates the
-- row and writes the NDA and terms fields; the unsubscribe route writes
-- email_opt_out with the service role; the e-mail trigger fills user_email.
--
-- FAIL-SAFE BY DEFAULT. Because this grants an explicit list rather than
-- revoking a blocklist, every column added to profiles from here on is
-- NOT user-writable until somebody adds it to the grant deliberately. A new
-- sensitive flag is protected the day it is created. The cost is that a new
-- EDITABLE field needs a one-line migration, which is the right way round.
--
-- NOT DESTRUCTIVE: no column, row or policy is dropped. Privileges narrow and
-- one function is added. Re-runnable.

-- ── part 1: take back the table-wide write ───────────────────────────────────

-- INSERT: nothing in the app inserts a profile from a user session — the only
-- creation path is the complete_user_profile RPC, which is SECURITY DEFINER and
-- runs with its owner's rights. Leaving this grant in place would have left a
-- second door wide open: a user who has not completed onboarding has no profile
-- row yet, so there is no PK conflict to stop them inserting their own with
-- is_admin already true.
--
-- DELETE: no DELETE policy exists for users, so RLS already refused it. Revoked
-- so the grant cannot outlive the policy that happens to be covering for it.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

-- SELECT is unchanged, here and for anon: the users_view_own_profile and
-- admins_view_all_profiles policies are the right boundary for reads, and anon
-- matches no row because auth.uid() is NULL.

-- ── part 2: give back exactly the two editable fields ────────────────────────

GRANT UPDATE (full_name, exam_date_planned) ON public.profiles TO authenticated;

-- Row scoping is still the policies' job and is unchanged: a user reaches only
-- their own row through users_update_own_profile, an admin reaches any row
-- through admins_update_all_profiles. This grant decides only which columns
-- either of them may name.

-- ── part 3: is_qa_tester becomes an admin-checked RPC ────────────────────────

-- The one privilege column the product legitimately toggles from the UI. It
-- cannot be a column grant: `authenticated` covers admins and ordinary users
-- alike, so granting it would hand every user their own QA-tester flag — which
-- carries the qa_reports insert policy, the QA screenshot bucket and the
-- no-copy bypass.
--
-- SECURITY DEFINER with the check INSIDE, so the authorisation travels with the
-- write instead of sitting in a server action that a direct PostgREST call
-- would skip. auth.uid() still reads the CALLER's JWT inside a definer
-- function, so is_admin() answers for whoever invoked it, not for the owner.
CREATE OR REPLACE FUNCTION public.admin_set_qa_tester(
  p_user_id UUID,
  p_value   BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Deliberately the same message whoever asks: a non-admin learns that they
    -- may not do this, not whether the target user exists.
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET is_qa_tester = p_value
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_set_qa_tester(UUID, BOOLEAN) IS
  'Toggle profiles.is_qa_tester. The only write path for that column from a user session — the table grant does not include it. Checks is_admin() internally, so the authorisation cannot be bypassed by calling PostgREST directly. Audit logging stays with the caller.';

REVOKE EXECUTE ON FUNCTION public.admin_set_qa_tester(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_qa_tester(UUID, BOOLEAN) TO authenticated;
