"use client";

import { Bookmark, ChevronLeft, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  advanceToNext,
  exitSession,
  submitAttempt,
  toggleBookmark,
} from "@/app/(app)/practice/play/_actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
 * The interactive practice flow. Renders one question at a time with:
 *  - topbar (breadcrumbs + Q-counter + timer + bookmark + exit)
 *  - progress bar
 *  - question type strip
 *  - question text card
 *  - manual "התחל טיימר" CTA before answer
 *  - 4 choice buttons
 *  - after answer: feedback banner + 360° panel + "השאלה הבאה" CTA
 *
 * Replay mode (`existingAttempt` is non-null on mount): starts in
 * revealed state with the user's prior choice highlighted and the
 * 360° panel rendered. Choices are disabled. "השאלה הבאה" advances
 * normally. The Server Component is responsible for passing the
 * un-stripped choice data (with is_correct populated) in this mode.
 *
 * Timer model: two independent timers.
 *   - `questionRenderedAt` ref captures performance.now() at mount.
 *     On submit, durationSeconds = round((now - mounted)/1000).
 *     Accurate even when the tab is backgrounded.
 *   - `<Timer>` child renders a setInterval-driven M:SS countdown
 *     purely for visual feedback. The two diverge during tab-throttle;
 *     that's fine — the persisted value is the accurate one.
 */
export function PracticeQuestion({
  session,
  view,
  position,
  totalQuestions,
  existingAttempt,
  bookmarked: bookmarkedProp,
}: PracticeQuestionProps) {
  // questionRenderedAt — captured at mount and never reassigned within
  // a position. Resetting on position change happens because the page
  // Server Component re-renders the whole tree (window.location.assign
  // forces a full page load, not just an RSC patch).
  const questionRenderedAt = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0
  );

  const initialIsCorrect = existingAttempt?.is_correct ?? null;
  const initialSelectedLetter = existingAttempt?.selected_letter ?? null;

  const [selectedLetter, setSelectedLetter] = useState<ChoiceLetter | null>(
    initialSelectedLetter
  );
  const [revealed, setRevealed] = useState<boolean>(existingAttempt !== null);
  // correctChoice and isCorrect are derived from the choices prop ONLY
  // when revealed (the server stripped is_correct from the choices for
  // unrevealed initial render — see stripAnswerFromChoices in
  // lib/db/practice.ts). For first-time submit we update these from the
  // submitAttempt response.
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
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Derived: the visible timer runs only while the user has started it
  // AND hasn't yet revealed the answer. No setState-in-effect — when
  // `revealed` flips true the prop just stops being true on the next
  // render and the child clears its interval in its own cleanup.
  const timerRunning = timerStarted && !revealed;

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

    // Archived mid-session: skip silently and auto-advance.
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

    // Normal completion: reveal with server-derived correctness. The
    // server's correctChoiceId points to one of the choices already in
    // our props — we look it up here so the 360° panel and feedback
    // banner can render. The is_correct flag was stripped from those
    // choices before render; rebuild a corrected list locally for the
    // 360° panel's distractor table.
    const matchedCorrect = view.question.choices.find(
      (c) => c.id === result.correctChoiceId
    );
    if (matchedCorrect) {
      setCorrectChoice({ ...matchedCorrect, is_correct: true });
    }
    setIsCorrect(result.isCorrect);
    setRevealed(true);
    setSubmitting(false);
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
    // Full-page navigation per Slice 1 convention — works for both
    // same-segment (next position) and cross-segment (to summary).
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
    // answered === totalQuestions: no confirmation, completion is the
    // only path forward anyway.
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
    totalQuestions > 0 ? Math.round(((position + 1) / totalQuestions) * 100) : 0;

  // For the 360° panel: same choices, but with the correct one's
  // is_correct flipped on so the distractor table colours render.
  const choicesFor360: ChoiceType[] = view.question.choices.map((c) => ({
    ...c,
    is_correct: correctChoice ? c.id === correctChoice.id : c.is_correct,
  }));

  // The 360° panel receives a "question" with corrected choices.
  const question360 =
    view.kind === "source"
      ? { ...view.question, choices: choicesFor360 }
      : { ...view.question, choices: choicesFor360 };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Topbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="ניווט"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/dashboard" className="hover:text-foreground">
            תרגול
          </Link>
          <ChevronLeft className="size-3.5" aria-hidden />
          <span dir="auto">{view.breadcrumbChapter}</span>
          <ChevronLeft className="size-3.5" aria-hidden />
          <span className="font-medium text-foreground">
            {view.breadcrumbType}
          </span>
        </nav>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {position + 1} / {totalQuestions}
          </span>
          <Timer
            initialSeconds={session.time_per_question_seconds}
            running={timerRunning}
          />
          <button
            type="button"
            onClick={handleToggleBookmark}
            disabled={bookmarkPending}
            title="סמן"
            aria-label="סמן שאלה"
            aria-pressed={bookmarked}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition-colors",
              "hover:border-amber-400/60 hover:bg-amber-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              bookmarkPending && "opacity-50"
            )}
          >
            <Bookmark
              className={cn(
                "size-4",
                bookmarked ? "fill-amber-400 text-amber-500" : "text-foreground"
              )}
              aria-hidden
            />
          </button>
          <Button variant="ghost" size="sm" onClick={handleExitClick}>
            סיים סשן
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />
      </div>

      {/* Question type strip */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        {view.kind === "source" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            שאלת מקור
          </span>
        ) : (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {view.breadcrumbType}
          </span>
        )}
        <span className="text-xs text-muted-foreground" dir="auto">
          · {view.subtopicTitle}
        </span>
      </div>

      {/* Question text */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <p
            dir="auto"
            className="whitespace-pre-wrap text-[17px] leading-relaxed"
          >
            {view.question.question_text}
          </p>
        </CardContent>
      </Card>

      {/* Manual timer start row — only when not running, not revealed */}
      {!revealed && !timerStarted && (
        <div className="mb-4 flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTimerStarted(true)}
          >
            <Play className="size-3.5" aria-hidden />
            <span>התחל טיימר</span>
          </Button>
          <span className="text-xs text-muted-foreground">
            או ענה ישירות בלי טיימר
          </span>
        </div>
      )}

      {/* Choices */}
      <div className="mb-4 flex flex-col gap-2">
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

      {/* Post-answer feedback + advance CTA + 360° panel */}
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
                  isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
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

          <div className="mb-2 flex justify-end">
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
              <ChevronLeft className="size-3.5" aria-hidden />
            </Button>
          </div>

          <Learning360Panel
            question={question360}
            correctChoice={correctChoice}
          />
        </>
      )}

      <ExitConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={doExit}
        questionsAnswered={session.questions_answered}
        totalQuestions={totalQuestions}
        confirming={exiting}
      />
    </div>
  );
}
