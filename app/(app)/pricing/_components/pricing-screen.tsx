"use client";

import Link from "next/link";
import { useState } from "react";

import { SiteFooter } from "@/components/shared/site-footer";
import { buttonVariants } from "@/components/ui/button";
import {
  DEFAULT_PLAN_ID,
  getPlan,
  PLANS,
  type Plan,
  type PlanId,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Single plan column. Whole card is a clickable button — clicking selects
 * the plan, which updates the bottom CTA's price + ?plan= target.
 *
 * The recommended plan (plan_6m) gets the floating BEST VALUE badge plus a
 * subtle bg-primary/5 tint. Selected plan (regardless of recommendation)
 * gets a primary-colored border + ring for visual confirmation.
 */
function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col rounded-lg border p-5 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
        plan.recommended && "bg-primary/5"
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 right-4 rounded bg-amber-500 px-3 py-1 text-xs font-bold text-white">
          החיסכון הגדול ביותר
        </span>
      )}

      <div className="text-base font-semibold">{plan.durationLabel}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{plan.totalPrice}</span>
        <span className="text-sm">₪</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {plan.monthlyPriceDisplay} ₪ / חודש
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{plan.subtitle}</div>

      <ul className="mt-5 space-y-2">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center font-bold",
                f.included ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden="true"
            >
              {f.included ? "✓" : "—"}
            </span>
            <span
              className={cn(
                f.included ? "" : "text-muted-foreground line-through"
              )}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </button>
  );
}

/**
 * Trust signal pill — small ✓ + label. Used 3× below the CTA.
 */
function TrustSignal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="text-primary" aria-hidden="true">
        ✓
      </span>
      <span>{children}</span>
    </div>
  );
}

export default function PricingScreen() {
  const [selectedPlanId, setSelectedPlanId] =
    useState<PlanId>(DEFAULT_PLAN_ID);
  const selectedPlan = getPlan(selectedPlanId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Eyebrow + heading */}
          <p className="mb-2 text-center text-sm uppercase tracking-wider text-muted-foreground">
            הצעד האחרון
          </p>
          <h1 className="mb-2 text-center text-3xl font-bold">
            בחר את התוכנית שלך
          </h1>
          <p className="mb-10 text-center text-sm text-muted-foreground">
            הזכות לעשות את הבחינה כמו שצריך — בלי פשרות
          </p>

          {/* 2-plan comparison */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlanId === plan.id}
                onSelect={() => setSelectedPlanId(plan.id)}
              />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex justify-center">
            <Link
              href={`/checkout?plan=${selectedPlanId}`}
              className={cn(buttonVariants(), "w-full max-w-md")}
            >
              המשך לתשלום · {selectedPlan.totalPrice} ₪ ←
            </Link>
          </div>

          {/* Trust signals — RTL, three of them. */}
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
            <TrustSignal>תשלום מאובטח</TrustSignal>
            <TrustSignal>תשלום חד-פעמי לתקופת התוכנית</TrustSignal>
            <TrustSignal>ללא התחייבות אחרי תום התקופה</TrustSignal>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
