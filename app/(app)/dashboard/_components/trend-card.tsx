import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import type { TrendData, TrendPoint } from "@/lib/dashboard/types";

/**
 * Slice 4.X Phase 13/14 — Trend card.
 *
 * Renders an 8-week area chart in the dashboard's right column. The
 * chart is ALWAYS shown — weeks without enough non-skipped attempts
 * (TrendPoint.accuracy === null) plot at the chart baseline (0%) with
 * a muted dot, so the x-axis stays consistent and the path "grows" as
 * the user accumulates data.
 *
 * Highlights:
 *   - Peak dot (highest accuracy among real-data weeks) — gold fill.
 *   - Current-week dot (last real-data week, if different) — gold fill,
 *     slightly larger than other markers.
 *   - Empty-week dots — line/line-strong, 50% opacity, no glow.
 *   - Callout has two variants: with ≥3 active weeks it shows the
 *     personal-high + delta; with <3 it nudges the user to keep
 *     practicing.
 *
 * Slice 32 — the streak card moved OUT of TrendCard and up into
 * `TrendCardAsync` so the right-column stack can be reordered
 * (trend → activity → streak). TrendCard now renders only the
 * gold accuracy chart (the `<CardShell>` block); the outer flex-col
 * also moved up into TrendCardAsync.
 */

const ACTIVE_WEEKS_FOR_HIGH_CALLOUT = 3;
// Chart geometry — kept tight to match the prototype's coordinate
// system. The SVG itself is scaled responsively via CSS width:100%,
// but the path math is computed in viewBox units.
const VIEW_W = 360;
const VIEW_H = 160;
const CHART_TOP_Y = 40;
const CHART_BOTTOM_Y = 120;
const X_LEFT = 30;
const X_RIGHT = 345;
const SLOTS = 8;
const X_STEP = (X_RIGHT - X_LEFT) / (SLOTS - 1);

type Props = {
  data: TrendData;
};

// =============================================================================
// Helpers
// =============================================================================

function snapToTen(value: number, mode: "ceil" | "floor"): number {
  return mode === "ceil"
    ? Math.ceil(value / 10) * 10
    : Math.floor(value / 10) * 10;
}

/**
 * Y window for the chart. yMin is anchored at 0% so empty weeks have a
 * stable baseline; yMax snaps up to the nearest 10 from the max
 * observed accuracy, with a floor of 40 so a brand-new user sees a
 * normal-looking chart rather than an extreme zoom around the first
 * 5% week.
 */
function pickYRange(values: number[]): { yMin: number; yMax: number } {
  const yMin = 0;
  if (values.length === 0) return { yMin, yMax: 40 };
  const yMax = Math.max(40, snapToTen(Math.max(...values), "ceil"));
  return { yMin, yMax };
}

