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
} from "@/lib/api/exam";
import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
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
 *   - local timer countdown (visual only — server is authoritative
 *     via the Phase 5 SECURITY DEFINER RPCs which compute elapsed
 *     from `last_activity_at` inside Postgres)
 *   - selected letter (pre-filled on backward nav; new selection
 *     UPSERTs server-side)
 *   - pause state (mirrors server status)
 *   - bookmark state (optimistic, server-confirmed)
 *   - submit-confirm dialog open state
 *   - window-token validation against localStorage + cross-tab storage
 *     events (Phase 5 single-window guard)
 *
 * Phase 5 also dropped `clientElapsedSeconds` from every action call:
 * the server reads elapsed from `NOW() - last_activity_at` directly,
 * so the client no longer needs to carry a delta.
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
        // No stored token (or stale): possible if the user opened the
        // play URL directly, or another tab just claimed the session.
        setTokenStatus("conflict");
      } catch {
        // localStorage unavailable — treat as conflict (safer than
        // letting actions silently run with no token).
        setTokenStatus("conflict");
      }
    });
  }, [session.id, session.active_window_token]);

  // -------------------------------------------------------------------------
  // Cross-tab claim detection
  // -------------------------------------------------------------------------
  // Phase 5: another tab calling `claimExamWindow` writes a new token
  // to localStorage. The `storage` event fires synchronously in this
  // tab, so we surface the conflict screen WITHOUT waiting for the
  // user's next server action to fail with 'window_conflict'.
  useEffect(() => {
    function handleStorage(e: StorageEvent): void {
      if (e.key !== `lawpass.exam.${session.id}.windowToken`) return;
      // newValue is set when another tab wrote; null when the entry
      // was removed. Either way, if it diverges from our in-memory
      // tokenRef, this tab is now stale.
      if (e.newValue && e.newValue !== tokenRef.current) {
        setTokenStatus("conflict");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [session.id]);

  // -------------------------------------------------------------------------
  // Local timer (visual only)
  // -------------------------------------------------------------------------
  const initialRemaining = Math.max(
    0,
    session.total_duration_seconds - session.time_used_seconds
  );
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const [paused, setPaused] = useState(session.status === "paused");

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
    startTransition(async () => {
      const result = await submitExamAttempt({
        sessionId: session.id,
        windowToken: token,
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
      void skipExamQuestion({
        sessionId: session.id,
        windowToken: token,
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
    const result = await abandonAndExitExam({
      sessionId: session.id,
      windowToken: token,
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

    const result = await submitFinalExam({
      sessionId: session.id,
      windowToken: token,
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
  // Keyboard shortcuts (Phase 6)
  // -------------------------------------------------------------------------
  // RTL-aware: ArrowLeft moves forward (visually left in RTL Hebrew),
  // ArrowRight moves back. 1-4 and א-ד both select choices. B toggles
  // bookmark, P toggles pause, Escape opens the submit flow.
  //
  // Gated by tokenStatus/paused/actionPending/submitConfirmOpen so we
  // don't fight modals — pause overlay and submit dialog handle their
  // own keys via base-ui's focus trap.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (tokenStatus !== "ok") return;
      if (paused || submitConfirmOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(position + 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(position - 1);
        return;
      }

      const choiceMap: Record<string, Letter> = {
        "1": "א",
        "2": "ב",
        "3": "ג",
        "4": "ד",
        "א": "א",
        "ב": "ב",
        "ג": "ג",
        "ד": "ד",
      };
      const mappedLetter = choiceMap[e.key];
      if (mappedLetter) {
        e.preventDefault();
        void handleChoice(mappedLetter);
        return;
      }

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        void handleToggleBookmark();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        void handlePauseToggle();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        void handleSubmitFinal(false);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // The handlers (navigate, handleChoice, etc.) are recreated every
    // render but close over the listed state. Re-registering on those
    // state changes is what keeps them current — listing the function
    // identities would re-register on every render (no behavior change,
    // just noise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tokenStatus,
    paused,
    submitConfirmOpen,
    position,
    actionPending,
    selectedLetter,
    hasExistingAnswer,
    bookmarked,
    bookmarkPending,
    unansweredCount,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (tokenStatus === "pending") {
    // Brief blank state during the localStorage read on mount. Keeps
    // the SSR'd markup from contradicting the conflict outcome.
    return <div className="min-h-screen" aria-hidden />;
  }

  if (tokenStatus === "conflict") {
    return <WindowConflict sessionId={session.id} />;
  }

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
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            שאלה {position + 1}
          </span>
          <button
            type="button"
            onClick={() => void handleToggleBookmark()}
            disabled={bookmarkPending || paused}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "בטל סימון" : "סמן לחזרה"}
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

        <div className="mb-4 rounded-xl border border-border bg-card p-7 shadow-sm">
          {/* Slice 37 — question stem wrapped in <NoCopyText>. */}
          <NoCopyText
            dir="auto"
            className="text-[19px] leading-relaxed whitespace-pre-wrap"
          >
            {questionText}
          </NoCopyText>
        </div>

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
