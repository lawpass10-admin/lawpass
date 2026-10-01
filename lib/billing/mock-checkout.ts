/**
 * Whether the Slice-1 mock checkout may run.
 *
 * WHAT THE MOCK CHECKOUT IS. Tranzila is not wired yet, so /checkout does not
 * charge anybody: it calls the grant_mock_subscription RPC, which inserts an
 * active subscription for the caller. That is the correct placeholder for
 * development and it is exactly what must never answer a request in
 * production, because a Server Action is a public POST endpoint — any
 * registered user can invoke it directly, with or without the checkout screen,
 * and receive a paid subscription for free.
 *
 * Nothing used to stop that shipping. The TODO(slice-4) note in
 * app/(app)/_actions.ts says Tranzila replaces this, but a comment is not a
 * guard, and /checkout stays reachable by URL and from the account screen's
 * link even now that SUBSCRIPTION_GATE_ENABLED is false and nothing routes
 * people through it.
 *
 * FAIL CLOSED, WITH ONE DELIBERATE WAY BACK IN. A production build refuses
 * unless ALLOW_MOCK_CHECKOUT is set to the exact string "true". Development
 * is unaffected, so the local flow keeps working with no configuration.
 *
 * NODE_ENV, NOT VERCEL_ENV. The check has to hold wherever this runs — Vercel
 * for the Next app, Render for the Express service — and NODE_ENV is the one
 * signal both set. The cost is that Vercel PREVIEW deployments also count as
 * production (Next sets NODE_ENV=production for any build), so a preview that
 * needs to exercise checkout needs the variable too. That is the right way
 * round: a preview is a deployed, reachable URL.
 *
 * THE ESCAPE HATCH IS REAL, not decorative. If early-access accounts are being
 * given access by walking them through the mock checkout, set
 * ALLOW_MOCK_CHECKOUT=true and this behaves exactly as it did before. The
 * point of this module is that doing so becomes a decision somebody makes,
 * rather than the default nobody noticed.
 *
 * WHEN TRANZILA LANDS this file and its two call sites go away with the mock
 * RPC, rather than being flipped on.
 */
export function isMockCheckoutEnabled(): boolean {
  if (process.env.ALLOW_MOCK_CHECKOUT === "true") return true;
  return process.env.NODE_ENV !== "production";
}
