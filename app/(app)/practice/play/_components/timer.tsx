"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type TimerProps = {
  /** Seconds to count down from. Resets the timer when this prop changes
   * (parent re-keys on `position` change). */
  initialSeconds: number;
  /** When true, decrement every second. Parent stops this on submit so
   * the visual matches the moment the answer was locked in. */
  running: boolean;
  /** Fires once per position when the countdown reaches 0. Used by the
   * parent to surface the timer-expired dialog. Guarded against firing
   * multiple times even if React re-renders. */
  onExpired?: () => void;
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
export function Timer({ initialSeconds, running, onExpired }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  // Tracks the `initialSeconds` value the last `onExpired` was fired
  // for. Compare with the current `initialSeconds` at fire time — if
  // they differ, the parent advanced to a new question (different
  // key) and we should be allowed to fire again. Initialized to -1
  // (impossible session value) so the first expiry always fires.
  const lastFiredFor = useRef<number>(-1);

  // Reset whenever the parent passes a new initialSeconds (e.g., the
  // user advanced to a new question). Synchronous in render: the next
  // setInterval tick will use the new value. The expiredFired ref is
  // not touched here — its reset happens implicitly via the key
  // comparison inside the effect.
  const [keyedFrom, setKeyedFrom] = useState(initialSeconds);
  if (keyedFrom !== initialSeconds) {
    setKeyedFrom(initialSeconds);
    setSeconds(initialSeconds);
  }

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) {
      // Fire onExpired exactly once per question. lastFiredFor key
      // guards against re-entry from a stale interval tick or parent
      // re-render. The key naturally re-arms on position change because
      // the parent passes a new `initialSeconds` per position.
      if (lastFiredFor.current !== initialSeconds && onExpired) {
        lastFiredFor.current = initialSeconds;
        onExpired();
      }
      return;
    }
    const id = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running, seconds, onExpired, initialSeconds]);

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
