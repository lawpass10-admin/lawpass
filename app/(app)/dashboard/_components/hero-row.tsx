import { Clock, ListChecks, Play } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  JOURNEY_MILESTONES,
  RING_CENTER,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  RING_VIEWBOX,
  computeRingDash,
  computeTrackFillPct,
  formatRelativeHebrew,
  pickNextMilestone,
} from "@/app/(app)/dashboard/_lib/hero-helpers";
import type { HeroLastSession } from "@/lib/dashboard/types";

type Props = {
  /** Days from today until the planned exam date. Null hides the ring number. */
  daysToExam: number | null;
  /**
   * Total days in the user's *subscription* window (90 for 3_months,
   * 180 for 6_months). Used as the denominator for the ring fill so the
   * ring reads as "% of paid plan elapsed" — fills to 100% exactly when
   * the subscription expires.
   */
  subscriptionTotalDays: number;
  /**
   * Days remaining on the active subscription (`ends_at − now`). Drives
   * the ring's fill — `elapsed = total − remaining`. Decoupled from
   * `daysToExam` on purpose: a 3-month plan with a Dec-2026 exam should
   * still show the plan clock ticking, not stay near-empty.
   */
  subscriptionDaysRemaining: number;
  /** 1-based day count since profile.created_at. */
  currentPlanDay: number;
  /** Last in-flight practice session, or null when none is resumable. */
  lastSession: HeroLastSession;
};

/**
 * Slice 4.X Phase 11 — Hero row.
 *
 * Two navy-gradient cards across the top of the dashboard:
 *   1. Ring + last-session resume (gold accents on navy).
 *   2. Journey path with 5 fixed milestones (today / 7d / 14d / 30d / 100d).
 *
 * No client interactivity — pure Server Component. The ring's
 * dasharray is computed once at render time; if the user reloads the
 * page tomorrow, the new server render produces the new value.
 */
export function HeroRow({
  daysToExam,
  subscriptionTotalDays,
  subscriptionDaysRemaining,
  currentPlanDay,
  lastSession,
}: Props) {
  return (
    <section
      className="grid grid-cols-1 gap-5 mb-5 lg:[grid-template-columns:1fr_1.4fr]"
      aria-label="סטטוס מסע ההכנה"
    >
      <RingCard
        daysToExam={daysToExam}
        subscriptionTotalDays={subscriptionTotalDays}
        subscriptionDaysRemaining={subscriptionDaysRemaining}
        lastSession={lastSession}
      />
      <JourneyCard currentDay={currentPlanDay} />
    </section>
  );
}

// =============================================================================
// Card 1 — Ring + last session
// =============================================================================

