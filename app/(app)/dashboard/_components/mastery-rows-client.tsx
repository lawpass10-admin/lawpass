"use client";

import { useState } from "react";

import { MasteryRowItem } from "@/app/(app)/dashboard/_components/mastery-row-item";
import type { MasteryRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

/**
 * Slice 11 — client-side filter + collapse for the dashboard mastery
 * card. The parent `<MasteryCard>` (Server Component) keeps the card
 * chrome (title, sub-paragraph, weakness summary) and hands the full
 * row set to this child for interactive presentation.
 *
 * State:
 *   - `track`   : 'all' | 'procedural' | 'substantive'. Drives the
 *                 segmented filter at the top of the row list.
 *   - `showAll` : when false (default), only the first CAP_DESKTOP
 *                 rows of the FILTERED set are *in the DOM* (the first
 *                 CAP_MOBILE of which are visible on mobile, the rest
 *                 of those 11 are `hidden md:block`); when true, the
 *                 whole filtered set renders. Switching the filter
 *                 resets this back to false (collapsed view).
 *
 * Slice 32 — desktop cap raised 6 → 11 so the mastery panel roughly
 *   fills the right-column height.
 * Slice 36 — mobile cap split out. On mobile only 3 rows show by
 *   default; desktop continues to show 11. Implementation is
 *   SSR-safe: the first 11 rows are always rendered, and the rows at
 *   indices 3–10 carry `hidden md:block` when collapsed so mobile
 *   hides them via pure CSS. Two toggle buttons (mobile + desktop)
 *   share one `setShowAll` state and label their counts from the
 *   right per-breakpoint cap.
 *
 * Visuals mirror the QA widget's 3-card radiogroup picker
 * (app/(app)/_components/qa-floating-widget.tsx REPORT_TYPE_CARDS) +
 * the exam-intro ModePicker — amber-500 border + amber-50 bg on the
 * selected option, neutral border on the rest.
 */

const CAP_MOBILE = 3;
const CAP_DESKTOP = 11;

type Track = "all" | "procedural" | "substantive";

const TRACK_CARDS: readonly { value: Track; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "procedural", label: "דיוני" },
  { value: "substantive", label: "מהותי" },
];

export function MasteryRowsClient({ rows }: { rows: MasteryRow[] }) {
  const [track, setTrack] = useState<Track>("all");
  const [showAll, setShowAll] = useState(false);

  // Filter first, THEN slice. This is load-bearing: the cap and the
  // show-more affordance must reflect the CURRENT filtered set, not
  // the full 16.
  const filtered =
    track === "all" ? rows : rows.filter((r) => r.track === track);

  // Slice 36 — always render the first CAP_DESKTOP rows. Rows past
  // CAP_DESKTOP (the "true overflow") only enter the DOM when the
  // user expands via either toggle. Within the first CAP_DESKTOP,
  // mobile uses CSS to hide indices CAP_MOBILE..CAP_DESKTOP-1 unless
  // expanded.
  const visibleHead = filtered.slice(0, CAP_DESKTOP);
  const overflowTail = showAll ? filtered.slice(CAP_DESKTOP) : [];

  const hasMobileOverflow = filtered.length > CAP_MOBILE;
  const hasDesktopOverflow = filtered.length > CAP_DESKTOP;

  function handleTrackChange(next: Track): void {
    if (next === track) return;
    setTrack(next);
    // Reset to collapsed view when the filter changes — otherwise
    // switching from "הכל" (16 rows, expanded) to "דיוני" (6 rows,
    // <= cap) would silently hide the "הצג פחות" affordance and the
    // collapsed/expanded model would drift from what the user expects.
    setShowAll(false);
  }

  return (
    <div className="space-y-3">
      {/* Slice 40 — single pill container with a white "thumb" on
          the active tab + a gold underline strike at the bottom.
          Replaces the per-tab gold-tint/border treatment from Slice
          39 with one cohesive control. Tab state logic untouched —
          only the styling moves. */}
      <div
        role="radiogroup"
        aria-label="סינון פרקים לפי מסלול"
        className="inline-flex gap-1 p-1 rounded-full bg-[var(--color-paper)] border border-[var(--color-line)]"
      >
        {TRACK_CARDS.map((card) => {
          const selected = card.value === track;
          return (
            <button
              key={card.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleTrackChange(card.value)}
              className={cn(
                "relative rounded-full px-4 py-[7px] text-[13px] font-heebo font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
                selected
                  ? cn(
                      "bg-white text-[var(--color-navy-ink)]",
                      // Gold underline strike beneath the active tab —
                      // 2px thin, inset by px-3 worth of horizontal
                      // padding so it doesn't reach the pill edges.
                      "after:absolute after:inset-x-3 after:bottom-[3px] after:h-[2px] after:rounded after:bg-[var(--color-gold-deep)]"
                    )
                  : "text-[var(--color-ink-dim)] hover:text-[var(--color-navy-ink)]"
              )}
            >
              {card.label}
            </button>
          );
        })}
      </div>

      {visibleHead.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card/40 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            אין פרקים להצגה בסינון הנוכחי.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleHead.map((row, idx) => {
            // Slice 36 — rows at idx 0..CAP_MOBILE-1 always visible.
            // Rows at idx CAP_MOBILE..CAP_DESKTOP-1 hide on mobile
            // when collapsed (`hidden md:block`). When `showAll` is
            // true, all 11 head rows render with no responsive hide.
            const hideClass =
              !showAll && idx >= CAP_MOBILE && idx < CAP_DESKTOP
                ? "hidden md:block"
                : "";
            return (
              <div key={row.chapterId} className={hideClass}>
                <MasteryRowItem row={row} rowIndex={idx} />
              </div>
            );
          })}
          {/* Tail rows past CAP_DESKTOP — only rendered when expanded.
              No responsive hide on these (they belong to the toggle
              on all viewports). */}
          {overflowTail.map((row, i) => (
            <MasteryRowItem
              key={row.chapterId}
              row={row}
              rowIndex={CAP_DESKTOP + i}
            />
          ))}
        </div>
      )}

      {/* Slice 36 — two toggle buttons, one per breakpoint. Both wired
          to the same `setShowAll(v => !v)` so a click in either flips
          the shared state and the next render shows the right rows
          for that viewport. Each gated by its own overflow predicate
          + its own Tailwind visibility (md:hidden / hidden md:inline-flex). */}
      {/* `data-testid` lets the jsdom suite disambiguate the two
          buttons without weakening any assertion — jsdom can't apply
          Tailwind's md: utilities, so both buttons live in the DOM
          and getByRole would otherwise match both. The desktop
          variant is what the existing tests target. */}
      {hasMobileOverflow ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          data-testid="mastery-toggle-mobile"
          className={cn(
            "md:hidden",
            "flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium text-primary/80 transition-colors",
            "hover:bg-muted/40 hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          {showAll
            ? "הצג פחות"
            : `הצג עוד (${filtered.length - CAP_MOBILE})`}
        </button>
      ) : null}
      {hasDesktopOverflow ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          data-testid="mastery-toggle-desktop"
          className={cn(
            "hidden md:inline-flex",
            "w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium text-primary/80 transition-colors",
            "hover:bg-muted/40 hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          {showAll
            ? "הצג פחות"
            : `הצג עוד (${filtered.length - CAP_DESKTOP})`}
        </button>
      ) : null}
    </div>
  );
}
