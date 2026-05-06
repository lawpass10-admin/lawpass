import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
 *  - /pricing if user has no active subscription
 */
export async function requireActiveSubscription(): Promise<{
  user: User;
  subscription: {
    id: string;
    plan_type: string;
    ends_at: string;
  };
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

  if (!subscription) redirect("/pricing");

  return { user, subscription };
}
