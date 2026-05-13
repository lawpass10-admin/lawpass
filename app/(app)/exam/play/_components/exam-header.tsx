"use client";

import { Clock, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  position: number;
  total: number;
  /** Seconds left on the visual countdown. Goes red at < LOW_THRESHOLD. */
  remainingSeconds: number;
  paused: boolean;
  busy: boolean;
  onTogglePause: () => void;
  onSubmit: () => void;
};

const LOW_TIME_THRESHOLD_SECONDS = 600;

function formatMinSec(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Sticky dark topbar for the exam play screen. Mirrors the prototype:
 *   - RTL-start: brand mark "L" (gold square) + label "סימולציית בחינה"
 *   - RTL-end: counter, timer pill, pause/resume toggle, "סיים בחינה"
 *
 * Sidebar is hidden across /exam/* via the layout branch (Phase 0) so
 * this header takes the full viewport width.
 */
export function ExamHeader({
  position,
  total,
  remainingSeconds,
  paused,
  busy,
  onTogglePause,
  onSubmit,
}: Props) {
  const lowTime = remainingSeconds < LOW_TIME_THRESHOLD_SECONDS;
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-4 bg-primary px-6 text-primary-foreground">
      {/* Brand cluster (RTL-start) */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-[13px] font-bold text-primary"
          aria-hidden
        >
          L
        </span>
        <span className="text-sm font-semibold">סימולציית בחינה</span>
      </div>

      {/* Counter + timer + pause + submit (RTL-end) */}
      <div className="ms-auto flex items-center gap-3">
        <span className="font-mono text-[13px] text-primary-foreground/70 tabular-nums">
          שאלה {position + 1} / {total}
        </span>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-sm font-semibold tabular-nums",
            lowTime
              ? "bg-destructive text-destructive-foreground"
              : "bg-white/10 text-primary-foreground"
          )}
          role="timer"
          aria-live="off"
          aria-label={`זמן שנותר: ${formatMinSec(remainingSeconds)}`}
        >
          <Clock className="size-3.5" aria-hidden />
          <span>{formatMinSec(remainingSeconds)}</span>
        </div>
        <button
          type="button"
          onClick={onTogglePause}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs text-primary-foreground transition-colors",
            "hover:bg-white/15 disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          )}
        >
          {paused ? (
            <>
              <Play className="size-3.5" aria-hidden />
              <span>המשך</span>
            </>
          ) : (
            <>
              <Pause className="size-3.5" aria-hidden />
              <span>השהה</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className={cn(
            "rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-primary transition-colors",
            "hover:bg-amber-300 disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          )}
        >
          סיים בחינה
        </button>
      </div>
    </header>
  );
}
