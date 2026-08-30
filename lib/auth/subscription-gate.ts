import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * TEMPORARY — the paywall's on/off switch.
 *
 * `false` disconnects /pricing from the login and registration flow: a user
 * with no active subscription signs up, lands on /dashboard, and is never
 * bounced to the plan picker. /pricing and /checkout are untouched and still
 * reachable by URL or by the account screen's link — this only stops the app
 * from FORCING anyone through them.
 *
 * Flipping this back to `true` restores the gate everywhere it was: this
 * helper, the (app) layout, and the post-signup destination all read it, so
 * there is one line to change and no redirect left behind somewhere.
 *
 * TWO THINGS THIS SWITCH DOES NOT REACH, both deliberate:
 *   1. lawpass_server/middleware/require-subscription.js — the API's own gate.
 *      It has its own matching constant, because it is a separate process that
 *      cannot import this file. Flip both or the app opens and the data does
 *      not.
 *   2. The RLS policies (`has_active_subscription()` in
 *      20260503000002_helper_functions.sql). That is the REAL boundary, at the
 *      database, and it is not something an app-level flag should be able to
 *      switch off. While it stands, a user with no subscription reaches the
 *      screens but the content queries return zero rows.
 */
export const SUBSCRIPTION_GATE_ENABLED = false;

type ActiveSubscription = {
  id: string;
  plan_type: string;
  ends_at: string;
};

/**
 * Server Component helper that enforces the subscription gate at the
 * page level. Layout-level gating is unreliable for client-side <Link>
 * navigations between siblings under the same layout — Next.js's Router
 * Cache reuses the rendered layout segment without re-running it. Server
 * Component pages, by contrast, re-run on every navigation. Calling this
 * helper at the top of a protected page guarantees the gate fires.
 *
 * Returns the authenticated user and their active subscription, ready to
 * use in the calling page (avoids a duplicate fetch).
 *
 * Redirects:
 *  - /login if no user (defense in depth — middleware should already)
 *  - /pricing if the user has no active subscription AND the gate is on
 *
 * `subscription` is null ONLY on the gate-off path — with the gate on, the
 * redirect above means a caller that gets a return value always has one. The
 * type says `| null` regardless so a caller cannot read `plan_type` off thin
 * air the day the flag is flipped.
 */
export async function requireActiveSubscription(): Promise<{
  user: User;
  subscription: ActiveSubscription | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, plan_type, ends_at")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (!subscription && SUBSCRIPTION_GATE_ENABLED) redirect("/pricing");

  return { user, subscription };
}
