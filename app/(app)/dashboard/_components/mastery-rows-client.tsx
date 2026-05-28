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
 *   - `showAll` : when false (default), only the first
 *                 INITIAL_VISIBLE_ROWS of the FILTERED set render; when
 *                 true, the whole filtered set renders. Switching the
 *                 filter resets this back to false (collapsed view).
 *
 * Visuals mirror the QA widget's 3-card radiogroup picker
 * (app/(app)/_components/qa-floating-widget.tsx REPORT_TYPE_CARDS) +
 * the exam-intro ModePicker — amber-500 border + amber-50 bg on the
 * selected option, neutral border on the rest.
 */

const INITIAL_VISIBLE_ROWS = 6;

type Track = "all" | "procedural" | "substantive";

const TRACK_CARDS: readonly { value: Track; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "procedural", label: "דיוני" },
  { value: "substantive", label: "מהותי" },
];

export function MasteryRowsClient({ rows }: { rows: MasteryRow[] }) {
  const [track, setTrack] = useState<Track>("all");
  const [showAll, setShowAll] = useState(false);

  // Filter first, THEN slice. This is load-bearing: the 6-row cap and
  // the show-more affordance must reflect the CURRENT filtered set,
  // not the full 16.
  const filtered =
    track === "all" ? rows : rows.filter((r) => r.track === track);
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE_ROWS);
  const hasOverflow = filtered.length > INITIAL_VISIBLE_ROWS;

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
      {/* Track filter — radiogroup of 3 cards. Same visual language as
          the QA widget's report-type picker. */}
      <div
        role="radiogroup"
        aria-label="סינון פרקים לפי מסלול"
        className="flex flex-wrap gap-2"
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
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                selected
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                  : "border-border bg-card hover:bg-muted/40"
              )}
            >
              {card.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card/40 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            אין פרקים להצגה בסינון הנוכחי.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row, idx) => (
            <MasteryRowItem key={row.chapterId} row={row} rowIndex={idx} />
          ))}
        </div>
      )}

      {/* Show-more / show-less toggle. Only appears when the filtered
          set actually has more than INITIAL_VISIBLE_ROWS rows —
          otherwise the toggle would be a no-op. */}
      {hasOverflow ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium text-primary/80 transition-colors",
            "hover:bg-muted/40 hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          {showAll
            ? "הצג פחות"
            : `הצג עוד (${filtered.length - INITIAL_VISIBLE_ROWS})`}
        </button>
      ) : null}
    </div>
  );
}
