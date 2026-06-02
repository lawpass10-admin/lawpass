import Link from "next/link";

import {
  plansCopy,
  type PlanCopy,
} from "@/app/(marketing)/_components/landing-copy";

import styles from "./landing.module.css";

/**
 * Slice 46 — plans section (3 cards).
 *
 * Plan 1 = default; Plan 2 = `featured` (navy bg, gold border, float
 * animation on lg+); Plan 3 = `comingSoon` (dashed border, disabled CTA).
 * CTA hrefs come from the copy module — hero/plan-3mo/plan-6mo all route
 * to /early-access?source=... per the locked decisions.
 *
 * The check-mark SVG icon next to each feature is inlined here (small, used
 * 5×3=15 times). Plan-3 has an extra star badge + brain-icon tag.
 */

function CheckIcon() {
  return (
    <svg aria-hidden height="16" viewBox="0 0 20 20" width="16">
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden fill="none" height="12" viewBox="0 0 14 14" width="12">
      <path
        d="M7 1l1.6 3.4 3.7.5-2.7 2.6.6 3.7L7 9.5l-3.2 1.7.6-3.7L1.7 4.9l3.7-.5z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="14"
      style={{ verticalAlign: -2, marginInlineEnd: 6 }}
      viewBox="0 0 16 16"
      width="14"
    >
      <path
        d="M3 8h10M3 8a5 5 0 0110 0M2 10h12M5 13h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function planClass(variant: PlanCopy["variant"]) {
  let base = styles.plan;
  if (variant === "featured") base = `${base} ${styles.planFeatured}`;
  if (variant === "comingSoon") base = `${base} ${styles.planComingSoon}`;
  return base;
}

function PlanCta(plan: PlanCopy) {
  if (plan.variant === "comingSoon") {
    return (
      <button
        type="button"
        className={`${styles.planCta} ${styles.planCtaDisabled}`}
        disabled
      >
        {plan.ctaLabel}
      </button>
    );
  }
  if (!plan.ctaHref) return null;
  return (
    <Link className={styles.planCta} href={plan.ctaHref}>
      {plan.ctaLabel}
    </Link>
  );
}

export function LandingPlans() {
  return (
    <section className={styles.plansSection} id="plans">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2} style={{ color: "var(--navy-ink)" }}>
            {plansCopy.headline}
            <span className={styles.gold}>{plansCopy.headlineGold}</span>
          </h2>
          <p className={styles.lead}>{plansCopy.lead}</p>
        </div>

        <div className={styles.plans}>
          {plansCopy.plans.map((plan) => (
            <article key={plan.name} className={planClass(plan.variant)}>
              {plan.badge && plan.variant === "featured" ? (
                <div className={styles.planBadge}>{plan.badge}</div>
              ) : null}
              {plan.badge && plan.variant === "comingSoon" ? (
                <div className={`${styles.planBadge} ${styles.planBadgeSoon}`}>
                  {plan.badgeWithStar ? <StarIcon /> : null}
                  <span>{plan.badge}</span>
                </div>
              ) : null}

              <div className={styles.planTag}>
                {plan.tagWithBrainIcon ? <BrainIcon /> : null}
                <span>{plan.tag}</span>
              </div>

              <h3 className={styles.planName}>{plan.name}</h3>

              <div className={styles.planPrice}>
                {plan.priceAmountTbd ? (
                  <span className={styles.planAmountTbd}>
                    {plan.priceAmountTbd}
                  </span>
                ) : (
                  <>
                    {plan.priceCurrency ? (
                      <span className={styles.planCurrency}>
                        {plan.priceCurrency}
                      </span>
                    ) : null}
                    <span className={styles.planAmount}>{plan.priceAmount}</span>
                  </>
                )}
              </div>

              <div className={styles.planSub}>{plan.sub}</div>

              <ul className={styles.planFeatures}>
                {plan.features.map((feat) => (
                  <li key={feat}>
                    <CheckIcon />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <PlanCta {...plan} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
