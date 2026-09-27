"use client";

import { Clock, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadClock, saveClock, type SittingKind } from "@/lib/sittings/progress";
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
 * Given `sitting`, the clock survives a reload. What is stored is the
 * DEADLINE, not the remaining seconds: a stored count would be handed back
 * intact after a reload and quietly gift the candidate the time they were
 * away. An absolute deadline keeps elapsing while the page is gone, so
 * reloading costs exactly the seconds it took — see lib/sittings/progress.ts.
 * Without the prop the bar behaves exactly as before and persists nothing.
 */
export function ExamTimerBar({
  frozen = false,
  totalSeconds = MAHOTI_TOTAL_SECONDS,
  onStartedChange,
  sitting,
  children,
}: {
  frozen?: boolean;
  /**
   * Which paper this clock belongs to. Supplying it turns on crash recovery;
   * omitting it leaves the bar stateless across reloads.
   */
  sitting?: { kind: SittingKind; setId: string };
  /**
   * Extra controls for the bar, rendered beside the clock. /mahoti and /diuni
   * put "בדוק שאלות" here: the bar is the one row of controls on these screens,
   * and a button placed anywhere else would cost the question column height it
   * cannot spare.
   */
  children?: React.ReactNode;
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
  // Restore runs once, and until it has, nothing may be written back — an
  // early save would overwrite a real sitting with this component's initial
  // "not started, full clock" state.
  const restored = useRef(false);

  // Written only on the transitions (start, pause, resume, freeze, expiry),
  // never on the 250ms tick: while the clock runs the deadline is a constant,
  // so re-storing it four times a second would say nothing new.
  const persist = useCallback(
    (next: { started: boolean; deadlineAt: number | null; remaining: number }) => {
      if (!sitting || !restored.current) return;
      saveClock(sitting.kind, sitting.setId, next);
    },
    [sitting]
  );

  // Restored in a microtask, matching the window-token read in
  // exam/play/_components/exam-question.tsx: it keeps the setState out of the
  // effect body (react-hooks/set-state-in-effect) and defers the change past
  // the hydration tick, so the server's full clock and the client's first
  // render still agree.
  useEffect(() => {
    queueMicrotask(() => {
      if (!sitting) {
        restored.current = true;
        return;
      }
      const stored = loadClock(sitting.kind, sitting.setId);
      restored.current = true;
      if (!stored || !stored.started) return;

      if (stored.deadlineAt !== null) {
        // It was running when the page went away, so the clock has been
        // draining in absentia. What is left may well be nothing.
        const left = Math.max(
          0,
          Math.round((stored.deadlineAt - Date.now()) / 1000)
        );
        setRemaining(left);
        setStarted(true);
        if (left > 0) {
          deadlineRef.current = stored.deadlineAt;
          setRunning(true);
        }
      } else {
        // Paused when it was stored: a pause is not charged, so the remaining
        // figure is taken at face value and the candidate resumes it by hand.
        setRemaining(stored.remaining);
        setStarted(true);
      }
      onStartedChange?.(true);
    });
    // Mount-only: re-running this would fight the live clock. `sitting` is a
    // literal from the parent and would otherwise retrigger every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `frozen` goes true when the last question is answered. The clock stops
  // where it is — the elapsed time is the candidate's result and must not
  // keep ticking while they read the review.
  useEffect(() => {
    if (!frozen) return;
    queueMicrotask(() => {
      const deadline = deadlineRef.current;
      const left =
        deadline !== null
          ? Math.max(0, Math.round((deadline - Date.now()) / 1000))
          : remaining;
      if (deadline !== null) setRemaining(left);
      deadlineRef.current = null;
      setRunning(false);
      persist({ started: true, deadlineAt: null, remaining: left });
    });
    // `remaining` is read only as the already-stopped fallback; adding it
    // would re-run this every tick of the clock it is meant to stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, persist]);

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
        // Store the expiry too, so a reload after the clock ran out comes
        // back finished rather than offering a fresh 160 minutes.
        persist({ started: true, deadlineAt: null, remaining: 0 });
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, persist]);

  function handleStart(): void {
    // Also the restart path once the clock has run out.
    const seconds = remaining > 0 ? remaining : totalSeconds;
    const deadlineAt = Date.now() + seconds * 1000;
    setRemaining(seconds);
    deadlineRef.current = deadlineAt;
    setStarted(true);
    setRunning(true);
    persist({ started: true, deadlineAt, remaining: seconds });
    onStartedChange?.(true);
  }

  function handlePauseToggle(): void {
    if (running) {
      const deadline = deadlineRef.current;
      const left =
        deadline !== null
          ? Math.max(0, Math.round((deadline - Date.now()) / 1000))
          : remaining;
      if (deadline !== null) setRemaining(left);
      deadlineRef.current = null;
      setRunning(false);
      // Deadline cleared: a paused clock is a plain remaining figure, and
      // storing it that way is what stops the pause being charged.
      persist({ started: true, deadlineAt: null, remaining: left });
      return;
    }
    const deadlineAt = Date.now() + remaining * 1000;
    deadlineRef.current = deadlineAt;
    setRunning(true);
    persist({ started: true, deadlineAt, remaining });
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

      {children}
    </div>
  );
}
