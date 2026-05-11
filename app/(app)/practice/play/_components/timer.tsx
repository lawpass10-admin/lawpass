"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type TimerProps = {
  /** Seconds to count down from. Resets the timer when this prop changes
   * (parent re-keys on `position` change). */
  initialSeconds: number;
  /** When true, decrement every second. Parent stops this on submit so
   * the visual matches the moment the answer was locked in. */
  running: boolean;
};

const LOW_TIME_THRESHOLD_SECONDS = 30;

function formatMinSec(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Visual M:SS countdown timer. PURELY DISPLAY — the
 * `duration_seconds` value sent to submitAttempt is computed
 * independently from a `performance.now()` ref in the parent
 * (see practice-question.tsx). That keeps the value accurate
 * even if the tab is backgrounded (setInterval drifts when
 * throttled, but `performance.now()` is real wall-clock).
 *
 * Reaching 0 turns the chip red. Choices remain interactive at
 * 0 — there's no auto-submit in practice mode (plan §2 row 7).
 */
export function Timer({ initialSeconds, running }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  // Reset whenever the parent passes a new initialSeconds (e.g., the
  // user advanced to a new question). Synchronous in render: the next
  // setInterval tick will use the new value.
  const [keyedFrom, setKeyedFrom] = useState(initialSeconds);
  if (keyedFrom !== initialSeconds) {
    setKeyedFrom(initialSeconds);
    setSeconds(initialSeconds);
  }

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running, seconds]);

  const low = seconds < LOW_TIME_THRESHOLD_SECONDS;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
        low
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground"
      )}
      role="timer"
      aria-live="off"
      aria-label={`זמן שנותר: ${formatMinSec(seconds)}`}
    >
      <Clock className="size-3.5" aria-hidden />
      <span>{formatMinSec(seconds)}</span>
    </div>
  );
}
