"use strict";

/**
 * TEMPORARY — the API half of the paywall switch.
 *
 * Must be kept in step with SUBSCRIPTION_GATE_ENABLED in
 * lib/auth/subscription-gate.ts, which carries the full explanation. It is a
 * second constant rather than a shared import because this is a separate
 * process with no access to the Next.js source tree.
 *
 * `false` = this middleware waves the request through instead of answering
 * 403. Without it, disconnecting /pricing on the frontend would leave a
 * subscription-less user on a dashboard whose every API call fails — the app
 * would open and the data would not.
 */
const SUBSCRIPTION_GATE_ENABLED = false;

/**
 * Enforces an active subscription. Mirrors
 * lib/auth/subscription-gate.ts `requireActiveSubscription()`.
 *
 * Assumes `authenticate` ran first (req.user, req.supabase set). Where
 * the Next.js action did `redirect("/pricing")`, this responds 403 with
 * `code: "no_subscription"` so the frontend can perform the redirect.
 * On success attaches req.subscription.
 *
 * Defense-in-depth only — RLS (`has_active_subscription()`) is the real
 * gate at the DB. Play endpoints that rely purely on RLS skip this.
 */
async function requireSubscription(req, res, next) {
  // Still LOOKS the subscription up when the gate is off: downstream handlers
  // read req.subscription, and leaving it undefined would turn a disabled gate
  // into a different bug. Only the refusal is skipped.
  if (!SUBSCRIPTION_GATE_ENABLED) {
    const { data } = await req.supabase
      .from("subscriptions")
      .select("id, plan_type, ends_at")
      .eq("user_id", req.user.id)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle();

    req.subscription = data ?? null;
    return next();
  }

  const { data: subscription, error } = await req.supabase
    .from("subscriptions")
    .select("id, plan_type, ends_at")
    .eq("user_id", req.user.id)
    .eq("is_current", true)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (error || !subscription) {
    return res
      .status(403)
      .json({ ok: false, error: "אין מנוי פעיל", code: "no_subscription" });
  }

  req.subscription = subscription;
  next();
}

module.exports = { requireSubscription };
