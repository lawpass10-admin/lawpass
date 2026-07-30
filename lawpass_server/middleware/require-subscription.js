"use strict";

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
