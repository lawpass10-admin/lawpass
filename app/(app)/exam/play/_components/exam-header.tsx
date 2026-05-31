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

const TIMER_WARNING_SECONDS = 30;
const TIMER_DANGER_SECONDS = 10;

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
 * Phase 6 — mobile fixes:
 *   - Brand label hides on `<sm` (just the "L" mark stays)
 *   - Counter hides on `<sm`
 *   - Pause/resume label hides on `<sm` (icon-only)
 *   - Timer turns amber at <30s, red + pulses at <10s (reduced-motion
 *     gated)
 *
 * Phase 6 — a11y:
 *   - Visible timer is `aria-hidden` so screen readers don't spam every
 *     1s tick. A separate sr-only `role="timer" aria-live="polite"`
 *     announces remaining minutes — content only changes per minute
 *     so it triggers at most once per minute.
 *   - Pause/resume button carries an explicit Hebrew aria-label.
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
  const phase: "neutral" | "warning" | "danger" =
    remainingSeconds < TIMER_DANGER_SECONDS
      ? "danger"
      : remainingSeconds < TIMER_WARNING_SECONDS
        ? "warning"
        : "neutral";
  const minutesLeft = Math.max(0, Math.floor(remainingSeconds / 60));
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-primary px-4 text-primary-foreground sm:gap-4 sm:px-6">
      {/* Brand cluster (RTL-start) */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-[13px] font-bold text-primary"
          aria-hidden
        >
          L
        </span>
        <span className="hidden text-sm font-semibold sm:inline">
          סימולציית בחינה
        </span>
      </div>

      {/* Counter + timer + pause + submit (RTL-end) */}
      <div className="ms-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden font-mono text-[13px] text-primary-foreground/70 tabular-nums sm:inline">
          שאלה {position + 1} / {total}
        </span>
        <div
          aria-hidden
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums sm:gap-2 sm:px-3",
            phase === "danger" &&
              "bg-destructive text-destructive-foreground timer-pulse",
            phase === "warning" &&
              "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
            phase === "neutral" && "bg-white/10 text-primary-foreground"
          )}
        >
          <Clock className="size-3.5" aria-hidden />
          <span>{formatMinSec(remainingSeconds)}</span>
        </div>
        {/* sr-only timer announcer: content changes only when the minute
            boundary crosses, so aria-live="polite" announces ~once/minute
            instead of every second. */}
        <span role="timer" aria-live="polite" className="sr-only">
          {minutesLeft > 0
            ? `${minutesLeft} דקות נותרו`
            : "פחות מדקה נותרה"}
        </span>
        <button
          type="button"
          onClick={onTogglePause}
          disabled={busy}
          aria-label={paused ? "המשך בחינה" : "השהה בחינה"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-primary-foreground transition-colors sm:px-3",
            "hover:bg-white/15 disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          )}
        >
          {paused ? (
            <>
              <Play className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">המשך</span>
            </>
          ) : (
            <>
              <Pause className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">השהה</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className={cn(
            "rounded-md bg-amber-400 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors sm:px-3",
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
