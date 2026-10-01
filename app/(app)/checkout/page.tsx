import { notFound, redirect } from "next/navigation";

import { isMockCheckoutEnabled } from "@/lib/billing/mock-checkout";
import {
  DEFAULT_PLAN_ID,
  getPlan,
  isValidPlanId,
} from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

import CheckoutScreen from "./_components/checkout-screen";

/**
 * /checkout — Slice 1 payment-form placeholder.
 *
 * Server Component:
 *   0. Environment guard: 404 unless the mock checkout is allowed to run
 *      here (lib/billing/mock-checkout.ts). Production refuses by default,
 *      because this page's button grants a subscription without charging.
 *   1. Active-sub guard: if the user already has a current active
 *      subscription, redirect /dashboard. Defers SPEC §6.10 upgrade flow
 *      to Slice 4. (Same query the parent (app)/layout.tsx uses.)
 *   2. Reads `?plan=` from searchParams, validates against PLANS, falls
 *      back to DEFAULT_PLAN_ID for missing/invalid.
 *   3. Renders the client `<CheckoutScreen plan={plan} />`.
 *
 * Subscription-exempt: /checkout is in (app)/layout.tsx
 * SUBSCRIPTION_EXEMPT_PREFIXES so users on their way to creating a
 * subscription can reach it.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  // 404 rather than a screen whose only button cannot work. The action behind
  // it refuses in production anyway (lib/billing/mock-checkout.ts) — this just
  // means nobody is offered a payment form that would answer "התשלום אינו
  // זמין כרגע". A real not-found is also the honest description: in a
  // deployment without ALLOW_MOCK_CHECKOUT there is no checkout here yet.
  if (!isMockCheckoutEnabled()) notFound();

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

  const params = await searchParams;
  const rawPlan = typeof params.plan === "string" ? params.plan : null;
  const planId = isValidPlanId(rawPlan) ? rawPlan : DEFAULT_PLAN_ID;
  const plan = getPlan(planId);

  return <CheckoutScreen plan={plan} />;
}