function buildChartPaths(
  points: TrendPoint[],
  yMin: number,
  yMax: number
): { line: string; area: string; coords: Array<{ x: number; y: number }> } {
  const yRange = yMax - yMin || 1;
  const coords = points.map((p, i) => {
    const x = X_LEFT + i * X_STEP;
    // Null accuracies plot at yMin (the chart baseline). The dot
    // styling for the null case is decided in the renderer, but the
    // path passes through 0% so the area fill stays connected.
    const accForPath = p.accuracy ?? yMin;
    const y =
      CHART_TOP_Y +
      (1 - (accForPath - yMin) / yRange) * (CHART_BOTTOM_Y - CHART_TOP_Y);
    return { x, y };
  });
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${X_RIGHT.toFixed(1)},${(CHART_BOTTOM_Y + 30).toFixed(
    1
  )} L${X_LEFT.toFixed(1)},${(CHART_BOTTOM_Y + 30).toFixed(1)} Z`;
  return { line: linePath, area: areaPath, coords };
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[22px] border bg-card"
      style={{
        padding: "22px 24px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// Main render
// =============================================================================

export function TrendCard({ data }: Props) {
  // Slice 32 — `streakDays` + `personalHigh` no longer destructured;
  // they are consumed by `<StreakCard>` rendered up in TrendCardAsync.
  const { weeklyPoints } = data;
  // Always take the trailing 8 weeks. `weeklyPoints` is always 12
  // entries (see `getTrendData`), so this slice is stable.
  const last8 = weeklyPoints.slice(-SLOTS);
  const activeWeeks = last8.filter((p) => p.accuracy !== null).length;
  const accuracies = last8
    .map((p) => p.accuracy)
    .filter((a): a is number => a !== null);
  const { yMin, yMax } = pickYRange(accuracies);
  const { line, area, coords } = buildChartPaths(last8, yMin, yMax);

  // Peak + current markers — only on real-data weeks.
  let peakIdx = -1;
  let peakAcc = -Infinity;
  let lastNonNullIdx = -1;
  last8.forEach((p, i) => {
    if (p.accuracy === null) return;
    if (p.accuracy > peakAcc) {
      peakAcc = p.accuracy;
      peakIdx = i;
    }
    lastNonNullIdx = i;
  });

  const firstNonNullPoint = last8.find((p) => p.accuracy !== null);
  const lastAccuracy =
    lastNonNullIdx >= 0 ? last8[lastNonNullIdx].accuracy : null;
  const deltaFromFirst =
    firstNonNullPoint && firstNonNullPoint.accuracy !== null && lastAccuracy !== null
      ? Math.round(lastAccuracy - firstNonNullPoint.accuracy)
      : null;

  // Three evenly-spaced y-axis grid lines + labels at yMin, mid, yMax.
  const gridValues = [yMax, Math.round((yMin + yMax) / 2), yMin];
  const gridY = (v: number) =>
    CHART_TOP_Y + (1 - (v - yMin) / (yMax - yMin)) * (CHART_BOTTOM_Y - CHART_TOP_Y);

  return (
    <CardShell>
        <div className="flex items-center justify-between mb-3.5">
          <h3
            className="font-heebo font-bold"
            style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
          >
            מגמת הצלחה
          </h3>
          <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            8 שבועות אחרונים
          </span>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`מגמת אחוז הצלחה ב-8 שבועות אחרונים, ${activeWeeks} שבועות פעילים`}
          style={{ width: "100%", height: 160, display: "block", direction: "ltr" }}
        >
          <defs>
            <linearGradient id="trend-gold-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A149" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#C9A149" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid lines + y-axis labels */}
          {gridValues.map((v) => {
            const y = gridY(v);
            return (
              <g key={v}>
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
                  {v}%
                </text>
              </g>
            );
          })}

          {/* Area + line */}
          <path d={area} fill="url(#trend-gold-area)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-gold-deep)"
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots — muted on null weeks, gold on peak / current. */}
          {coords.map((c, i) => {
            const point = last8[i];
            const isReal = point.accuracy !== null;
            const isPeak = isReal && i === peakIdx;
            const isCurrent =
              isReal && i === lastNonNullIdx && lastNonNullIdx !== peakIdx;
            if (!isReal) {
              return (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={3.5}
                  fill="var(--color-line)"
                  stroke="var(--color-line-strong)"
                  strokeWidth={1.5}
                  opacity={0.5}
                />
              );
            }
            const radius = isCurrent ? 5 : isPeak ? 4.5 : 3.5;
            const fill =
              isPeak || isCurrent ? "var(--color-gold)" : "var(--card)";
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={radius}
                fill={fill}
                stroke="var(--color-gold-deep)"
                strokeWidth={2}
              />
            );
          })}

          {/* X-axis week labels — fixed positions matching the prototype */}
          <text
            x={X_LEFT}
            y={155}
            textAnchor="middle"
            fill="var(--color-ink-muted)"
            fontFamily="Heebo, sans-serif"
            fontSize={11}
          >
            ש&apos; 1
          </text>
          <text
            x={X_LEFT + 2 * X_STEP}
            y={155}
            textAnchor="middle"
            fill="var(--color-ink-muted)"
            fontFamily="Heebo, sans-serif"
            fontSize={11}
          >
            ש&apos; 3
          </text>
          <text
            x={X_LEFT + 4 * X_STEP}
            y={155}
            textAnchor="middle"
            fill="var(--color-ink-muted)"
            fontFamily="Heebo, sans-serif"
            fontSize={11}
          >
            ש&apos; 5
          </text>
          <text
            x={X_RIGHT}
            y={155}
            textAnchor="middle"
            fill="var(--color-ink-muted)"
            fontFamily="Heebo, sans-serif"
            fontSize={11}
          >
            השבוע
          </text>
        </svg>

        {/* Callout — variant by active-week count */}
        {activeWeeks >= ACTIVE_WEEKS_FOR_HIGH_CALLOUT && lastAccuracy !== null ? (
          <div
            className="flex items-center gap-2.5"
            style={{
              background: "var(--color-gold-tint)",
              border: "1px solid rgba(201, 161, 73, 0.4)",
              borderRadius: 8,
              padding: "10px 14px",
              marginTop: 14,
              fontSize: 13,
              color: "var(--color-navy-ink)",
            }}
          >
            <CheckCircle2
              className="size-[18px] shrink-0"
              style={{ color: "var(--color-gold-deep)" }}
              aria-hidden
            />
            <span>
              שיא אישי השבוע —{" "}
              <b style={{ color: "var(--color-gold-deep)" }}>
                {Math.round(lastAccuracy)}% הצלחה
              </b>
              {deltaFromFirst !== null && deltaFromFirst !== 0
                ? `. ${deltaFromFirst >= 0 ? "+" : ""}${deltaFromFirst}% מהשבוע הראשון.`
                : "."}
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5"
            style={{
              background: "var(--color-gold-tint)",
              border: "1px solid rgba(201, 161, 73, 0.4)",
              borderRadius: 8,
              padding: "10px 14px",
              marginTop: 14,
              fontSize: 13,
              color: "var(--color-navy-ink)",
            }}
          >
            <CheckCircle2
              className="size-[18px] shrink-0"
              style={{ color: "var(--color-gold-deep)" }}
              aria-hidden
            />
            <span>
              המגמה תתבסס ככל שתתרגלו עוד.{" "}
              <Link
                href="/practice"
                className="font-semibold underline underline-offset-2 hover:no-underline"
                style={{ color: "var(--color-gold-deep)" }}
              >
                התחילו עכשיו
              </Link>
              .
            </span>
          </div>
        )}
    </CardShell>
  );
}
