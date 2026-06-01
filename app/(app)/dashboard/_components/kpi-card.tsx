import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Slice 4.X Phase 12 — Stat card matching the handoff prototype.
 * Slice 29 — flattened: dropped the head-row icon, the sparkline,
 * and the trend-pill render paths. Label + value are now centered;
 * the value enlarged from 32 → 40. Card padding tightened, radius
 * 14 → 12, bottom bar 3px → 2px. The `icon` / `sparkline` /
 * `trendPill` props remain on the type (marked DEPRECATED) so the
 * call sites in `kpi-row-async.tsx` need no change, but they are
 * ignored by the renderer.
 *
 * Anatomy now:
 *   1. Label (centered, 13px ink-dim)
 *   2. Big value (Heebo 800, 40px, navy-ink, centered, tabular-nums)
 *   3. Meta line (12.5px, ink-muted, centered)
 *   4. Full-width 2px bottom bar (gold / gold-soft / weak)
 */

export type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Sub-line under the value (e.g. "מקור 57 · זווית 160"). */
  meta?: ReactNode;
  /**
   * @deprecated Slice 29 — the head-row icon square was removed. Kept
   * on the type for back-compat with `kpi-row-async.tsx` call sites;
   * ignored by the renderer.
   */
  icon?: ReactNode;
  /**
   * @deprecated Slice 29 — the sparkline render path was removed.
   * Kept on the type for back-compat; ignored by the renderer.
   */
  sparkline?: number[];
  /**
   * @deprecated Slice 29 — the trend-pill render path was removed.
   * Kept on the type for back-compat; ignored by the renderer.
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
  padding: "14px 16px",
  background: "var(--card)",
  border: "1px solid var(--color-line)",
  borderRadius: "12px",
  position: "relative",
  overflow: "hidden",
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
  barTone = "gold",
}: Omit<StatCardProps, "href" | "hrefLabel" | "icon" | "sparkline" | "trendPill">) {
  return (
    <article style={CARD_STYLE}>
      <div
        className="font-heebo font-medium"
        style={{
          fontSize: 13,
          color: "var(--color-ink-dim)",
          textAlign: "center",
        }}
      >
        {label}
      </div>

      <div
        className="font-heebo font-extrabold tabular-nums"
        style={{
          fontSize: 40,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: "var(--color-navy-ink)",
          textAlign: "center",
          marginTop: 8,
        }}
      >
        {value}
      </div>

      {meta ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-ink-muted)",
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {meta}
        </div>
      ) : null}

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0"
        style={{ height: 2, background: BAR_TONE_BG[barTone] }}
      />
    </article>
  );
}

export function StatCard({
  href,
  hrefLabel,
  // Slice 29 — `icon`, `sparkline`, `trendPill` are kept on the
  // prop type for back-compat with the existing call sites in
  // `kpi-row-async.tsx` but ignored by the renderer. Pull them out
  // here so they don't reach `<CardInner>` as unknown JSX attrs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  icon: _icon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sparkline: _sparkline,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trendPill: _trendPill,
  ...rest
}: StatCardProps) {
  if (href) {
    return (
      <Link
        href={href}
        aria-label={hrefLabel ?? rest.label}
        className={cn(
          "block rounded-[12px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <CardInner {...rest} />
      </Link>
    );
  }
  return <CardInner {...rest} />;
}

// Slice 29 — file-local `Sparkline` and `TrendArrow` helpers
// removed; nothing else in the file referenced them.
