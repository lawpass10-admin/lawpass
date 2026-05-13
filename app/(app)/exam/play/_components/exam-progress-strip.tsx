"use client";

import { cn } from "@/lib/utils";

export type ExamProgressCellStatus = "current" | "answered" | "skipped" | "pending";

type Props = {
  total: number;
  current: number;
  statuses: ExamProgressCellStatus[];
  onJump: (position: number) => void;
  disabled?: boolean;
};

/**
 * 40-cell strip below the topbar. Each cell is a clickable square that
 * jumps to that position. Background follows the prototype's dark teal
 * (`#1a4f4d`); answered cells gold, current cell white with a gold
 * outline, skipped cells muted, pending cells dim.
 */
export function ExamProgressStrip({
  total,
  current,
  statuses,
  onJump,
  disabled = false,
}: Props) {
  return (
    <div className="sticky top-12 z-10 flex gap-1 overflow-x-auto bg-[#1a4f4d] px-6 py-2.5">
      {Array.from({ length: total }).map((_, i) => {
        const status: ExamProgressCellStatus =
          i === current ? "current" : (statuses[i] ?? "pending");
        return (
          <button
            key={i}
            type="button"
            onClick={() => !disabled && onJump(i)}
            disabled={disabled}
            aria-label={`שאלה ${i + 1}`}
            aria-current={i === current || undefined}
            className={cn(
              "h-[22px] w-[22px] shrink-0 rounded font-mono text-[10px] font-semibold tabular-nums transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
              status === "current" &&
                "bg-white text-[#0a2624] outline outline-2 outline-amber-400",
              status === "answered" && "bg-amber-400 text-[#0a2624]",
              status === "skipped" && "bg-white/30 text-white/80",
              status === "pending" && "bg-white/15 text-white/60",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
