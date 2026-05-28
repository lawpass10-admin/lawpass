import {
  JOURNEY_MILESTONES,
  computeTrackFillPct,
  pickNextMilestone,
} from "@/app/(app)/dashboard/_lib/hero-helpers";
import { cn } from "@/lib/utils";

/**
 * Slice 11 — extracted from hero-row.tsx so the dashboard page can
 * relocate the "המסע שלך" timeline below the chapters list (per the
 * QA-driven redesign). Same JSX, same milestones, same gold-on-navy
 * styling — the only structural change is the new file location.
 *
 * Renders a single navy-gradient card with:
 *   - Eyebrow "המסע שלך"
 *   - "יום N מתוך 100" headline
 *   - Next-milestone hint line
 *   - Horizontal 5-step path (התחלה / שבוע / שבועיים / חודש / מאסטר)
 *
 * No client interactivity — pure Server Component. Depends ONLY on
 * `currentDay` (computed once per request from profile.created_at in
 * the dashboard page Server Component).
 */
export function JourneyCard({ currentDay }: { currentDay: number }) {
  const cappedDay = Math.min(currentDay, 100);
  const nextMilestone = pickNextMilestone(currentDay);
  // Interpolate the track fill inside the current segment so the gold
  // bar visibly grows day-by-day, rather than snapping to the last
  // passed milestone. Anchors are the same %-positions used for the
  // step circles (5/28/52/73/95) — segments are 23/24/21/22% wide.
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
    <div className="relative mt-1" style={{ height: 110 }} aria-hidden>
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
          // Current step shows the user's *actual* day count instead
          // of the milestone label so the number visibly nests inside
          // the 44px circle.
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