function RingCard({
  daysToExam,
  subscriptionTotalDays,
  subscriptionDaysRemaining,
  lastSession,
}: {
  daysToExam: number | null;
  subscriptionTotalDays: number;
  subscriptionDaysRemaining: number;
  lastSession: HeroLastSession;
}) {
  // Ring fill = % of subscription elapsed. Big-number-in-center stays
  // `daysToExam` so the two readings are orthogonal: ring = plan
  // urgency, number = exam countdown.
  const { dasharray } = computeRingDash(
    subscriptionDaysRemaining,
    subscriptionTotalDays
  );
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

      <div className="relative flex flex-col items-center gap-5 md:grid md:grid-cols-[auto_1fr] md:items-center md:gap-7">
        {/* Ring — Phase 14: viewBox 170 (r=73). Renders at 130×130 on
            mobile so the resume info has room beside it, and at 170×170
            on desktop matching the handoff prototype. The big-number
            font-size is consistent across breakpoints. */}
        <div className="relative shrink-0 size-[130px] md:size-[170px]">
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
              stroke="rgba(255, 255, 255, 0.10)"
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
              style={{
                filter: "drop-shadow(0 0 12px rgba(201, 161, 73, 0.45))",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="font-heebo font-extrabold tabular-nums text-[34px] md:text-[44px]"
              style={{ lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {daysToExam ?? "—"}
            </span>
            <span
              className="font-heebo font-semibold text-[13px] mt-1"
              style={{ color: "var(--color-gold)" }}
            >
              ימים
            </span>
            <span
              className="text-[10.5px] mt-1.5"
              style={{
                color: "rgba(255, 255, 255, 0.6)",
                letterSpacing: "0.04em",
              }}
            >
              עד הבחינה
            </span>
          </div>
        </div>

        {/* Info column — last session resume, or generic CTA when none */}
        <div className="flex min-w-0 flex-col gap-2.5">
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
    </div>
  );
}

// =============================================================================
// Card 2 — Journey
// =============================================================================

function JourneyCard({ currentDay }: { currentDay: number }) {
  const cappedDay = Math.min(currentDay, 100);
  const nextMilestone = pickNextMilestone(currentDay);
  // Phase 15: interpolate the track fill inside the current segment so
  // the gold bar visibly grows day-by-day, rather than snapping to the
  // last passed milestone. Anchors are the same %-positions used for
  // the step circles (5/28/52/73/95) — segments are 23/24/21/22% wide.
  const trackFillPct = computeTrackFillPct(currentDay);

  return (
    <div
      className="relative overflow-visible rounded-[22px] text-white"
      style={{
        background: "linear-gradient(135deg, #15296B 0%, #1E3A8A 100%)",
        boxShadow: "0 18px 40px -16px rgba(15, 31, 79, 0.40)",
        padding: "24px 28px 36px",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -start-20 size-[240px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201, 161, 73, 0.16), transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <Eyebrow>המסע שלך</Eyebrow>
          <h2
            className="font-heebo font-bold text-white"
            style={{ fontSize: 22, marginTop: 4, lineHeight: 1.15 }}
          >
            יום{" "}
            <span
              style={{ color: "var(--color-gold)", fontWeight: 800 }}
              className="tabular-nums"
            >
              {cappedDay}
            </span>{" "}
            מתוך 100
          </h2>
          {nextMilestone && (
            <div
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 13.5,
                marginTop: 6,
              }}
            >
              המיילסטון הבא:{" "}
              <b
                style={{ color: "var(--color-gold)", fontWeight: 700 }}
              >
                {nextMilestone.label}
              </b>{" "}
              · עוד {nextMilestone.daysUntil}{" "}
              {nextMilestone.daysUntil === 1 ? "יום" : "ימים"}
            </div>
          )}
        </div>
      </div>

      <JourneyPath currentDay={currentDay} trackFillPct={trackFillPct} />
    </div>
  );
}

function JourneyPath({
  currentDay,
  trackFillPct,
}: {
  currentDay: number;
  trackFillPct: number;
}) {
  return (
    <div
      className="relative mt-1"
      style={{ height: 110 }}
      aria-hidden
    >
      {/* Track — inherits the page's RTL direction, so logical
          start/end map to the right/left edges respectively. */}
      <div
        className="absolute top-[21px] h-1.5 rounded-[3px]"
        style={{
          insetInlineStart: 30,
          insetInlineEnd: 30,
          background: "rgba(255, 255, 255, 0.08)",
        }}
      />
      {/* Filled portion of the track — grows from the start edge (right
          in RTL) toward the end edge (left), mirroring the milestone
          flow so "יום 1" sits at the right and "מאסטר 100" at the left. */}
      <div
        className="absolute top-[21px] h-1.5 rounded-[3px]"
        style={{
          insetInlineStart: 30,
          width: `${trackFillPct}%`,
          background:
            "linear-gradient(270deg, var(--color-gold), var(--color-gold-deep))",
          boxShadow: "0 0 16px rgba(201, 161, 73, 0.55)",
        }}
      />

      {JOURNEY_MILESTONES.map((m, idx) => {
        const reached = currentDay >= m.day;
        const isCurrent =
          (currentDay >= m.day &&
            (idx === JOURNEY_MILESTONES.length - 1 ||
              currentDay < JOURNEY_MILESTONES[idx + 1].day)) ||
          (idx === 0 && currentDay < m.day);
        const isMilestone = idx === JOURNEY_MILESTONES.length - 1;
        const state: "done" | "current" | "locked" = isCurrent
          ? "current"
          : reached
            ? "done"
            : "locked";
        // Mobile rule: keep 3 anchors visible — current, the one
        // immediately after current, and the final milestone — so the
        // 5-step ladder doesn't overlap at narrow widths.
        const currentIdx = JOURNEY_MILESTONES.findIndex(
          (mm, i) =>
            currentDay >= mm.day &&
            (i === JOURNEY_MILESTONES.length - 1 ||
              currentDay < JOURNEY_MILESTONES[i + 1].day)
        );
        const isFinal = idx === JOURNEY_MILESTONES.length - 1;
        const isImmediateNext = idx === currentIdx + 1;
        const showOnMobile = state === "current" || isImmediateNext || isFinal;
        return (
          <JourneyStep
            key={m.day}
            position={m.position}
            label={m.label}
            day={m.day}
            state={state}
            isMilestone={isMilestone}
            hideOnMobile={!showOnMobile}
            currentDay={currentDay}
          />
        );
      })}
    </div>
  );
}

function JourneyStep({
  position,
  label,
  day,
  state,
  isMilestone,
  hideOnMobile = false,
  currentDay,
}: {
  position: number;
  label: string;
  day: number;
  state: "done" | "current" | "locked";
  isMilestone: boolean;
  hideOnMobile?: boolean;
  currentDay: number;
}) {
  const circleSize = isMilestone ? 48 : 44;
  return (
    <div
      className={cn(
        "absolute top-0 flex min-w-[58px] flex-col items-center gap-1.5 text-center",
        hideOnMobile && "hidden md:flex"
      )}
      style={{
        insetInlineStart: `calc(${position}% + 30px)`,
        transform: "translateX(50%)",
      }}
    >
      <div
        className={cn(
          "relative inline-flex items-center justify-center rounded-full font-heebo font-bold transition-all",
          state === "current" && "journey-pulse"
        )}
        style={{
          width: circleSize,
          height: circleSize,
          fontSize: 14,
          ...stepCircleStyle(state, isMilestone),
        }}
      >
        {state === "current" ? (
          // Phase 15: current step shows the user's *actual* day count
          // instead of the milestone label. Phase 16b: scaled the
          // stacked text down a notch (was 18/9) so the number nests
          // more comfortably inside the 44px circle.
          <span className="flex flex-col items-center leading-none">
            <span
              className="font-heebo font-extrabold tabular-nums"
              style={{ fontSize: 15, lineHeight: 1 }}
            >
              {Math.min(currentDay, 100)}
            </span>
            <span
              className="font-heebo"
              style={{
                fontSize: 8,
                color: "var(--color-gold-deep)",
                marginTop: 1,
                fontWeight: 600,
              }}
            >
              יום
            </span>
          </span>
        ) : isMilestone ? (
          <TrophyIcon />
        ) : (
          day
        )}
      </div>
      {/* Phase 16: single label per step — the older two-line render
          ("שבוע / 7 ימים") read as a duplicate now that the current
          step shows the real day count inside its circle. */}
      <div
        className="font-heebo font-bold"
        style={{
          fontSize: 12,
          color:
            state === "current"
              ? "var(--color-gold)"
              : state === "locked"
                ? "rgba(255, 255, 255, 0.55)"
                : "var(--color-white, #FFFFFF)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function stepCircleStyle(
  state: "done" | "current" | "locked",
  isMilestone: boolean
): React.CSSProperties {
  if (state === "current") {
    return {
      background: "#FFFFFF",
      border: "2px solid var(--color-gold)",
      color: "var(--color-gold-deep)",
      boxShadow:
        "0 0 0 6px rgba(201, 161, 73, 0.18), 0 8px 22px -4px rgba(201, 161, 73, 0.55)",
    };
  }
  if (state === "done") {
    return {
      background:
        "linear-gradient(135deg, var(--color-gold), var(--color-gold-deep))",
      border: "1.5px solid var(--color-gold)",
      color: "var(--color-navy-ink)",
      boxShadow: "0 6px 16px -4px rgba(201, 161, 73, 0.55)",
    };
  }
  return {
    background: "rgba(255, 255, 255, 0.04)",
    border: isMilestone
      ? "1.5px solid rgba(201, 161, 73, 0.45)"
      : "1.5px dashed rgba(255, 255, 255, 0.18)",
    color: "rgba(255, 255, 255, 0.45)",
  };
}

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

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
      <path
        d="M7 4h10v4a5 5 0 01-10 0V4zM5 6h2M17 6h2M9 14h6l-1 4h-4l-1-4zM8 18h8"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
