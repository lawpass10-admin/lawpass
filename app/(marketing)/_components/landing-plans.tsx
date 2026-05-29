import Link from "next/link";

import { PLANS, type Plan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

import {
  COMING_SOON_PLAN,
  LANDING_PLAN_COPY,
  PLANS_EYEBROW,
} from "./landing-copy";
import { MarketingSection } from "./marketing-section";

/**
 * Plans section — three cards (3 חודשים / 6 חודשים [featured] /
 * AI [coming soon]).
 *
 * Slice 16 / Phase L3. The two real plans are pulled directly from
 * `lib/billing/plans.ts` so the landing price tracks /pricing and
 * checkout. The third card is a pure visual "בקרוב" placeholder —
 * never wired to checkout, CTA is a `<button disabled>`, no price.
 *
 * Featured plan (plan_6m) gets:
 *   - navy-ink background + gold border
 *   - `.plan-float` 4-second floating animation
 *   - gold-on-navy CTA
 *   - "המומלץ" badge floating off the top
 *
 * Pure Server Component — no hooks, no client-side state.
 */
export function LandingPlans() {
  return (
    <section id="plans" className="relative bg-[var(--color-paper)] py-20 md:py-28">
      <MarketingSection as="div" innerClassName="px-4 md:px-8">
        <div className="mx-auto mb-14 max-w-[720px] text-center">
          <div className="mb-[22px] inline-flex items-center justify-center gap-3 text-sm font-medium tracking-[0.01em] text-[var(--color-gold-deep)]">
            <span
              aria-hidden="true"
              className="block h-[1.5px] w-7 shrink-0 bg-[var(--color-gold)]"
            />
            <span>{PLANS_EYEBROW}</span>
          </div>
          <h2 className="mb-[18px] font-extrabold leading-[1.08] tracking-[-0.01em] text-[clamp(36px,4vw,56px)] text-[var(--color-navy-ink)]">
            בחרו את הקצב{" "}
            <span className="text-[var(--color-gold-deep)]">שלכם.</span>
          </h2>
          <p className="mx-auto max-w-[620px] text-[clamp(17px,1.4vw,19px)] leading-[1.55] text-[var(--ink-3)]">
            אין תקופת ניסיון חינם — כל מסלול נותן ערך מלא מהיום הראשון. כל
            המחירים כוללים מע&quot;מ.
          </p>
        </div>

        {/* Mobile (<1024px): cards stack vertically with a 24px gap.
            md (≥768px) stays 1-col because the cards are tall and
            wider stacking reads better than 2-up at tablet width.
            lg+ uses the 3-up layout the prototype was designed for. */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
          <ComingSoonCard />
        </div>
      </MarketingSection>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const copy = LANDING_PLAN_COPY[plan.id];
  const featured = plan.recommended;
  const formattedPrice = plan.totalPrice.toLocaleString("he-IL");

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[var(--radius-card-lg)] border bg-white p-6 pb-7 shadow-[var(--shadow-sm)] transition-[transform,box-shadow] duration-300 md:p-9 md:pb-8",
        featured
          ? // Featured: navy-ink bg, gold border, soft glow, float.
            // The `plan-float` utility (app/globals.css) drives the
            // 4-second translateY loop; its `:hover` rule pauses the
            // animation and Tailwind's `hover:-translate-y-[10px]`
            // overrides the resting transform.
            "plan-float border-2 border-[var(--color-gold)] bg-[var(--color-navy-ink)] text-white shadow-[var(--shadow-lg),0_0_0_4px_rgba(201,161,73,0.10)] hover:-translate-y-[10px]"
          : "border-[var(--color-line)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
      )}
    >
      {featured && (
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[-14px] z-[5] inline-flex min-w-[90px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-[var(--color-gold)] px-[18px] py-[6px] text-xs font-bold uppercase tracking-[0.06em] leading-none text-[var(--color-navy-ink)]"
        >
          המומלץ
        </div>
      )}

      <div
        className={cn(
          "text-[13px] font-semibold tracking-[0.04em]",
          featured ? "text-[var(--color-gold)]" : "text-[var(--color-gold-deep)]"
        )}
      >
        {copy.tag}
      </div>

      <h3
        className={cn(
          "mb-4 mt-2 text-[28px] font-bold",
          featured ? "text-white" : "text-[var(--color-navy-ink)]"
        )}
      >
        {plan.durationLabel}
      </h3>

      <div
        className={cn(
          "flex items-baseline gap-1",
          featured ? "text-white" : "text-[var(--color-navy-ink)]"
        )}
      >
        <span
          className={cn(
            "text-[22px] font-semibold opacity-70",
            featured ? "text-white" : "text-[var(--color-navy-ink)]"
          )}
        >
          ₪
        </span>
        <span className="text-[56px] font-extrabold leading-none tracking-[-0.02em]">
          {formattedPrice}
        </span>
      </div>

      <div
        className={cn(
          "mb-7 mt-1.5 text-sm",
          featured ? "text-white/65" : "text-[var(--color-ink-muted)]"
        )}
      >
        {copy.subtitle}
      </div>

      <ul className="mb-7 flex flex-1 list-none flex-col gap-3 p-0">
        {copy.features.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-start gap-2.5 text-[15px] leading-[1.45]",
              featured ? "text-white/85" : "text-[var(--ink)]"
            )}
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              aria-hidden="true"
              className={cn(
                "mt-1 shrink-0",
                featured
                  ? "text-[var(--color-gold)]"
                  : "text-[var(--color-gold-deep)]"
              )}
            >
              <path
                d="M4 10.5l4 4 8-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        // L4: pricing CTA goes to /signup with the chosen plan in the
        // query so signUpAction stashes it in auth.user_metadata. After
        // OTP verify, verifyOtpAction redirects the user straight to
        // /checkout?plan=<id> instead of /pricing. (If they happen to
        // be authenticated when the proxy sees this request — e.g.
        // returning visitor — the proxy bounces them to /dashboard
        // before the landing's own auth redirect ever runs, but for
        // belt-and-suspenders the /signup page itself also redirects
        // authed users to /checkout?plan=… via the same query.)
        href={`/signup?plan=${plan.id}`}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-[filter,transform,background] duration-200",
          featured
            ? // Featured CTA — solid gold on the navy card.
              "bg-[var(--color-gold)] text-[var(--color-navy-ink)] hover:brightness-[1.06]"
            : "border-2 border-[var(--color-navy-ink)] bg-transparent text-[var(--color-navy-ink)] hover:bg-[var(--color-navy-ink)] hover:text-white"
        )}
      >
        {copy.ctaLabel}
      </Link>
    </article>
  );
}

