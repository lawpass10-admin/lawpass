import type { SparklinePoint } from "@/lib/dashboard/types";

/**
 * Slice 29 — small "מדד פעילות" daily-activity box.
 *
 * Renders the user's last 7 days of attempt counts as a compact line
 * chart inside a regular bordered card. Replaces the large
 * "המסע שלך" navy block at the bottom of the dashboard.
 *
 * Pure Server Component. The 7-day payload comes from
 * `dailyAccuracy[].attempts` on the already-cached `getKpiData()`
 * payload (see `activity-box-async.tsx`), so this slice introduces
 * NO new DB read.
 *
 * Visual target (Sharon's image):
 *   - eyebrow "מדד פעילות" (gold, top-end)
 *   - small line chart (~120px tall) with:
 *       - dotted/light baseline + dotted grid (no heavy axes)
 *       - line + circular markers per day (current-day filled differently)
 *       - a single y-axis label showing the peak count
 *       - day-of-month labels under each point in IL-local DD.MM
 *   - white card, navy-ink line color, gold accent for the markers
 */

const W = 360;
const H = 120;
const PADDING_X = 32; // room for the y-axis peak label
const PADDING_TOP = 14;
const PADDING_BOTTOM = 28; // room for the day labels

const LINE_COLOR = "var(--color-navy-ink)";
const MARKER_FILL = "var(--card)";
const MARKER_FILL_PEAK = "var(--color-gold)";
const GRID_COLOR = "rgba(15, 31, 79, 0.10)";
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
  const yMin = 0;

  const innerW = W - PADDING_X * 2;
  const innerH = H - PADDING_TOP - PADDING_BOTTOM;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

  const coords = series.map((p, i) => {
    const x = PADDING_X + i * stepX;
    const y =
      PADDING_TOP + (1 - (p.attempts - yMin) / (yMax - yMin)) * innerH;
    return { x, y, point: p };
  });

  const linePath = coords
    .map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  // Three grid lines: top (yMax), middle, bottom (0).
  const gridLines = [PADDING_TOP, PADDING_TOP + innerH / 2, PADDING_TOP + innerH];

  return (
    <section
      className="relative overflow-hidden rounded-[14px] border bg-card"
      style={{
        padding: "20px 24px 16px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label="מדד פעילות — שאלות שתורגלו ב־7 הימים האחרונים"
    >
      <header className="mb-2 flex items-baseline justify-between gap-3">
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
        {/* Grid */}
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={PADDING_X}
            x2={W - PADDING_X}
            y1={y}
            y2={y}
            stroke={GRID_COLOR}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}

        {/* Peak y-axis label (visual-start = RTL right edge of the chart) */}
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

        {/* Line through the points. */}
        <path
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Markers — last point is filled gold (current day). */}
        {coords.map(({ x, y, point }, i) => {
          const isLast = i === coords.length - 1;
          return (
            <circle
              key={point.date}
              cx={x}
              cy={y}
              r={isLast ? 4.5 : 3.5}
              fill={isLast ? MARKER_FILL_PEAK : MARKER_FILL}
              stroke={LINE_COLOR}
              strokeWidth={1.6}
            />
          );
        })}

        {/* Day-of-month labels under each point (IL local, DD.MM). */}
        {coords.map(({ x, point }) => (
          <text
            key={point.date}
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
