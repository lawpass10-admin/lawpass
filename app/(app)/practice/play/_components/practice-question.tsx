"use client";

import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  advanceToNext,
  exitSession,
  submitAttempt,
  toggleBookmark,
} from "@/app/(app)/practice/play/_actions";
import { Button } from "@/components/ui/button";
import type {
  AngleQuestionRow,
  AttemptRow,
  Choice as ChoiceType,
  PracticeSessionRow,
  SourceQuestionRow,
} from "@/lib/db/practice";
import { cn } from "@/lib/utils";
import type { ChoiceLetter } from "@/lib/validators/practice";

import { Choice } from "./choice";
import { ExitConfirmDialog } from "./exit-confirm-dialog";
import { Learning360Panel } from "./learning-360-panel";
import { Timer } from "./timer";
import { TimerExpiredDialog } from "./timer-expired-dialog";

type ViewModel =
  | {
      kind: "source";
      question: SourceQuestionRow;
      breadcrumbChapter: string;
      breadcrumbType: "שאלת מקור";
      subtopicTitle: string;
    }
  | {
      kind: "angle";
      question: AngleQuestionRow;
      breadcrumbChapter: string;
      breadcrumbType: string; // "זווית א" etc.
      subtopicTitle: string;
    };

type PracticeQuestionProps = {
  session: PracticeSessionRow;
  view: ViewModel;
  position: number;
  totalQuestions: number;
  existingAttempt: AttemptRow | null;
  bookmarked: boolean;
};

/**
 * Interactive practice flow. One question at a time:
 *  - sticky Header: breadcrumb on right; position counter, bookmark,
 *    timer, exit on left. Gold progress bar underneath.
 *  - type + subtopic chip row
 *  - question text card
 *  - manual "התחל טיימר" CTA (with "או ענה ישירות בלי טיימר" inline)
 *  - 4 choice buttons
 *  - after reveal: feedback banner + a two-button row
 *    ([הסתר/פירוט 360°] [השאלה הבאה]); 360° panel renders below the
 *    row only when the user opts in.
 *
 * Phase 5 changes from Phase 3:
 *  - Header restructured to match the prototype layout. Progress bar
 *    moved under the header.
 *  - Subtopic chip rendered alongside the type chip (was inline text).
 *  - Timer button styled with border + outline variant.
 *  - Timer expiry surfaces a non-dismissable AlertDialog.
 *  - 360° panel starts collapsed (was auto-expanded on reveal).
 *
 * Replay mode (`existingAttempt` is non-null on mount): starts in
 * revealed state with the user's prior choice highlighted. The 360°
 * panel still starts collapsed — the user clicks to expand.
 *
 * Timer model: two independent timers. The persisted `duration_seconds`
 * is derived from `performance.now()` at submit (accurate even when
 * the tab is backgrounded); the visual Timer is just setInterval.
 */
