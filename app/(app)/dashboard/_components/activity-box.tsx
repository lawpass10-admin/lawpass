import type { SparklinePoint } from "@/lib/dashboard/types";

/**
 * Slice 29 — small "מדד פעילות" daily-activity box.
 * Slice 30 — joined the right-column trend/streak cluster (radius
 *   22, padding 22×24).
 * Slice 31 — minimal line chart.
 * Slice 32 — adopts the FULL chart language of `<TrendCard>` so the
 *   two charts read as siblings. Mirrored deliberately (not via a
 *   shared component) — the accuracy chart and the daily-attempts
 *   chart only share visual language, not data semantics; unifying
 *   them would fatten the API faster than it would pay back.
 *
 * Mirror from `trend-card.tsx`:
 *   - Geometry: VIEW 360×160, X_LEFT/X_RIGHT 30/345, CHART_TOP/BOTTOM 40/120.
 *   - 3 dashed horizontal gridlines (stroke var(--color-line),
 *     strokeWidth 1, dasharray "3 3") at yMax / yMax/2 / 0.
 *   - Y-axis labels at x=0, y=gridY(v)+4, Heebo 11px ink-muted —
 *     integers, no `%` suffix (this chart counts attempts, not %).
 *   - Area gradient under the line: navy (#0F1F4F) 0.30 → 0.02
 *     vertically, area path extended +30 units below CHART_BOTTOM_Y
 *     so the bottom edge bleeds past the axis baseline.
 *   - Line: navy #0F1F4F, strokeWidth 2.2, round join/cap.
 *   - Markers: uniform (no peak/current/today variant) — r 3.5, fill
 *     card-bg, stroke navy 2.
 *   - X-axis labels: per-point DD.MM in Heebo 11px ink-muted at y=155.
 *   - Header parity: title <h3> Heebo bold 16px navy-ink (FIRST in
 *     DOM); eyebrow <span> 12px ink-muted (SECOND).
 *
 * Pure Server Component. The 7-day payload comes from
 * `dailyAccuracy[].attempts` on the already-cached `getKpiData()`
 * payload (see `activity-box-async.tsx`), so this slice introduces
 * NO new DB read.
 */

// Geometry constants — copied verbatim from `trend-card.tsx` so the
// two charts share spatial language. SLOTS=7 (one point per day in
// the last 7 IL-local days) so X_STEP differs from TrendCard's 8.
const VIEW_W = 360;
const VIEW_H = 160;
const CHART_TOP_Y = 40;
const CHART_BOTTOM_Y = 120;
const X_LEFT = 30;
const X_RIGHT = 345;
const SLOTS = 7;
const X_STEP = (X_RIGHT - X_LEFT) / (SLOTS - 1); // = 52.5
const AREA_CLOSE_Y = CHART_BOTTOM_Y + 30; // matches TrendCard's "+30" overshoot

const LINE_COLOR = "#0F1F4F";
const AREA_GRADIENT_ID = "activity-navy-area";

export function ActivityBox({ points }: { points: SparklinePoint[] }) {
  // Defensive: the dashboard payload always returns 7 points, but
  // an empty/short array should still render an honest empty card
  // rather than crash the dashboard.
  const series = points.length >= 2 ? points : padToSeven(points);

  const counts = series.map((p) => p.attempts);
  const peak = counts.reduce((m, n) => (n > m ? n : m), 0);
  // Always show at least y=0..1 so a brand-new account (all zeros)
  // renders a flat baseline rather than a divide-by-zero crash.
  const yMin = 0;
  const yMax = Math.max(1, peak);

  const gridValues = [yMax, Math.round(yMax / 2), yMin];
  const gridY = (v: number) =>
    CHART_TOP_Y + (1 - (v - yMin) / (yMax - yMin)) * (CHART_BOTTOM_Y - CHART_TOP_Y);

  const coords = series.map((p, i) => ({
    x: X_LEFT + i * X_STEP,
    y: gridY(p.attempts),
    point: p,
  }));

  const linePath = coords
    .map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${X_RIGHT.toFixed(1)},${AREA_CLOSE_Y.toFixed(1)} L${X_LEFT.toFixed(1)},${AREA_CLOSE_Y.toFixed(1)} Z`;

  return (
    <div
      className="rounded-[22px] border bg-card"
      style={{
        padding: "22px 24px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header — mirrors TrendCard's title/eyebrow pair exactly. */}
      <div
        className="flex items-center justify-between mb-3.5"
        // No explicit aria-label on the card itself — the <h3> below
        // is the accessible heading. The SVG inside carries its own
        // role="img" + aria-label for the chart contents.
      >
        <h3
          className="font-heebo font-bold"
          style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
        >
          מדד פעילות
        </h3>
        <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
          7 ימים אחרונים
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`מדד פעילות יומי — 7 ימים אחרונים, שיא יומי ${peak} שאלות`}
        style={{ width: "100%", height: VIEW_H, display: "block", direction: "ltr" }}
      >
        <defs>
          <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.3} />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Gridlines + y-axis labels — three rows: yMax / yMax/2 / 0. */}
        {gridValues.map((v, i) => {
          const y = gridY(v);
          return (
            <g key={i}>
              <line
                x1={X_LEFT}
                x2={X_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={0}
                y={y + 4}
                fill="var(--color-ink-muted)"
                fontFamily="Heebo, sans-serif"
                fontSize={11}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Area fill — drawn BEFORE the line so the polyline sits on top. */}
        <path d={areaPath} fill={`url(#${AREA_GRADIENT_ID})`} />

        {/* Line through the 7 points — straight segments. */}
        <path
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Uniform circle markers — no peak/current/today variant. */}
        {coords.map(({ x, y, point }, i) => (
          <circle
            key={point.date + "-" + i}
            cx={x}
            cy={y}
            r={3.5}
            fill="var(--card)"
            stroke={LINE_COLOR}
            strokeWidth={2}
          />
        ))}

        {/* Day-of-month labels under each point (IL local, DD.MM). */}
        {coords.map(({ x, point }, i) => (
          <text
            key={point.date + "-label-" + i}
            x={x}
            y={155}
            textAnchor="middle"
            fontFamily="Heebo, sans-serif"
            fontSize={11}
            fill="var(--color-ink-muted)"
          >
            {formatDayLabel(point.date)}
          </text>
        ))}
      </svg>
    </div>
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
