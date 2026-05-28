import { Clock, ListChecks, Play } from "lucide-react";
import Link from "next/link";

import { formatRelativeHebrew } from "@/app/(app)/dashboard/_lib/hero-helpers";
import type { HeroLastSession } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type Props = {
  /**
   * Days until the planned exam date. Slice 11 still accepts this for
   * API stability, but the hero card no longer renders the ring or the
   * big number — the title-area countdown in `<HeaderStrip>` is the
   * single source of truth.
   */
  daysToExam: number | null;
  /** Total days in the user's *subscription* window. Slice 11: kept on
   *  the interface for back-compat with `<HeroRowAsync>`, but unused
   *  now that the ring is gone. */
  subscriptionTotalDays: number;
  /** Days remaining on the active subscription. Same back-compat
   *  rationale as `subscriptionTotalDays`. */
  subscriptionDaysRemaining: number;
  /**
   * 1-based day count since profile.created_at. Slice 11 still accepts
   * this so `<HeroRowAsync>` doesn't need to change; the value flows
   * past the hero now (the page renders <JourneyCard /> directly
   * below the chapters list using this same value).
   */
  currentPlanDay: number;
  /** Last in-flight practice session, or null when none is resumable. */
  lastSession: HeroLastSession;
};

/**
 * Slice 11 — Hero row.
 *
 * The Slice 4 hero rendered two large navy cards side-by-side:
 *   1. <RingCard> with a 130–170px SVG ring + the days-to-exam
 *      number AND the resume/start-practice CTA.
 *   2. <JourneyCard> with the 5-milestone progress timeline.
 *
 * QA flagged this as visually heavy:
 *   - The big SVG ring duplicates the countdown that already lives in
 *     the title-area sentence "נשארו N ימים..." (HeaderStrip is the
 *     single source of truth).
 *   - The two-card grid is the most prominent block on the page; the
 *     primary CTA ("התחל תרגול") got buried in chrome.
 *
 * Slice 11 result:
 *   - The ring is removed from <RingCard>; the card becomes a single
 *     wide CTA-forward card.
 *   - <JourneyCard> is no longer rendered here. It's been extracted
 *     to its own file and the dashboard page now mounts it BELOW the
 *     chapters list.
 *
 * The unused `daysToExam` / `subscriptionTotalDays` /
 * `subscriptionDaysRemaining` / `currentPlanDay` props stay on the
 * interface so `<HeroRowAsync>` doesn't need a signature change.
 */
export function HeroRow({ lastSession }: Props) {
  return (
    <section className="mb-5" aria-label="התחל תרגול">
      <RingCard lastSession={lastSession} />
    </section>
  );
}

// =============================================================================
// CTA card (formerly the "ring card" — Slice 11 dropped the ring)
// =============================================================================

function RingCard({ lastSession }: { lastSession: HeroLastSession }) {
  const progressPct =
    lastSession && lastSession.totalQuestions > 0
      ? Math.round(
          ((lastSession.nextQuestionPosition - 1) / lastSession.totalQuestions) *
            100
        )
      : 0;

  return (
    <div
      className="relative overflow-hidden rounded-[22px] px-6 py-6 md:px-9 md:py-8 text-white"
      style={{
        background:
          "linear-gradient(135deg, #15296B 0%, #1E3A8A 55%, #1A327B 100%)",
        boxShadow: "0 18px 40px -12px rgba(15, 31, 79, 0.40)",
      }}
    >
      {/* Decorative gold glow + soft corner highlight — purely visual,
          mirrors the prototype's ::before/::after pseudo-elements. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -end-32 size-[360px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201, 161, 73, 0.22), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -start-16 size-[220px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255, 255, 255, 0.05), transparent 70%)",
        }}
      />

      {/* Slice 11 — single-column flex layout (was a 2-column grid with
          the ring beside the info block). The ring is gone; the info
          column owns the card's full width. */}
      <div className="relative flex min-w-0 flex-col gap-2.5">
        <Eyebrow>
          {lastSession ? "המשך מאיפה שעצרת" : "מוכן להתחיל?"}
        </Eyebrow>
        <h2
          className="font-heebo font-bold text-white"
          style={{ fontSize: 26, lineHeight: 1.15, margin: "2px 0 0" }}
        >
          {lastSession
            ? (lastSession.chapterTitle ?? "התרגול הפעיל שלך")
            : "התחל תרגול חדש"}
          {lastSession && lastSession.chapterTitle && (
            <span
              className="block font-medium"
              style={{
                fontSize: 16,
                color: "var(--color-gold)",
                marginTop: 4,
              }}
            >
              שאלות בתרגול
            </span>
          )}
        </h2>

        {lastSession ? (
          <>
            <div
              className="flex flex-wrap gap-4"
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 13.5,
                marginTop: 2,
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock
                  className="size-3.5"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                  aria-hidden
                />
                {formatRelativeHebrew(lastSession.lastActivityISO)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks
                  className="size-3.5"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                  aria-hidden
                />
                {lastSession.nextQuestionPosition - 1}/
                {lastSession.totalQuestions} שאלות
              </span>
            </div>

            <div className="mt-2 mb-1.5">
              <div
                className="h-1.5 overflow-hidden rounded-[3px]"
                style={{ background: "rgba(255, 255, 255, 0.12)" }}
              >
                <div
                  className="h-full rounded-[3px]"
                  style={{
                    width: `${progressPct}%`,
                    background:
                      "linear-gradient(90deg, var(--color-gold), var(--color-gold-deep))",
                  }}
                />
              </div>
            </div>

            <Link
              href={`/practice/play/${lastSession.nextQuestionPosition - 1}`}
              className={cn(
                "btn-gold mt-1 inline-flex items-center gap-2 self-start rounded-full px-4 py-2 font-heebo font-semibold",
                "text-[13px] focus-visible:outline-none"
              )}
            >
              המשך מהשאלה ה-{lastSession.nextQuestionPosition} →
            </Link>
          </>
        ) : (
          <Link
            href="/practice"
            className={cn(
              "btn-gold mt-3 inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 font-heebo font-semibold",
              "text-sm focus-visible:outline-none"
            )}
          >
            <Play className="size-4 fill-current" aria-hidden />
            התחל תרגול
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Small bits
// =============================================================================

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-2.5 font-heebo font-medium"
      style={{
        fontSize: 13,
        color: "var(--color-gold)",
        letterSpacing: "0.02em",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 22,
          height: 1.5,
          background: "var(--color-gold)",
        }}
      />
      {children}
    </div>
  );
}