export function PracticeQuestion({
  session,
  view,
  position,
  totalQuestions,
  existingAttempt,
  bookmarked: bookmarkedProp,
}: PracticeQuestionProps) {
  // Slice 6 fix 2 — router.refresh() after a successful submit
  // re-runs the (app) layout server-side and pulls fresh
  // bookmarks/mistakes counts for the sidebar badges. The server
  // action's revalidatePath only invalidates the data cache; it
  // can't re-render the page that's already on screen.
  const router = useRouter();

  const questionRenderedAt = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0
  );

  const initialIsCorrect = existingAttempt?.is_correct ?? null;
  const initialSelectedLetter = existingAttempt?.selected_letter ?? null;

  const [selectedLetter, setSelectedLetter] = useState<ChoiceLetter | null>(
    initialSelectedLetter
  );
  const [revealed, setRevealed] = useState<boolean>(existingAttempt !== null);
  const correctChoiceInitial = revealed
    ? view.question.choices.find((c) => c.is_correct) ?? null
    : null;
  const [correctChoice, setCorrectChoice] = useState<ChoiceType | null>(
    correctChoiceInitial
  );
  const [isCorrect, setIsCorrect] = useState<boolean | null>(initialIsCorrect);

  const [bookmarked, setBookmarked] = useState(bookmarkedProp);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const [timerStarted, setTimerStarted] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [panel360Expanded, setPanel360Expanded] = useState(false);

  // Timer runs while: user started it, not yet revealed, not expired.
  // Once expired we freeze the visual at 0:00 (Timer enforces no-go-
  // negative); the parent gates `running` to false to stop the interval.
  const timerRunning = timerStarted && !revealed && !timerExpired;

  const isLastQuestion = position === totalQuestions - 1;

  async function handleChoice(letter: ChoiceLetter) {
    if (revealed || submitting) return;
    setSubmitting(true);
    setSelectedLetter(letter);

    const elapsed = Math.round(
      (performance.now() - questionRenderedAt.current) / 1000
    );
    const result = await submitAttempt({
      sessionId: session.id,
      position,
      selectedLetter: letter,
      durationSeconds: Math.max(0, Math.min(600, elapsed)),
    });

    if (!result.ok) {
      toast.error(result.error);
      setSelectedLetter(null);
      setSubmitting(false);
      return;
    }

    if (result.archived) {
      toast.info("השאלה הזו הוסרה זמנית מהמערכת. עוברים לשאלה הבאה.");
      const advance = await advanceToNext({
        sessionId: session.id,
        fromPosition: position,
      });
      if (advance.ok) {
        window.location.assign(advance.url);
      } else {
        toast.error(advance.error);
        setSubmitting(false);
      }
      return;
    }

    const matchedCorrect = view.question.choices.find(
      (c) => c.id === result.correctChoiceId
    );
    if (matchedCorrect) {
      setCorrectChoice({ ...matchedCorrect, is_correct: true });
    }
    setIsCorrect(result.isCorrect);
    setRevealed(true);
    setSubmitting(false);
    // Dismiss the expiry dialog if the user answered after it appeared.
    setTimerExpired(false);

    // Slice 6 fix 2 — refresh the layout so the sidebar
    // bookmarks/mistakes badges reflect this attempt without waiting
    // for the next hard navigation. Local reveal state above is set
    // BEFORE the refresh so the reveal UI paints on the current
    // render; refresh only swaps the server tree.
    router.refresh();
  }

  async function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    const result = await advanceToNext({
      sessionId: session.id,
      fromPosition: position,
    });
    if (!result.ok) {
      toast.error(result.error);
      setAdvancing(false);
      return;
    }
    window.location.assign(result.url);
  }

  async function handleToggleBookmark() {
    if (bookmarkPending) return;
    setBookmarkPending(true);
    const previous = bookmarked;
    setBookmarked(!previous);
    const result = await toggleBookmark({
      sessionId: session.id,
      position,
    });
    if (!result.ok) {
      setBookmarked(previous);
      toast.error(result.error);
    } else {
      setBookmarked(result.bookmarked);
    }
    setBookmarkPending(false);
  }

  function handleExitClick() {
    const answered = session.questions_answered;
    if (answered > 0 && answered < totalQuestions) {
      setExitOpen(true);
      return;
    }
    if (answered === 0) {
      setExitOpen(true);
      return;
    }
    void doExit();
  }

  async function doExit() {
    if (exiting) return;
    setExiting(true);
    const result = await exitSession({ sessionId: session.id });
    if (!result.ok) {
      toast.error(result.error);
      setExiting(false);
      setExitOpen(false);
      return;
    }
    window.location.assign(result.url);
  }

  const choicesForRender: ChoiceType[] = revealed
    ? view.question.choices.map((c) =>
        c.id === correctChoice?.id ? { ...c, is_correct: true } : c
      )
    : view.question.choices;

  const progressPct =
    totalQuestions > 0 ? ((position + 1) / totalQuestions) * 100 : 0;

  const choicesFor360: ChoiceType[] = view.question.choices.map((c) => ({
    ...c,
    is_correct: correctChoice ? c.id === correctChoice.id : c.is_correct,
  }));

  const question360 =
    view.kind === "source"
      ? { ...view.question, choices: choicesFor360 }
      : { ...view.question, choices: choicesFor360 };

  return (
    <>
      {/* Section A — Header card (Phase 9d hotfix): full-width across the
          page-content area, NOT constrained to the centered column. */}
      <div className="mb-4 overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          {/* RTL natural-start cluster: breadcrumb */}
          <nav
            aria-label="ניווט"
            className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/dashboard" className="hover:text-foreground">
              תרגול
            </Link>
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate" dir="auto">
              {view.breadcrumbChapter}
            </span>
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-medium text-foreground">
              {view.breadcrumbType}
            </span>
          </nav>
          {/* RTL natural-end cluster: counter + bookmark + timer + exit */}
          <div className="flex items-center gap-3">
            <PositionCounter current={position + 1} total={totalQuestions} />
            <button
              type="button"
              onClick={handleToggleBookmark}
              disabled={bookmarkPending}
              title="סמן"
              aria-label="סמן שאלה"
              aria-pressed={bookmarked}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-colors",
                "hover:border-amber-400/60 hover:bg-amber-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                bookmarkPending && "opacity-50"
              )}
            >
              <Bookmark
                className={cn(
                  "size-4",
                  bookmarked
                    ? "fill-amber-400 text-amber-500"
                    : "text-foreground"
                )}
                aria-hidden
              />
            </button>
            <Timer
              initialSeconds={session.time_per_question_seconds}
              running={timerRunning}
              onExpired={() => setTimerExpired(true)}
            />
            <Button variant="ghost" size="sm" onClick={handleExitClick}>
              סיים סשן
            </Button>
          </div>
        </div>
        {/* Thin gold progress bar — runs the inner card width. Clipped
            to the card's rounded corners via the wrapper's overflow-hidden. */}
        <div className="h-0.5 w-full bg-muted" aria-hidden>
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Centered content column below the full-width header. */}
      <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Type + subtopic chip row — meta-context above the question card */}
      <div className="flex flex-wrap items-center gap-2">
        {view.kind === "source" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            שאלת מקור
          </span>
        ) : (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {view.breadcrumbType}
          </span>
        )}
        {view.subtopicTitle && (
          <span
            dir="auto"
            className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/75"
          >
            {view.subtopicTitle}
          </span>
        )}
      </div>

      {/* Section B — Question card (Phase 9d hotfix): own white card.
          Holds the question text + (pre-reveal) timer-start row. */}
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <p
          dir="auto"
          className="whitespace-pre-wrap text-[17px] leading-relaxed"
        >
          {view.question.question_text}
        </p>

        {!revealed && !timerStarted && (
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTimerStarted(true)}
            >
              <Play className="size-3.5" aria-hidden />
              <span className="ms-1.5">התחל טיימר</span>
            </Button>
            <span className="text-xs text-muted-foreground">
              או ענה ישירות בלי טיימר
            </span>
          </div>
        )}
      </div>

      {/* Section B' — Answer choices (Phase 9d hotfix): each Choice is
          its own white card sibling, no shared wrapper. */}
      <div className="space-y-3">
        {choicesForRender.map((c) => (
          <Choice
            key={c.letter}
            letter={c.letter}
            text={c.choice_text}
            isCorrect={revealed ? c.is_correct : undefined}
            selected={selectedLetter === c.letter}
            revealed={revealed}
            disabled={submitting}
            onSelect={handleChoice}
          />
        ))}
      </div>

      {/* Post-answer */}
      {revealed && correctChoice && (
          <>
            <div
              className={cn(
                "mb-4 flex items-start gap-3 rounded-lg border p-4",
                isCorrect
                  ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-destructive/50 bg-destructive/10"
              )}
              role="status"
            >
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isCorrect
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {isCorrect ? "תשובה נכונה" : "תשובה שגויה"}
                </p>
                <p className="mt-1 text-sm text-foreground/80">
                  {isCorrect
                    ? "מצוין. עיין בפירוט המלא להעמקה."
                    : `התשובה הנכונה היא ${correctChoice.letter}. עיין בפירוט להבנת השגיאה.`}
                </p>
              </div>
            </div>

            {/* Two-button row: 360° toggle on right, advance on left.
                Phase 5: 360° panel does NOT auto-expand; user opts in. */}
            <div className="mb-2 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setPanel360Expanded((v) => !v)}
              >
                {panel360Expanded ? (
                  <>
                    <ChevronUp className="size-4" aria-hidden />
                    <span className="ms-1.5">הסתר פירוט</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" aria-hidden />
                    <span className="ms-1.5">פירוט 360° מלא</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={handleAdvance}
                disabled={advancing}
              >
                <span>
                  {advancing
                    ? "טוען..."
                    : isLastQuestion
                      ? "סיום וצפייה בסיכום"
                      : "השאלה הבאה"}
                </span>
                <ChevronLeft className="ms-1.5 size-4" aria-hidden />
              </Button>
            </div>

            {panel360Expanded && (
              <Learning360Panel
                question={question360}
                correctChoice={correctChoice}
              />
            )}
          </>
        )}
      </div>

      <ExitConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={doExit}
        questionsAnswered={session.questions_answered}
        totalQuestions={totalQuestions}
        confirming={exiting}
      />

      <TimerExpiredDialog
        open={timerExpired && !revealed}
        alreadyAnswered={revealed}
        onContinue={() => setTimerExpired(false)}
        onSkipNext={async () => {
          // Use the same advanceToNext path as the post-reveal button.
          // Since the user hasn't answered, no attempt row exists; the
          // session's questions_answered stays put. advanceToNext just
          // increments the URL position.
          setTimerExpired(false);
          await handleAdvance();
        }}
        pending={advancing}
      />
    </>
  );
}

/**
 * Position counter with the small gold underline beneath the current
 * number. Used in the Header right cluster (RTL visual-end).
 */
function PositionCounter({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="text-sm font-medium tabular-nums">
      <span className="border-b-2 border-primary pb-0.5">{current}</span>
      <span className="text-muted-foreground"> / {total}</span>
    </div>
  );
}