function ComingSoonCard() {
  return (
    <article className="relative flex flex-col rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-line-strong)] bg-[#F4F2EC] p-6 pb-7 md:p-9 md:pb-8">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[-14px] z-[5] inline-flex min-w-[90px] -translate-x-1/2 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#B8BCC8] px-[18px] py-[6px] text-xs font-bold uppercase tracking-[0.06em] leading-none text-white"
      >
        <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden="true">
          <path
            d="M7 1l1.6 3.4 3.7.5-2.7 2.6.6 3.7L7 9.5l-3.2 1.7.6-3.7L1.7 4.9l3.7-.5z"
            fill="currentColor"
            opacity="0.5"
          />
        </svg>
        בקרוב
      </div>

      <div className="inline-flex items-center text-[13px] font-semibold tracking-[0.04em] text-[#6F7585]">
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          aria-hidden="true"
          className="-mb-0.5 ms-[-2px] me-1.5"
        >
          <path
            d="M3 8h10M3 8a5 5 0 0110 0M2 10h12M5 13h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {COMING_SOON_PLAN.tag}
      </div>

      <h3 className="mb-4 mt-2 text-[28px] font-bold text-[#4B5263]">
        {COMING_SOON_PLAN.name}
      </h3>

      <div className="flex items-baseline gap-1">
        <span className="font-[Heebo] text-[40px] font-extrabold leading-none tracking-[-0.01em] text-[#B8BCC8]">
          בקרוב
        </span>
      </div>

      <div className="mb-7 mt-1.5 text-sm text-[#8A8F9F]">
        {COMING_SOON_PLAN.subtitle}
      </div>

      <ul className="mb-7 flex flex-1 list-none flex-col gap-3 p-0">
        {COMING_SOON_PLAN.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2.5 text-[15px] leading-[1.45] text-[#6F7585]"
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              aria-hidden="true"
              className="mt-1 shrink-0 text-[#B8BCC8]"
            >
              <path
                d="M4 10.5l4 4 8-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-[#B8BCC8] bg-[#ECEAE3] px-6 py-3 text-center text-sm font-semibold leading-[1.3] text-[#6F7585]"
      >
        {COMING_SOON_PLAN.ctaLabel}
      </button>
    </article>
  );
}
