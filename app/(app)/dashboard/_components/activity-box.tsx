import type { SparklinePoint } from "@/lib/dashboard/types";

/**
 * Slice 29 — small "מדד פעילות" daily-activity box.
 * Slice 30 — joined the right-column trend/streak cluster:
 *   - radius 14 → 22 and padding "20px 24px 16px" → "22px 24px" to
 *     match `<StreakCard>` and the trend `<CardShell>` next to it.
 *   - line/path chart replaced with 7 vertical bars (one per day).
 *     Bars use navy/primary fill (#1E3A8A) with rounded tops; the
 *     last bar (today, IL-local) is highlighted in gold (#C9A149).
 *     The floating peak number was dropped — bar height itself is
 *     now the visual cue.
 *
 * Pure Server Component. The 7-day payload comes from
 * `dailyAccuracy[].attempts` on the already-cached `getKpiData()`
 * payload (see `activity-box-async.tsx`), so this slice introduces
 * NO new DB read.
 *
 * Visual:
 *   - eyebrow "מדד פעילות" (gold-deep, top-end)
 *   - eyebrow "7 ימים אחרונים" (ink-muted, top-start)
 *   - 7 bars, equal-width with small gaps, navy by default
 *   - today's bar gold
 *   - DD.MM labels under each bar
 *   - zero-attempt days render a thin baseline stub so the bar
 *     position is still legible
 */

const W = 360;
const H = 140;
const PADDING_X = 18;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 26;
const BAR_GAP = 8;
const BAR_RADIUS = 4;
const MIN_BAR_HEIGHT = 3;

const BAR_COLOR = "#1E3A8A"; // navy / primary
const BAR_COLOR_TODAY = "#C9A149"; // gold
const AXIS_LABEL_COLOR = "var(--color-ink-muted)";

export function ActivityBox({ points }: { points: SparklinePoint[] }) {
  // Defensive: the dashboard payload always returns 7 points, but
  // an empty/short array should still render an honest empty card
  // rather than crash the dashboard.
  const series = points.length >= 2 ? points : padToSeven(points);

  const counts = series.map((p) => p.attempts);
  const peak = counts.reduce((m, n) => (n > m ? n : m), 0);
  // Always show at least y=0..1 so a brand-new account (all zeros)
  // renders a flat baseline rather than a divide-by-zero crash.
  const yMax = peak === 0 ? 1 : peak;

  const innerW = W - PADDING_X * 2;
  const innerH = H - PADDING_TOP - PADDING_BOTTOM;
  const slotW = (innerW - BAR_GAP * (series.length - 1)) / series.length;

  return (
    <section
      className="relative overflow-hidden border bg-card"
      style={{
        padding: "22px 24px",
        borderRadius: 22,
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label="מדד פעילות — שאלות שתורגלו ב־7 הימים האחרונים"
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <span
          className="font-heebo"
          style={{ fontSize: 12.5, color: "var(--color-ink-muted)" }}
        >
          7 ימים אחרונים
        </span>
        <span
          className="font-heebo font-semibold"
          style={{ fontSize: 13.5, color: "var(--color-gold-deep)" }}
        >
          מדד פעילות
        </span>
      </header>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`שיא יומי ${peak} שאלות`}
        style={{ width: "100%", height: H, display: "block", direction: "ltr" }}
      >
        {series.map((p, i) => {
          const ratio = p.attempts / yMax;
          const fullHeight = ratio * innerH;
          // Even zero-attempt days get a 3px stub so the bar position
          // (and the day label below it) is still visually anchored.
          const barH = p.attempts === 0 ? MIN_BAR_HEIGHT : Math.max(fullHeight, MIN_BAR_HEIGHT);
          const x = PADDING_X + i * (slotW + BAR_GAP);
          const y = PADDING_TOP + (innerH - barH);
          const isToday = i === series.length - 1;
          const fill = isToday ? BAR_COLOR_TODAY : BAR_COLOR;
          // Zero-attempt non-today days render at low opacity so they
          // read as "no activity" rather than an artificial floor.
          const opacity = p.attempts === 0 && !isToday ? 0.25 : 1;
          return (
            <rect
              key={p.date + i}
              x={x}
              y={y}
              width={slotW}
              height={barH}
              rx={BAR_RADIUS}
              ry={BAR_RADIUS}
              fill={fill}
              opacity={opacity}
            />
          );
        })}

        {/* Day-of-month labels under each bar (IL local, DD.MM). */}
        {series.map((p, i) => {
          const cx = PADDING_X + i * (slotW + BAR_GAP) + slotW / 2;
          return (
            <text
              key={p.date + "-label-" + i}
              x={cx}
              y={H - 8}
              textAnchor="middle"
              fontSize="10.5"
              fontFamily="var(--font-mono)"
              fill={AXIS_LABEL_COLOR}
            >
              {formatDayLabel(p.date)}
            </text>
          );
        })}
      </svg>
    </section>
  );
}

/**
 * Format an IL-local `YYYY-MM-DD` (the shape `buildDailySparkline`
 * emits) as `DD.MM` for the axis labels. We deliberately don't
 * re-parse to a Date — the date string is already in IL local
 * time and we want exactly those digits.
 */
function formatDayLabel(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [, mm, dd] = parts;
  return `${dd}.${mm}`;
}

/**
 * Defensive padding when the dashboard payload somehow returns
 * fewer than 7 points. Pads on the LEFT (older days) with
 * zero-attempt placeholders so the chart never crashes.
 */
function padToSeven(points: SparklinePoint[]): SparklinePoint[] {
  if (points.length >= 7) return points;
  const out: SparklinePoint[] = [];
  for (let i = 0; i < 7 - points.length; i++) {
    out.push({ date: "0000-00-00", accuracy: null, attempts: 0 });
  }
  return [...out, ...points];
}
