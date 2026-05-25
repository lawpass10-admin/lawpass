import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Slice 4.X Phase 12 — Stat card matching the handoff prototype.
 *
 * Anatomy (top → bottom):
 *   1. Head row: label (left) + gold-tinted icon square (right).
 *   2. Big value (Heebo 800, navy-ink).
 *   3. Meta line (12.5px, ink-muted).
 *   4. Optional accent — either a sparkline (80×28) OR a trend pill.
 *   5. Full-width 3px bottom bar (gold by default; status-weak for the
 *      "טעויות" card to act as a warning hint).
 *
 * The card is positioned `relative` so the sparkline + bar can absolute-
 * position without a wrapper div.
 */

export type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Sub-line under the value (e.g. "מקור 57 · זווית 160"). */
  meta?: ReactNode;
  /** Icon shown in the 32×32 gold-tint square. */
  icon: ReactNode;
  /** Optional sparkline data — array of numbers, lowest at index 0. */
  sparkline?: number[];
  /**
   * Optional trend pill (rendered in place of the sparkline when both
   * are passed — the sparkline wins because that's the primary affordance).
   */
  trendPill?: {
    label: string;
    /** Direction colors: `up` = status-strong (green), `down` = status-weak (amber). */
    direction: "up" | "down";
  };
  /** Bottom-bar colour. Defaults to gold; pass status-weak for warning. */
  barTone?: "gold" | "gold-soft" | "weak";
  /** When set, wraps the card in a Link for navigation. */
  href?: string;
  hrefLabel?: string;
};

const CARD_STYLE: CSSProperties = {
  padding: "18px 20px",
  background: "var(--card)",
  border: "1px solid var(--color-line)",
  borderRadius: "14px",
  position: "relative",
  overflow: "hidden",
  transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
};

const BAR_TONE_BG: Record<NonNullable<StatCardProps["barTone"]>, string> = {
  gold: "var(--color-gold)",
  "gold-soft": "rgba(201, 161, 73, 0.4)",
  weak: "var(--color-status-weak)",
};

function CardInner({
  label,
  value,
  meta,
  icon,
  sparkline,
  trendPill,
  barTone = "gold",
}: Omit<StatCardProps, "href" | "hrefLabel">) {
  return (
    <article style={CARD_STYLE} className="hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="font-heebo font-medium"
          style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
        >
          {label}
        </span>
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--color-gold-tint)",
            color: "var(--color-gold-deep)",
          }}
          aria-hidden
        >
          {icon}
        </span>
      </div>

      <div
        className="font-heebo font-extrabold tabular-nums"
        style={{
          fontSize: 32,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: "var(--color-navy-ink)",
        }}
      >
        {value}
      </div>

      {meta ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-ink-muted)",
            marginTop: 6,
          }}
        >
          {meta}
        </div>
      ) : null}

      {sparkline && sparkline.length > 1 ? (
        <Sparkline values={sparkline} />
      ) : trendPill ? (
        <div
          className="inline-flex items-center gap-1 font-heebo"
          style={{
            fontSize: 12,
            fontWeight: 600,
            marginTop: 6,
            color:
              trendPill.direction === "up"
                ? "var(--color-status-strong)"
                : "var(--color-status-weak)",
          }}
        >
          <TrendArrow direction={trendPill.direction} />
          {trendPill.label}
        </div>
      ) : null}

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0"
        style={{ height: 3, background: BAR_TONE_BG[barTone] }}
      />
    </article>
  );
}

export function StatCard({ href, hrefLabel, ...rest }: StatCardProps) {
  if (href) {
    return (
      <Link
        href={href}
        aria-label={hrefLabel ?? rest.label}
        className={cn(
          "block rounded-[14px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <CardInner {...rest} />
      </Link>
    );
  }
  return <CardInner {...rest} />;
}

// =============================================================================
// Sparkline
// =============================================================================

/**
 * 80×28 sparkline. Builds a polyline through the input values, scaled
 * to the box height with 2px top/bottom padding so peaks/troughs don't
 * touch the edges. The area fill closes the path to the baseline.
 *
 * `preserveAspectRatio="none"` stretches the path horizontally — the
 * box can be sized via CSS without re-drawing. Stroke is non-scaling.
 */
function Sparkline({ values }: { values: number[] }) {
  const w = 80;
  const h = 28;
  const padY = 2;
  // When all values are equal (e.g. all-zero), draw a flat midline.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <svg
      className="absolute"
      style={{ insetInlineEnd: 16, bottom: 12, width: 80, height: 28, opacity: 0.9 }}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={areaPath} fill="rgba(201, 161, 73, 0.18)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={1.8}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function TrendArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 11 11" className="size-2.5" fill="currentColor" aria-hidden>
      {direction === "up" ? (
        <path d="M5.5 2l3 4h-2v3h-2V6h-2z" />
      ) : (
        <path d="M5.5 9l3-4h-2V2h-2v3h-2z" />
      )}
    </svg>
  );
}
