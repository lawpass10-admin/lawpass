"use client";

import { cn } from "@/lib/utils";

/**
 * Cell status as the strip sees it. Phase 4 hydration: the play page
 * passes the position-aligned status array from
 * `getExamPositionStatuses`. The strip never reveals correctness
 * — both `correct` and `wrong` collapse to the same `answered` look,
 * per spec (no answer-revealing during the exam).
 */
export type ExamProgressCellStatus =
  | "current"
  | "answered"
  | "skipped"
  | "pending";

type Props = {
  total: number;
  current: number;
  statuses: ExamProgressCellStatus[];
  onJump: (position: number) => void;
  disabled?: boolean;
};

const STATUS_ARIA: Record<ExamProgressCellStatus, string> = {
  current: "השאלה הנוכחית",
  answered: "נענתה",
  skipped: "דולגה",
  pending: "לא נענתה",
};

/**
 * 40-cell strip below the topbar. Each cell is a clickable square that
 * jumps to that position. Background dark teal; answered cells gold,
 * current cell white with a gold outline, skipped cells muted, pending
 * cells dim.
 *
 * Phase 6 — mobile + a11y:
 *   - Cells get `min-w-6` (24px) so the strip horizontally scrolls
 *     instead of crushing the cells on narrow viewports.
 *   - Active cell scale-110 (subtle pop — easier to find on mobile).
 *   - aria-label reflects status, not just position.
 */
export function ExamProgressStrip({
  total,
  current,
  statuses,
  onJump,
  disabled = false,
}: Props) {
  return (
    <div className="sticky top-12 z-10 bg-[#1a4f4d] px-4 py-2.5 sm:px-7">
      <div className="flex justify-between gap-1 overflow-x-auto">
        {Array.from({ length: total }).map((_, i) => {
          const status: ExamProgressCellStatus =
            i === current ? "current" : (statuses[i] ?? "pending");
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onJump(i)}
              disabled={disabled}
              aria-label={`שאלה ${i + 1}, ${STATUS_ARIA[status]}`}
              aria-current={i === current || undefined}
              className={cn(
                "h-6 w-6 min-w-6 shrink-0 rounded font-mono text-[10px] font-semibold tabular-nums transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                status === "current" &&
                  "scale-110 bg-white text-[#0a2624] outline outline-2 outline-amber-400",
                status === "answered" && "bg-amber-500 text-[#0a2624]",
                status === "skipped" && "bg-stone-400 text-[#0a2624]",
                status === "pending" && "bg-white/15 text-white/60",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
