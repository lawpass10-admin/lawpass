"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidPlanId, type PlanId } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Maps the client-side PlanId (URL-safe identifier used by /pricing →
 * /checkout) to the DB-level plan_type literal stored in
 * subscriptions.plan_type and accepted by grant_mock_subscription's
 * p_plan_type argument. Kept here rather than in lib/billing/plans.ts so
 * the DB-layer literals don't leak into the client bundle.
 */
const PLAN_TYPE_BY_ID: Record<PlanId, "3_months" | "6_months"> = {
  plan_3m: "3_months",
  plan_6m: "6_months",
};

/**
 * SPEC §6.9 step 6 (system performs charge) → step 7 (subscription active,
 * redirect to confirmation). Slice 1 placeholder: instead of a real charge,
 * we call the `grant_mock_subscription` RPC (migration
 * 20260506000001) which inserts an active subscription row for the
 * authenticated user with the chosen plan_type.
 *
 * TODO(slice-4): when Tranzila lands, this Server Action either goes away
 * (replaced by the Tranzila webhook flow) or evolves to forward the
 * planId/duration to a real charge → webhook → subscription-creation
 * pipeline. lib/billing/plans.ts remains the single source of truth for
 * client-facing pricing/labels.
 *
 * Hardening Rule #2: SSR client only — never the admin client. The RPC is
 * SECURITY DEFINER and derives user_id from auth.uid() server-side, so a
 * caller can't grant a subscription to someone else. The RPC also
 * server-side-validates p_plan_type against an allowlist.
 *
 * Idempotency: the RPC has `ON CONFLICT (user_id) WHERE is_current = TRUE
 * DO NOTHING` so concurrent double-clicks both succeed and end up with one
 * subscription row.
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

  const { error } = await supabase.rpc("grant_mock_subscription", {
    p_plan_type: PLAN_TYPE_BY_ID[planId],
  });

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
    `[billing] grant_mock_subscription rpc OK user=${userId} plan=${planId}`
  );

  // Bust the (app)/layout.tsx subscription SELECT so the next request sees
  // the new row (same pattern as Phase 4 verifyOtpAction).
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
