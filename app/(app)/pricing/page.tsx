import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import PricingScreen from "./_components/pricing-screen";

/**
 * /pricing — Slice 1 plan-selection screen.
 *
 * Server Component:
 *   1. Active-sub guard: if the user already has a current active
 *      subscription, redirect /dashboard. Defers SPEC §6.10 upgrade flow
 *      to Slice 4. (Same query the parent (app)/layout.tsx uses.)
 *   2. Otherwise renders the interactive `<PricingScreen />` client child.
 *
 * Subscription-exempt: /pricing is in (app)/layout.tsx
 * SUBSCRIPTION_EXEMPT_PREFIXES so users without an active subscription
 * can reach the page (it's the page they're sent to when their subscription
 * is missing).
 *
 * TODO(slice-4): align route name. SPEC §7.0.1 line 1539 calls the
 * plan-selection screen `/subscription` (the Sidebar "רכוש מנוי" target).
 * We use `/pricing` to match the existing middleware redirect target +
 * Yoav's wireframe. Reconcile when Tranzila lands.
 */
export default async function PricingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle();
    if (subscription) redirect("/dashboard");
  }

  return <PricingScreen />;
}
