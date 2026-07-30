import { Flame } from "lucide-react";

/**
 * Slice 4.X Phase 13 — Streak card.
 *
 * Compact navy mini-card sitting under the trend chart in the
 * dashboard's right column. Shows:
 *   - "X יום ברצף" (consecutive practice days, from TrendData.streakDays)
 *   - A flame icon in a gold-tinted 44×44 circle
 *   - Next milestone hint ("הבא · רצף 7 ימים (עוד N)")
 *   - Optional best-streak badge top-right (passed as `personalHigh`
 *     for now — we don't track a separate best-streak yet; deferring
 *     real "best historical" per the Phase 13 spec)
 *
 * No-streak case (streakDays === 0): the body still renders so the
 * card has presence, but the milestone copy nudges toward starting.
 */

const STREAK_MILESTONES = [7, 14, 30, 100] as const;

function nextMilestone(streakDays: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (m > streakDays) return m;
  }
  return null;
}

type Props = {
  streakDays: number;
  /** Optional badge value — currently the user's personal-best accuracy %. */
  personalHigh?: number | null;
};

export function StreakCard({ streakDays, personalHigh }: Props) {
  const ms = nextMilestone(streakDays);
  const gap = ms !== null ? ms - streakDays : null;

  return (
    <div
      className="relative overflow-hidden rounded-[22px] text-white"
      style={{
        background: "linear-gradient(135deg, #15296B 0%, #1E3A8A 100%)",
        padding: "22px 24px",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -end-10 size-[180px] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201, 161, 73, 0.18), transparent 70%)",
        }}
      />

      <div className="relative flex items-center justify-between mb-4">
        <h3
          className="font-heebo font-bold text-white"
          style={{ fontSize: 16 }}
        >
          רצף יומי
        </h3>
        {personalHigh !== null && personalHigh !== undefined ? (
          <span
            className="font-heebo"
            style={{
              background: "rgba(201, 161, 73, 0.18)",
              color: "var(--color-gold)",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid rgba(201, 161, 73, 0.35)",
            }}
          >
            שיא · {Math.round(personalHigh)}%
          </span>
        ) : null}
      </div>

      <div className="relative flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(201, 161, 73, 0.18)",
            color: "var(--color-gold)",
          }}
          aria-hidden
        >
          <Flame className="size-5" fill="currentColor" strokeWidth={0} />
        </span>
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-heebo font-extrabold tabular-nums text-white"
              style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {streakDays}
            </span>
            <span
              style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)" }}
            >
              {streakDays === 1 ? "יום ברצף" : "ימים ברצף"}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.55)",
              marginTop: 4,
            }}
          >
            {ms !== null
              ? `הבא · רצף ${ms} ימים (עוד ${gap})`
              : "הגעת לכל המיילסטונים — כל הכבוד 🏆"}
          </div>
        </div>
      </div>
    </div>
  );
}
