"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidPlanId, type PlanId } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * SPEC §6.9 step 6 (system performs charge) → step 7 (subscription active,
 * redirect to confirmation). Slice 1 placeholder: instead of a real charge,
 * we call the parameterless `grant_mock_subscription` RPC (migration
 * 20260504000001) which inserts an active 3-month subscription row for the
 * authenticated user.
 *
 * TODO(slice-4): the `planId` param is currently cosmetic — the RPC ignores
 * it and always grants 3 months / 90 days regardless of whether the user
 * picked plan_3m or plan_6m. When Tranzila lands, this Server Action either
 * goes away (replaced by the Tranzila webhook flow) or evolves to pass the
 * planId/duration to a real subscription-creation path. For Phase 6,
 * `planId` only drives the /checkout order-summary display
 * (lib/billing/plans.ts is the single source of truth).
 *
 * Hardening Rule #2: SSR client only — never the admin client. The RPC is
 * SECURITY DEFINER and derives user_id from auth.uid() server-side, so a
 * caller can't grant a subscription to someone else.
 *
 * Idempotency: the RPC has `ON CONFLICT (user_id) WHERE is_current = TRUE
 * DO NOTHING` and short-circuits if a current active non-expired
 * subscription already exists. Concurrent double-clicks both succeed and
 * end up with one subscription row.
 */
export async function grantMockSubscriptionAction(
  planId: PlanId
): Promise<ActionResult> {
  if (!isValidPlanId(planId)) {
    return { ok: false, error: "תוכנית לא תקינה" };
  }

  const supabase = await createClient();

  // Read auth.users id once for logging in both success + failure paths.
  // The RPC itself derives user_id internally; this is purely for [billing]
  // log telemetry.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "<unknown>";

  const { error } = await supabase.rpc("grant_mock_subscription");

  if (error) {
    // TODO(slice-7): replace with structured logger.
    console.error(
      `[billing] grant_mock_subscription rpc FAILED user=${userId} plan=${planId} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return {
      ok: false,
      error: "אירעה שגיאה בהפעלת המנוי. נסה שוב או פנה לתמיכה",
    };
  }

  // TODO(slice-7): replace with structured logger.
  console.info(
    `[billing] grant_mock_subscription rpc OK user=${userId} plan=${planId} (mock — actual RPC ignores planId)`
  );

  // Bust the (app)/layout.tsx subscription SELECT so the next request sees
  // the new row (same pattern as Phase 4 verifyOtpAction).
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
