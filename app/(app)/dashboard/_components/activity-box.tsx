import type { SparklinePoint } from "@/lib/dashboard/types";

/**
 * Slice 29 — small "מדד פעילות" daily-activity box.
 * Slice 30 — joined the right-column trend/streak cluster (radius
 *   22, padding 22×24).
 * Slice 31 — chart body swapped from vertical bars back to a minimal
 *   line chart matching Sharon's proposal:
 *     - single thin polyline through the 7 daily points (no
 *       smoothing, no area fill)
 *     - uniform small filled circle marker at each point
 *     - navy (#0F1F4F) line + markers
 *     - y-axis labels show only `0` (baseline) and `max` (top), at
 *       the visual-start (right) edge of the chart
 *     - no gridlines beyond a single very faint baseline
 *     - zero-attempt days sit at the baseline like any other point,
 *       no special stub
 *     - no peak callout text, no "today" highlight
 *
 * Pure Server Component. The 7-day payload comes from
 * `dailyAccuracy[].attempts` on the already-cached `getKpiData()`
 * payload (see `activity-box-async.tsx`), so this slice introduces
 * NO new DB read.
 */

const W = 360;
const H = 140;
const PADDING_X = 32; // room for the y-axis labels on the visual-start edge
const PADDING_TOP = 14;
const PADDING_BOTTOM = 26;

const LINE_COLOR = "#0F1F4F";
const BASELINE_COLOR = "rgba(15, 31, 79, 0.10)";
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
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const baselineY = PADDING_TOP + innerH;

  const coords = series.map((p, i) => {
    const x = PADDING_X + i * stepX;
    // Zero-attempt days land on the baseline (y = baselineY).
    const y = PADDING_TOP + (1 - p.attempts / yMax) * innerH;
    return { x, y, point: p };
  });

  const linePath = coords
    .map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

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
        {/* Single very faint baseline — the only horizontal guide. */}
        <line
          x1={PADDING_X}
          x2={W - PADDING_X}
          y1={baselineY}
          y2={baselineY}
          stroke={BASELINE_COLOR}
          strokeWidth={1}
        />

        {/* Y-axis labels — only `max` at the top and `0` at the
            baseline, anchored at the visual-start (right) edge so
            the RTL card reads them as the leading edge. */}
        <text
          x={W - PADDING_X + 6}
          y={PADDING_TOP + 4}
          textAnchor="start"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill={AXIS_LABEL_COLOR}
        >
          {peak}
        </text>
        <text
          x={W - PADDING_X + 6}
          y={baselineY + 4}
          textAnchor="start"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill={AXIS_LABEL_COLOR}
        >
          0
        </text>

        {/* Polyline through the 7 points — straight segments. */}
        <path
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Uniform filled circle markers. */}
        {coords.map(({ x, y, point }, i) => (
          <circle
            key={point.date + "-" + i}
            cx={x}
            cy={y}
            r={3}
            fill={LINE_COLOR}
          />
        ))}

        {/* Day-of-month labels under each point (IL local, DD.MM). */}
        {coords.map(({ x, point }, i) => (
          <text
            key={point.date + "-label-" + i}
            x={x}
            y={H - 8}
            textAnchor="middle"
            fontSize="10.5"
            fontFamily="var(--font-mono)"
            fill={AXIS_LABEL_COLOR}
          >
            {formatDayLabel(point.date)}
          </text>
        ))}
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
