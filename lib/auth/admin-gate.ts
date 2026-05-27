import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Server Component / Server Action helper enforcing the admin gate.
 *
 * Mirrors `requireActiveSubscription()` in lib/auth/subscription-gate.ts:
 *  - Server Component pages re-run on every navigation, so calling this
 *    at the top of an admin page (or layout) guarantees the gate fires.
 *  - Returns the user + their profile row (full_name needed for the
 *    admin shell header).
 *
 * Redirects:
 *  - /login if no user (defense in depth — middleware should already)
 *  - /dashboard if the user is not an admin. We intentionally redirect
 *    silently rather than rendering a 404: SPEC §9.4 / §9.5 ethos is
 *    "don't leak the existence of admin surfaces to non-admins."
 *
 * Reads via the SSR client (RLS-scoped). The `users_view_own_profile`
 * policy already lets a user read their own profile, so no service-role
 * client is required for this check.
 */
export async function requireAdmin(): Promise<{
  user: User;
  profile: { is_admin: true; full_name: string };
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/dashboard");

  return {
    user,
    profile: { is_admin: true, full_name: profile.full_name },
  };
}
