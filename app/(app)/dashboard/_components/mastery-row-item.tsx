import Link from "next/link";
import type { CSSProperties } from "react";

import { ChapterIcon } from "@/app/(app)/dashboard/_components/chapter-icon";
import { buttonVariants } from "@/components/ui/button";
import type { MasteryRow } from "@/lib/dashboard/types";
import { practiceSetupUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

/**
 * Slice 11 — extracted from mastery-card.tsx so the row stays a pure
 * presentational module that both the (server) `<MasteryCard>` chrome
 * and the (client) `<MasteryRowsClient>` filter/collapse host can
 * render without type/runtime gymnastics. Visuals are byte-for-byte
 * preserved from the Slice 4 version.
 *
 * The component is itself plain JSX with no async / no server-only
 * imports, so rendering it inside a "use client" parent compiles
 * cleanly. The whole row is a <Link> to the practice-setup deep link
 * for this chapter.
 */

type MasteryState = "weak" | "ok" | "strong" | "empty";

/**
 * Slice 39 — uniform tile for every state (drops per-state color
 * coding); weakness signaling lives on the pill + meta line, not
 * the tile. Per-chapter <ChapterIcon> stays as-is and inherits
 * `currentColor` from this tile's `color` style.
 *
 * Slice 40 — final Claude Design spec: gold-tint tile (#FBF6E4),
 * 42×42, radius 12, hairline gold border at 25% opacity. Icon glyph
 * stays gold-deep (#A8862E) via currentColor. The dark navy tile
 * from Slice 39 is gone — the row now reads as a single warm
 * gold language at the start edge.
 */
const ICON_TILE_STYLE: CSSProperties = {
  background: "var(--color-gold-tint)",
  color: "var(--color-gold-deep)",
  border: "1px solid rgba(201, 161, 73, 0.25)",
};
const ICON_TILE_SIZE = 42;
const ICON_TILE_RADIUS = 12;

/** Weakness threshold — accuracy < 60% AND non-skipped attempts >= 5. */
const WEAKNESS_ACCURACY_PCT = 60;
const MIN_ATTEMPTS_FOR_WEAKNESS = 5;
const STRONG_ACCURACY_PCT = 75;

/** Per-row "תרגל" deep-link defaults. Matches PrefillInput in
 *  lib/urls.ts; sized toward "quick weakness remediation". */
const PRACTICE_DEEPLINK_DEFAULTS = {
  sourceCount: 5,
  angles: 2,
  timePerQuestion: 150,
} as const;

export function isWeakness(row: MasteryRow): boolean {
  if (row.accuracy === null) return false;
  if (row.accuracy >= WEAKNESS_ACCURACY_PCT) return false;
  return row.total - row.skipped >= MIN_ATTEMPTS_FOR_WEAKNESS;
}

export function masteryState(row: MasteryRow): MasteryState {
  if (row.accuracy === null) return "empty";
  if (isWeakness(row)) return "weak";
  if (row.accuracy >= STRONG_ACCURACY_PCT) return "strong";
  return "ok";
}

/**
 * Slice 39 — bar fill collapses to a single brand color for every
 * non-null row (drops per-state coding).
 * Slice 40 — fill is now a gold→gold-deep linear gradient. Empty
 * rows pass `null` to signal "draw a dashed empty track + no fill"
 * — `<MasteryBar>` switches its track styling based on that. The
 * decider (null vs non-null) is still the existing
 * `row.accuracy === null` gate; pure pct logic preserved.
 */
const BAR_FILL_GRADIENT = "linear-gradient(90deg, #C9A149, #A8862E)";

function barFill(row: MasteryRow): string | null {
  if (row.accuracy === null) return null;
  return BAR_FILL_GRADIENT;
}

function MasteryBar({
  pct,
  fill,
}: {
  pct: number;
  /** `null` → empty state: track shows a dashed/striped pattern and
   *  the fill div renders width 0%. Non-null → gold gradient. */
  fill: string | null;
}) {
  const empty = fill === null;
  return (
    <div
      style={{
        height: 8,
        // Slice 40 — warm-paper track with a subtle line border.
        // Empty rows overlay a repeating-gradient stripe so the track
        // reads as "not yet practiced" rather than a hairline empty
        // bar at 0%. The base paper bg shows through the stripes'
        // transparent gaps.
        background: empty
          ? "repeating-linear-gradient(135deg, var(--color-paper) 0 6px, rgba(201, 161, 73, 0.18) 6px 8px)"
          : "var(--color-paper)",
        border: "1px solid var(--color-line)",
        borderRadius: 5,
        overflow: "hidden",
      }}
      aria-hidden
    >
      <div
        style={{
          height: "100%",
          width: empty ? "0%" : `${pct}%`,
          background: empty ? "transparent" : (fill as string),
          borderRadius: 5,
        }}
      />
    </div>
  );
}

export function MasteryRowItem({
  row,
  rowIndex,
}: {
  row: MasteryRow;
  /** 0-based position WITHIN THE VISIBLE LIST. The displayed prefix is
   *  always `String(rowIndex + 1).padStart(2, "0")` — so under filter
   *  + collapse the numbers stay contiguous (01, 02, 03 …) inside the
   *  current view rather than skipping. */
  rowIndex: number;
}) {
  const state = masteryState(row);
  const weak = state === "weak";
  const empty = state === "empty";
  const href = practiceSetupUrl({
    chapters: [row.chapterId],
    sourceCount: PRACTICE_DEEPLINK_DEFAULTS.sourceCount,
    angles: PRACTICE_DEEPLINK_DEFAULTS.angles,
    timePerQuestion: PRACTICE_DEEPLINK_DEFAULTS.timePerQuestion,
  });
  const numberPrefix = String(rowIndex + 1).padStart(2, "0");
  const pct = row.accuracy ?? 0;
  // Slice 39 — percentage label uses ONE neutral brand color for all
  // non-null rows (navy-ink) now that the bar fill is uniform gold.
  // Null rows still render the em dash in ink-muted.
  const pctColor = empty
    ? "var(--color-ink-muted)"
    : "var(--color-navy-ink)";

  const metaText =
    row.total === 0
      ? "טרם תורגל"
      : state === "strong"
        ? `${row.total.toLocaleString("he-IL")} שאלות · השיא שלך`
        : `${row.total.toLocaleString("he-IL")} שאלות תורגלו`;

  const pctNode = (
    <span
      className="tabular-nums font-heebo"
      style={{
        fontSize: 15,
        color: pctColor,
        fontWeight: 700,
        textAlign: "end",
      }}
      aria-label={
        row.accuracy !== null ? `${Math.round(row.accuracy)} אחוז` : undefined
      }
    >
      {row.accuracy !== null ? `${Math.round(row.accuracy)}%` : "—"}
    </span>
  );

  return (
    <Link
      href={href}
      aria-label={`תרגל את הפרק ${row.chapterTitle}`}
      /* Slice 39 — radius bumped 14 → 16 to match the navy/gold
         card family rhythm.
         Slice 41 — row surface flipped from warm paper (read as
         grey against the parent card) to clean white (`var(--card)`)
         so the gold tile + gold bar gradient pop against the row.
         Hover keeps the existing bg-card/border-navy treatment;
         border + padding unchanged. */
      className="group block rounded-[16px] border transition-colors hover:bg-card hover:border-[var(--color-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{
        padding: "10px 14px",
        background: "var(--card)",
        borderColor: "var(--color-line)",
      }}
    >
      {/* Desktop layout — single-row grid with bar + pct + CTA inline. */}
      <div
        className="hidden md:grid items-center"
        style={{
          /* Slice 40 — icon tile widened 38 → 42; track the column. */
          gridTemplateColumns: "42px 28px 1fr 120px auto auto",
          gap: 14,
        }}
      >
        <span
          className="inline-flex items-center justify-center transition-transform group-hover:scale-105"
          style={{
            width: ICON_TILE_SIZE,
            height: ICON_TILE_SIZE,
            borderRadius: ICON_TILE_RADIUS,
            ...ICON_TILE_STYLE,
          }}
          aria-hidden
        >
          <ChapterIcon code={row.chapterCode} />
        </span>
        <span
          className="tabular-nums font-heebo"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-ink-muted)",
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
          aria-hidden
        >
          {numberPrefix}
        </span>
        <div className="min-w-0 flex flex-col gap-0.5">
          <div
            className="font-heebo font-semibold"
            style={{ fontSize: 15, color: "var(--color-navy-ink)", lineHeight: 1.2 }}
          >
            {row.chapterTitle}
            {weak ? (
              /* Slice 40 — weakness pill back to amber: the signal
                 must read clearly against the row's gold-everywhere
                 language. Slice 39's soft gold-tint pill blended in
                 with the icon tile. `isWeakness` gate is unchanged. */
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold align-middle font-heebo"
                style={{
                  background: "var(--color-status-weak-bg)",
                  color: "var(--color-status-weak)",
                  marginInlineStart: 8,
                }}
              >
                חולשה
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            {metaText}
          </div>
        </div>
        <MasteryBar pct={pct} fill={barFill(row)} />
        {pctNode}
        {/* Slice 39 — empty rows show "התחל ←" (start), practiced rows
            show "תרגל ←" (practice more). The parent <Link>'s href is
            unchanged in either case — the row stays navigable for
            fresh users to start practicing the chapter. */}
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "font-heebo text-[13px] font-semibold pointer-events-none"
          )}
          style={{ color: "var(--color-navy)" }}
          aria-hidden
        >
          {empty ? "התחל ←" : "תרגל ←"}
        </span>
      </div>

      {/* Mobile layout — 2 rows: (icon + title + pill) above, then
          (bar + pct) below. Meta line sits between the two. The whole
          row is the Link's hit-target, so no CTA chip is needed. */}
      <div className="md:hidden flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex shrink-0 items-center justify-center"
            style={{
            width: ICON_TILE_SIZE,
            height: ICON_TILE_SIZE,
            borderRadius: ICON_TILE_RADIUS,
            ...ICON_TILE_STYLE,
          }}
            aria-hidden
          >
            <ChapterIcon code={row.chapterCode} />
          </span>
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-heebo font-semibold truncate"
                style={{
                  fontSize: 15,
                  color: "var(--color-navy-ink)",
                  lineHeight: 1.2,
                }}
              >
                {row.chapterTitle}
              </h3>
              {weak ? (
                /* Slice 40 — mobile mirror of the amber pill above. */
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold font-heebo"
                  style={{
                    background: "var(--color-status-weak-bg)",
                    color: "var(--color-status-weak)",
                  }}
                >
                  חולשה
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
              {metaText}
            </div>
          </div>
        </div>
        {/* Slice 40 — icon tile widened to 42 + gap-3 (12px) = 54px
            for the bar/pct row to align under the title text. */}
        <div className="flex items-center gap-3 ps-[54px]">
          <div className="flex-1">
            <MasteryBar pct={pct} fill={barFill(row)} />
          </div>
          {pctNode}
        </div>
      </div>
    </Link>
  );
}
