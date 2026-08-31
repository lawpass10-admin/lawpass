"use client";

import { Clock, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TIMER_PHASE_CLASSES_LIGHT, getTimerPhase } from "@/lib/timer-phase";
import { cn } from "@/lib/utils";

/** 160 minutes, the length of the דין־מהותי sitting. */
export const MAHOTI_TOTAL_SECONDS = 160 * 60;

/** 100 minutes, the length of the דין דיוני sitting (חלק ב' of the paper). */
export const DIUNI_TOTAL_SECONDS = 100 * 60;

/** Amber under 5 minutes, red under 1. */
const WARNING_SECONDS = 5 * 60;
const DANGER_SECONDS = 60;

function formatMinSec(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Start/pause bar for the /mahoti split screen.
 *
 * The countdown is driven off a deadline timestamp rather than by
 * decrementing a counter each tick: a 160-minute sitting accumulates real
 * drift from setInterval, and browsers throttle timers in background tabs,
 * so a subtract-one-per-tick clock would run visibly slow once the candidate
 * switched away and back. The interval only re-reads the clock; the deadline
 * is the source of truth, and pausing converts it back into a plain
 * remaining-seconds figure.
 *
 * Nothing here is persisted: this screen has no exam session behind it, so a
 * reload starts over. That is a deliberate limit of the study tool, not a
 * scoring surface — /exam remains the timed, server-authoritative one.
 */
export function ExamTimerBar({
  frozen = false,
  totalSeconds = MAHOTI_TOTAL_SECONDS,
  onStartedChange,
}: {
  frozen?: boolean;
  /**
   * Length of the sitting. Defaults to the mahoti figure so the original
   * caller is unchanged; /diuni passes its own 100 minutes. A prop rather
   * than a second copy of this file — the clock's real content is the
   * deadline arithmetic below, which is identical for both sittings.
   */
  totalSeconds?: number;
  /**
   * Fired the moment the sitting actually begins. The workspace keeps the
   * choices locked until then, so answering and the clock can't come apart —
   * see MahotiWorkspace. Called from `handleStart` rather than an effect on
   * `started`: that is the single place the flag flips, and an effect here
   * would be a parent-setState-in-effect cascade.
   */
  onStartedChange?: (started: boolean) => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  // Absolute deadline while running; null while paused or not started.
  const deadlineRef = useRef<number | null>(null);

  // `frozen` goes true when the last question is answered. The clock stops
  // where it is — the elapsed time is the candidate's result and must not
  // keep ticking while they read the review.
  useEffect(() => {
    if (!frozen) return;
    queueMicrotask(() => {
      const deadline = deadlineRef.current;
      if (deadline !== null) {
        setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
    });
  }, [frozen]);

  useEffect(() => {
    if (!running) return;
    // 250ms rather than 1000ms so the displayed second flips close to when
    // it actually turns over, instead of up to a second late.
    const id = setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        deadlineRef.current = null;
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function handleStart(): void {
    // Also the restart path once the clock has run out.
    const seconds = remaining > 0 ? remaining : totalSeconds;
    setRemaining(seconds);
    deadlineRef.current = Date.now() + seconds * 1000;
    setStarted(true);
    setRunning(true);
    onStartedChange?.(true);
  }

  function handlePauseToggle(): void {
    if (running) {
      const deadline = deadlineRef.current;
      if (deadline !== null) {
        setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
      return;
    }
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }

  const phase = getTimerPhase(remaining, {
    warning: WARNING_SECONDS,
    danger: DANGER_SECONDS,
  });
  const minutesLeft = Math.max(0, Math.floor(remaining / 60));
  const finished = started && remaining === 0;

  return (
    // h-9 with `size="sm"` buttons (h-8): the bar is one control row, and on
    // this screen its height comes straight out of the reading area.
    <div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2 shadow-sm">
      <Button onClick={handleStart} disabled={running || frozen} size="sm">
        <Play className="size-3.5" aria-hidden />
        <span className="ms-1.5 text-xs">
          {finished ? "התחל מחדש" : started ? "המשך בחינה" : "התחל בחינה"}
        </span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePauseToggle}
        disabled={!started || finished || frozen}
        aria-label={running ? "השהה בחינה" : "המשך בחינה"}
      >
        {running ? (
          <>
            <Pause className="size-3.5" aria-hidden />
            <span className="ms-1.5 text-xs">השהה</span>
          </>
        ) : (
          <>
            <Play className="size-3.5" aria-hidden />
            <span className="ms-1.5 text-xs">המשך</span>
          </>
        )}
      </Button>

      {/* aria-hidden on the ticking figure — a screen reader would read it
          out every second. The sr-only announcer below changes only on the
          minute, so aria-live fires at most once a minute. */}
      <div
        aria-hidden
        className={cn(
          "ms-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1",
          "font-mono text-xs font-semibold tabular-nums",
          TIMER_PHASE_CLASSES_LIGHT[phase]
        )}
      >
        <Clock className="size-3.5" aria-hidden />
        <span>{formatMinSec(remaining)}</span>
      </div>
      <span role="timer" aria-live="polite" className="sr-only">
        {!started
          ? "הבחינה טרם החלה"
          : minutesLeft > 0
            ? `${minutesLeft} דקות נותרו`
            : "פחות מדקה נותרה"}
      </span>
    </div>
  );
}
