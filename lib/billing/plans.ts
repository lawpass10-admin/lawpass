/**
 * LawPass subscription plans (SPEC §6.9 / §1.6).
 *
 * Hardcoded for Slice 1. Slice 4 will move plan management to a DB-backed
 * source alongside the Tranzila integration. Until then, this file is the
 * single source of truth for plan IDs, prices, durations, and feature
 * lists used by /pricing, /checkout, and grantMockSubscriptionAction.
 *
 * The PlanId values here ("plan_3m" / "plan_6m") are the URL-safe client
 * identifiers used in /checkout?plan=… query params. They map 1:1 to the
 * DB-level plan_type literals ("3_months" / "6_months") inside
 * grantMockSubscriptionAction (app/(app)/_actions.ts) before being passed
 * to grant_mock_subscription's p_plan_type argument. Mapping lives in
 * the action so the DB literals don't leak into the client bundle.
 *
 * TODO(slice-4): align route name. SPEC §7.0.1 line 1539 calls the plan-
 * selection screen `/subscription` (the Sidebar "רכוש מנוי" button
 * target). Existing middleware + wireframe + this codebase use `/pricing`.
 * When Tranzila lands and we revisit naming, pick one and migrate.
 */

export type PlanId = "plan_3m" | "plan_6m";

export type PlanFeature = {
  label: string;
  included: boolean;
};

export type Plan = {
  id: PlanId;
  durationMonths: 3 | 6;
  totalPrice: number; // ILS, VAT-inclusive per SPEC §1.6
  monthlyPriceDisplay: string; // for the "X ₪ / חודש" tagline
  durationLabel: string; // "3 חודשים" / "6 חודשים"
  subtitle: string;
  recommended: boolean;
  features: PlanFeature[];
};

const FEATURES_3M: PlanFeature[] = [
  { label: "גישה ל-1,200+ שאלות", included: true },
  { label: "תרגול 360° עם זוויות מרובות", included: true },
  { label: "סימולציות בחינה ללא הגבלה", included: true },
  { label: "אנליטיקה ומעקב התקדמות", included: true },
  { label: "פירוט פסיקה ומקורות", included: true },
  { label: "עדכוני בחינות חדשות", included: false },
];

const FEATURES_6M: PlanFeature[] = [
  { label: "גישה ל-1,200+ שאלות", included: true },
  { label: "תרגול 360° עם זוויות מרובות", included: true },
  { label: "סימולציות בחינה ללא הגבלה", included: true },
  { label: "אנליטיקה ומעקב התקדמות", included: true },
  { label: "פירוט פסיקה ומקורות", included: true },
  { label: "עדכוני בחינות חדשות", included: true },
];

export const PLANS: readonly Plan[] = [
  {
    id: "plan_3m",
    durationMonths: 3,
    // Slice 16 (landing prices) — 350 → 2000 per Sharon, 2026-05-29.
    totalPrice: 2000,
    // Field kept on the shape for back-compat with any future consumer,
    // but it is NO LONGER rendered in the UI (the /pricing screen and
    // the new landing page both show the total only). Value left as
    // the prior "117" tagline so historical reads aren't misleading;
    // it's deliberately unused.
    monthlyPriceDisplay: "117",
    durationLabel: "3 חודשים",
    subtitle: "מתאים למוכנים סופית",
    recommended: false,
    features: FEATURES_3M,
  },
  {
    id: "plan_6m",
    durationMonths: 6,
    // Slice 16 — 1000 → 3500 per Sharon, 2026-05-29.
    totalPrice: 3500,
    monthlyPriceDisplay: "167",
    durationLabel: "6 חודשים",
    subtitle: "הפופולרי ביותר",
    recommended: true,
    features: FEATURES_6M,
  },
] as const;

/** Recommended plan — the one selected by default on /pricing. */
export const DEFAULT_PLAN_ID: PlanId = "plan_6m";

/** Type-narrowing predicate for unknown searchParam input. */
export function isValidPlanId(id: unknown): id is PlanId {
  return id === "plan_3m" || id === "plan_6m";
}

/** Lookup a plan by id. Throws if id isn't in PLANS — callers should
 *  validate first via isValidPlanId. */
export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) {
    throw new Error(`Unknown plan id: ${id}`);
  }
  return plan;
}
