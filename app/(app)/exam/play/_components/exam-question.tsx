"use client";

import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  abandonAndExitExam,
  pauseExam,
  resumeExam,
  skipExamQuestion,
  submitExamAttempt,
  submitFinalExam,
  toggleExamBookmark,
} from "@/app/(app)/exam/_actions";
import { Choice } from "@/app/(app)/practice/play/_components/choice";
import { Button } from "@/components/ui/button";
import type {
  Choice as ChoiceType,
  ExamPositionStatus,
  ExamQuestionListItem,
  ExamSessionStatus,
} from "@/lib/db/exam";
import { examPlayUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { ExamHeader } from "./exam-header";
import { ExamPauseOverlay } from "./exam-pause-overlay";
import {
  ExamProgressStrip,
  type ExamProgressCellStatus,
} from "./exam-progress-strip";
import { ExamSubmitConfirmDialog } from "./exam-submit-confirm-dialog";
import { WindowConflict } from "./window-conflict";

type Letter = "א" | "ב" | "ג" | "ד";

type SessionProps = {
  id: string;
  active_window_token: string;
  total_duration_seconds: number;
  time_used_seconds: number;
  status: ExamSessionStatus;
  question_list: ExamQuestionListItem[];
};

type Props = {
  session: SessionProps;
  position: number;
  questionText: string;
  /** Choices with `is_correct` stripped (page Server Component handles
   *  the stripping; we never see the real value client-side). */
  choices: ChoiceType[];
  existingSelectedLetter: Letter | null;
  isBookmarked: boolean;
  /** Position-aligned status array (length === question_list.length).
   *  Hydrated by the Server Component from the attempts table. Drives
   *  the progress strip's cell colours + the submit-confirm dialog's
   *  unanswered count. Phase 4. */
  positionStatuses: ExamPositionStatus[];
};

/**
 * Heart of the exam play screen. Owns:
 *   - local timer countdown (visual only; server-authoritative on each
 *     action via clientElapsedSeconds)
 *   - selected letter (pre-filled on backward nav from the row's
 *     existing attempt; new selection UPSERTs server-side)
 *   - pause state (mirrors server status)
 *   - bookmark state (optimistic, server-confirmed)
 *   - submit-confirm dialog open state
 *   - window-token validation against localStorage
 *
 * The action contract sends `clientElapsedSeconds` (delta since the
 * last action) on every call. The server clamps + adds to
 * time_used_seconds and returns the new `remaining_seconds` so the
 * client can resync its visual countdown.
 */
export function ExamQuestion({
  session,
  position,
  questionText,
  choices,
  existingSelectedLetter,
  isBookmarked,
  positionStatuses,
}: Props) {
  // -------------------------------------------------------------------------
  // Window-token guard
  // -------------------------------------------------------------------------
  // On mount, read the token from localStorage. If it doesn't match the
  // session's active_window_token, render <WindowConflict /> instead.
  // Two-phase to avoid an SSR/CSR mismatch: render nothing during the
  // initial hydration tick, then either the question or the conflict.
  const [tokenStatus, setTokenStatus] = useState<"pending" | "ok" | "conflict">(
    "pending"
  );
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Resolve token in a microtask so the setState call satisfies the
    // react-hooks/set-state-in-effect lint rule (it requires setState
    // to fire from a callback function rather than the effect body).
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(
          `lawpass.exam.${session.id}.windowToken`
        );
        if (stored && stored === session.active_window_token) {
          tokenRef.current = stored;
          setTokenStatus("ok");
          return;
        }
        // No stored token AND session is freshly active: this can
        // happen if a user opens /exam/play/0?session=… by URL paste
        // without going through the intro/resume flow. Treat as a
        // conflict — Phase 5 wires the claim CTA in <WindowConflict />.
        setTokenStatus("conflict");
      } catch {
        // localStorage unavailable — treat as conflict (safer than
        // letting actions silently run with no token).
        setTokenStatus("conflict");
      }
    });
  }, [session.id, session.active_window_token]);

  // -------------------------------------------------------------------------
  // Local timer (visual only)
  // -------------------------------------------------------------------------
  const initialRemaining = Math.max(
    0,
    session.total_duration_seconds - session.time_used_seconds
  );
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const [paused, setPaused] = useState(session.status === "paused");

  // performance.now() anchor for the last server-syncing event. The
  // delta from this to the next action call is the client's elapsed
  // estimate. Reset on every successful action response (which carries
  // a fresh remaining_seconds).
  // Lazy-bootstrap: useRef can't call performance.now() in its
  // initializer (react-hooks/purity rule). 0 sentinel means "not yet
  // anchored"; popElapsed() anchors on first call and returns 0 then.
  const lastSyncAt = useRef<number>(0);

  // The local countdown setInterval is gated on (tokenStatus ok AND
  // !paused AND remainingSeconds > 0). When it hits 0, we fire
  // submitFinalExam silently — the auto-submit branch.
  useEffect(() => {
    if (tokenStatus !== "ok") return;
    if (paused) return;
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [tokenStatus, paused, remainingSeconds]);

  // -------------------------------------------------------------------------
  // State for the rest of the UI
  // -------------------------------------------------------------------------
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(
    existingSelectedLetter
  );
  // Pre-existing selection means "this row is already answered". We
  // track it so the next/prev navigation knows whether to fire an
  // implicit skip (when leaving an unanswered position).
  const [hasExistingAnswer, setHasExistingAnswer] = useState(
    existingSelectedLetter !== null
  );

  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [actionPending, startTransition] = useTransition();

  const totalQuestions = session.question_list.length;
  const isFirst = position === 0;
  const isLast = position === totalQuestions - 1;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function popElapsed(): number {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    // Bootstrap: first call anchors lastSyncAt and reports zero
    // elapsed (the user just landed on the page — no observable time
    // has passed from their POV yet).
    if (lastSyncAt.current === 0) {
      lastSyncAt.current = now;
      return 0;
    }
    const delta = Math.max(0, Math.round((now - lastSyncAt.current) / 1000));
    lastSyncAt.current = now;
    return delta;
  }

  function syncRemaining(serverRemaining: number): void {
    setRemainingSeconds(Math.max(0, serverRemaining));
  }

  function handleWindowConflict(): void {
    setTokenStatus("conflict");
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleChoice(letter: Letter): Promise<void> {
    if (paused || actionPending || tokenStatus !== "ok") return;
    const token = tokenRef.current;
    if (!token) return;
    setSelectedLetter(letter);
    const elapsed = popElapsed();
    startTransition(async () => {
      const result = await submitExamAttempt({
        sessionId: session.id,
        windowToken: token,
        clientElapsedSeconds: elapsed,
        position,
        selectedLetter: letter,
      });
      if (!result.ok) {
        if (result.error === "window_conflict") {
          handleWindowConflict();
        } else {
          toast.error("אירעה שגיאה. נסה שוב");
          setSelectedLetter(existingSelectedLetter);
        }
        return;
      }
      setHasExistingAnswer(true);
      syncRemaining(result.remaining_seconds);
    });
  }

  function navigate(toPosition: number, opts: { skip?: boolean } = {}): void {
    if (toPosition < 0 || toPosition > totalQuestions - 1) return;
    if (toPosition === position) return;
    const token = tokenRef.current;
    if (!token) return;

    // Implicit skip: leaving an unanswered position with no existing
    // answer. Fire skipExamQuestion before navigating so we record
    // the row with was_skipped=true.
    if (
      opts.skip ??
      (selectedLetter === null && !hasExistingAnswer)
    ) {
      const elapsed = popElapsed();
      void skipExamQuestion({
        sessionId: session.id,
        windowToken: token,
        clientElapsedSeconds: elapsed,
        position,
      }).then((result) => {
        if (!result.ok && result.error === "window_conflict") {
          handleWindowConflict();
          return;
        }
        // We don't block navigation on skip's result — the action is
        // best-effort. Navigation has already started.
      });
    }

    window.location.assign(examPlayUrl(session.id, toPosition));
  }

  async function handlePauseToggle(): Promise<void> {
    if (actionPending || tokenStatus !== "ok") return;
    const token = tokenRef.current;
    if (!token) return;
    const elapsed = popElapsed();
    if (paused) {
      // Resume
      startTransition(async () => {
        const result = await resumeExam({
          sessionId: session.id,
          windowToken: token,
        });
        if (!result.ok) {
          if (result.error === "window_conflict") handleWindowConflict();
          else toast.error("אירעה שגיאה. נסה שוב");
          return;
        }
        setPaused(false);
        syncRemaining(result.remaining_seconds);
      });
    } else {
      // Pause
      startTransition(async () => {
        const result = await pauseExam({
          sessionId: session.id,
          windowToken: token,
          clientElapsedSeconds: elapsed,
        });
        if (!result.ok) {
          if (result.error === "window_conflict") handleWindowConflict();
          else toast.error("אירעה שגיאה. נסה שוב");
          return;
        }
        setPaused(true);
      });
    }
  }

  async function handleExitToDashboard(): Promise<void> {
    if (actionPending || tokenStatus !== "ok") return;
    const token = tokenRef.current;
    if (!token) return;
    const elapsed = popElapsed();
    const result = await abandonAndExitExam({
      sessionId: session.id,
      windowToken: token,
      clientElapsedSeconds: elapsed,
    });
    if (!result.ok) {
      if (result.error === "window_conflict") handleWindowConflict();
      else toast.error("אירעה שגיאה. נסה שוב");
      return;
    }
    window.location.assign(result.url);
  }

  async function handleToggleBookmark(): Promise<void> {
    if (bookmarkPending || tokenStatus !== "ok") return;
    const token = tokenRef.current;
    if (!token) return;
    setBookmarkPending(true);
    const previous = bookmarked;
    setBookmarked(!previous);
    const result = await toggleExamBookmark({
      sessionId: session.id,
      windowToken: token,
      position,
    });
    if (!result.ok) {
      setBookmarked(previous);
      if (result.error === "window_conflict") handleWindowConflict();
      else toast.error("אירעה שגיאה. נסה שוב");
    } else {
      setBookmarked(result.bookmarked);
    }
    setBookmarkPending(false);
  }

  /**
   * Effective per-position status for the strip + the dialog. Starts
   * from `positionStatuses` (Server-hydrated) and overlays the
   * current-session optimistic state:
   *   - Current position: if user has just picked a letter or the row
   *     was pre-filled, treat as 'correct' (the strip collapses
   *     correct/wrong to a single 'answered' look regardless).
   *
   * We don't try to overlay other positions — the user can only modify
   * the current one per page load. A backward-nav round-trip
   * re-renders the page with fresh data.
   */
  const effectiveStatuses: ExamPositionStatus[] = positionStatuses.map(
    (s, i) =>
      i === position && (selectedLetter !== null || hasExistingAnswer)
        ? "correct"
        : s
  );

  const unansweredCount = effectiveStatuses.reduce(
    (acc, s) => (s === "unanswered" || s === "skipped" ? acc + 1 : acc),
    0
  );

  async function handleSubmitFinal(force = false): Promise<void> {
    if (tokenStatus !== "ok") return;
    const token = tokenRef.current;
    if (!token) return;

    // Real unanswered count drives the dialog decision. If everything's
    // answered, skip the dialog and submit directly.
    if (!force && unansweredCount > 0) {
      setSubmitConfirmOpen(true);
      return;
    }

    const elapsed = popElapsed();
    const result = await submitFinalExam({
      sessionId: session.id,
      windowToken: token,
      clientElapsedSeconds: elapsed,
    });
    if (!result.ok) {
      if (result.error === "window_conflict") handleWindowConflict();
      else toast.error("אירעה שגיאה. נסה שוב");
      return;
    }
    setSubmitConfirmOpen(false);
    window.location.assign(result.url);
  }

  // -------------------------------------------------------------------------
  // Auto-submit at 0:00
  // -------------------------------------------------------------------------
  // When the visual timer hits 0 and we're not paused, fire the final
  // submit silently. The action is idempotent so it's safe even if it
  // races with a manual click.
  const autoSubmitFiredRef = useRef(false);
  useEffect(() => {
    if (tokenStatus !== "ok") return;
    if (paused) return;
    if (remainingSeconds > 0) return;
    if (autoSubmitFiredRef.current) return;
    autoSubmitFiredRef.current = true;
    void handleSubmitFinal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenStatus, paused, remainingSeconds]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (tokenStatus === "pending") {
    // Brief blank state during the localStorage read on mount. Keeps
    // the SSR'd markup from contradicting the conflict outcome.
    return <div className="min-h-screen" aria-hidden />;
  }

  if (tokenStatus === "conflict") {
    return <WindowConflict />;
  }

  // statuses array for the progress strip. Phase 4: hydrated from the
  // Server Component via `positionStatuses`. We project each status
  // to the strip's cell-state vocabulary:
  //   correct / wrong → "answered" (one look — no answer-revealing
  //                                  during the exam, per spec)
  //   skipped         → "skipped"
  //   unanswered      → "pending"
  // The current cell is always rendered as "current" by the strip
  // (it checks `i === current` first), so we don't special-case here.
  const statuses: ExamProgressCellStatus[] = effectiveStatuses.map((s) => {
    if (s === "correct" || s === "wrong") return "answered";
    if (s === "skipped") return "skipped";
    return "pending";
  });

  return (
    <div className="-m-6 min-h-screen">
      <ExamHeader
        position={position}
        total={totalQuestions}
        remainingSeconds={remainingSeconds}
        paused={paused}
        busy={actionPending}
        onTogglePause={() => void handlePauseToggle()}
        onSubmit={() => void handleSubmitFinal(false)}
      />

      <ExamProgressStrip
        total={totalQuestions}
        current={position}
        statuses={statuses}
        onJump={(to) => navigate(to)}
        disabled={paused || actionPending}
      />

      <main className="mx-auto w-full max-w-3xl px-6 py-7">
        {/* Eyebrow row: question number on RTL-start, bookmark on
            RTL-end (per prototype). */}
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            שאלה {position + 1}
          </span>
          <button
            type="button"
            onClick={() => void handleToggleBookmark()}
            disabled={bookmarkPending || paused}
            aria-pressed={bookmarked}
            aria-label="סמן לחזרה"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              bookmarked
                ? "text-amber-600"
                : "text-muted-foreground",
              (bookmarkPending || paused) && "opacity-50"
            )}
          >
            <Bookmark
              className={cn("size-3.5", bookmarked && "fill-current")}
              aria-hidden
            />
            <span>סמן לחזרה</span>
          </button>
        </div>

        {/* Question card */}
        <div className="mb-4 rounded-xl border border-border bg-card p-7 shadow-sm">
          <p
            dir="auto"
            className="text-[19px] leading-relaxed whitespace-pre-wrap"
          >
            {questionText}
          </p>
        </div>

        {/* Choices */}
        <div className="mb-6 flex flex-col gap-2">
          {choices.map((c) => (
            <Choice
              key={c.letter}
              letter={c.letter}
              text={c.choice_text}
              isCorrect={undefined}
              selected={selectedLetter === c.letter}
              revealed={false}
              disabled={paused || actionPending}
              onSelect={(letter) => void handleChoice(letter)}
            />
          ))}
        </div>

        {/* Prev / Next footer */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(position - 1)}
            disabled={isFirst || paused || actionPending}
          >
            <ChevronRight className="size-4" aria-hidden />
            <span className="ms-1.5">שאלה קודמת</span>
          </Button>
          <Button
            onClick={() =>
              isLast ? void handleSubmitFinal(false) : navigate(position + 1)
            }
            disabled={paused || actionPending}
          >
            <span>{isLast ? "סיים בחינה" : "השאלה הבאה"}</span>
            <ChevronLeft className="ms-1.5 size-4" aria-hidden />
          </Button>
        </div>
      </main>

      <ExamPauseOverlay
        open={paused}
        onResume={() => void handlePauseToggle()}
        onExit={() => void handleExitToDashboard()}
        pending={actionPending}
      />

      <ExamSubmitConfirmDialog
        open={submitConfirmOpen}
        unansweredCount={unansweredCount}
        onConfirm={() => void handleSubmitFinal(true)}
        onCancel={() => setSubmitConfirmOpen(false)}
        pending={actionPending}
      />
    </div>
  );
}
