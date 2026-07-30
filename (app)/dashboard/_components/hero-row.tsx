import { Play } from "lucide-react";
import Link from "next/link";

import {
  RING_CENTER,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  RING_VIEWBOX,
  computeRingDash,
} from "@/app/(app)/dashboard/_lib/hero-helpers";
import type { HeroLastSession } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type Props = {
  /** Days until the planned exam date. Drives the ring's center
   *  number and the gold headline. Null when the user hasn't set an
   *  exam date — the headline falls back to a prompt. */
  daysToExam: number | null;
  /**
   * Total days in the user's *subscription* window (90 for 3_months,
   * 180 for 6_months). Denominator for the ring's gold-arc fill.
   */
  subscriptionTotalDays: number;
  /**
   * Days remaining on the active subscription. Drives the ring's fill
   * via `elapsed = total − remaining`.
   */
  subscriptionDaysRemaining: number;
  /** 1-based day count since profile.created_at. Drives the muted
   *  sub-line ("יום N ברצף תרגול …"). */
  currentPlanDay: number;
  /** Last in-flight practice session, or null when none is resumable. */
  lastSession: HeroLastSession;
};

/**
 * Slice 11.1 — Hero row.
 *
 * Slice 4 had two large navy cards (a 130–170px ring card + a
 * journey timeline). Slice 11 Phase B-1 removed the ring entirely
 * and left a tall single-column CTA card with a lot of dead
 * vertical space.
 *
 * Slice 11 Phase B-1.1 is a different shape: ONE full-width
 * navy-gradient bar, SHORT (content-height + modest padding), with
 * two horizontal regions:
 *
 *   - INLINE-START (visually right in RTL): small ring (~64–72px) +
 *     gold "המבחן בעוד {N} ימים" headline + muted "יום {planDay}
 *     ברצף תרגול · המשיכו במסע" sub-line.
 *   - INLINE-END (visually left in RTL): the resume mini-card — a
 *     small bordered pill with the "המשך מאיפה שעצרת" eyebrow + a
 *     gold CTA button labelled with the chapter + question number.
 *     When `lastSession` is null, this region collapses to the
 *     generic "התחל תרגול" CTA.
 *
 * The journey timeline ("המסע שלך") is NOT brought back into this
 * bar — Slice 11 B-1 moved it BELOW the chapters list and that
 * placement stays.
 *
 * Removed (vs Slice 11 B-1):
 *   - Decorative gold-glow + white-glow radial blobs (no more big
 *     dead vertical area).
 *   - The thin grey progress bar that lived inside the resume
 *     branch (it read like an empty bar after the ring was gone).
 */
export function HeroRow({
  daysToExam,
  subscriptionTotalDays,
  subscriptionDaysRemaining,
  currentPlanDay,
  lastSession,
}: Props) {
  const { dasharray } = computeRingDash(
    subscriptionDaysRemaining,
    subscriptionTotalDays
  );

  return (
    <section className="mb-5" aria-label="התחל תרגול">
      <div
        className="relative overflow-hidden rounded-[18px] px-5 py-4 md:px-6 md:py-5 text-white"
        style={{
          background:
            "linear-gradient(135deg, #15296B 0%, #1E3A8A 55%, #1A327B 100%)",
          boxShadow: "0 10px 28px -10px rgba(15, 31, 79, 0.40)",
        }}
      >
        {/* Horizontal flex layout. On mobile (< sm) the two regions
            stack so each gets full width; from sm up they share the
            row, vertically centered, with space-between. */}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CountdownRegion
            daysToExam={daysToExam}
            currentPlanDay={currentPlanDay}
            dasharray={dasharray}
          />
          <ResumeRegion lastSession={lastSession} />
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Inline-start region — small ring + countdown headline + sub-line
// =============================================================================

function CountdownRegion({
  daysToExam,
  currentPlanDay,
  dasharray,
}: {
  daysToExam: number | null;
  currentPlanDay: number;
  dasharray: string;
}) {
  return (
    <div className="flex items-center gap-4 min-w-0">
      {/* Small ring — 64–72px vs the Slice 4 130–170px. Same SVG
          geometry constants (RING_VIEWBOX/RADIUS/CENTER/CIRCUMFERENCE)
          so the gold-arc fill stays correct. */}
      <div className="relative shrink-0 size-[64px] md:size-[72px]">
        <svg
          viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
          className="size-full"
          style={{ transform: "rotate(-90deg)" }}
          aria-hidden
        >
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={14}
          />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={dasharray}
            strokeDashoffset={0}
            pathLength={RING_CIRCUMFERENCE}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-heebo font-extrabold tabular-nums"
            style={{
              fontSize: 18,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
            aria-hidden
          >
            {daysToExam ?? "—"}
          </span>
        </div>
      </div>

      {/* Headline + sub-line. min-w-0 + truncate so long Hebrew
          strings don't blow the bar's horizontal layout at narrow
          widths. */}
      <div className="min-w-0">
        <h2
          className="font-heebo font-bold leading-tight truncate"
          style={{
            fontSize: 18,
            color: "var(--color-gold)",
          }}
        >
          {daysToExam !== null
            ? `המבחן בעוד ${daysToExam} ימים`
            : "הוסף תאריך בחינה"}
        </h2>
        <p
          className="mt-0.5 truncate"
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: 12.5,
          }}
        >
          יום{" "}
          <span
            className="tabular-nums"
            style={{ color: "var(--color-gold)", fontWeight: 700 }}
          >
            {currentPlanDay}
          </span>{" "}
          ברצף תרגול · המשיכו במסע
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Inline-end region — resume mini-card or generic CTA
// =============================================================================

function ResumeRegion({ lastSession }: { lastSession: HeroLastSession }) {
  if (lastSession) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-[14px] border border-white/10 px-3 py-2",
          "bg-white/5"
        )}
      >
        <span
          className="font-heebo font-medium shrink-0"
          style={{
            fontSize: 11,
            color: "var(--color-gold)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          המשך מאיפה שעצרת
        </span>
        <Link
          href={`/practice/play/${lastSession.nextQuestionPosition - 1}`}
          className={cn(
            "btn-gold inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-heebo font-semibold whitespace-nowrap",
            "text-[12.5px] focus-visible:outline-none"
          )}
        >
          {lastSession.chapterTitle
            ? `${lastSession.chapterTitle} · שאלה ${lastSession.nextQuestionPosition}`
            : `שאלה ${lastSession.nextQuestionPosition}`}{" "}
          →
        </Link>
      </div>
    );
  }
  return (
    <Link
      href="/practice"
      className={cn(
        // Slice 36 — mobile-only stretch. `w-full justify-center` makes
        // the gold CTA fill the blue container's content width on
        // mobile with its icon + label optically centered; `sm:w-auto
        // sm:justify-start` reverts to the original content-sized,
        // start-aligned layout at sm+. `self-start` was dropped — it
        // forced cross-axis content sizing which would fight `w-full`.
        // At sm+ the parent flex flips to `flex-row sm:items-center
        // sm:justify-between`, so this button anchors via the parent.
        "btn-gold inline-flex shrink-0 items-center gap-2 w-full justify-center sm:w-auto sm:justify-start rounded-full px-5 py-2 font-heebo font-semibold whitespace-nowrap",
        "text-sm focus-visible:outline-none"
      )}
    >
      <Play className="size-4 fill-current" aria-hidden />
      התחל תרגול
    </Link>
  );
}
