"use client";

import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LogOut,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { NoteTriggerButton } from "@/app/(app)/_components/note-trigger-button";
import {
  advanceToNext,
  exitSession,
  saveNote,
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

// Slice 25 B-1 — TipTap + the note sheet ship a ~80-110 KB chunk;
// lazy-load it via next/dynamic + ssr:false so the play screen's
// initial bundle stays clean. The chunk only downloads when the
// user opens the editor for the first time in this page load.
// `next/dynamic` resolves the import on demand, and because the
// parent conditionally renders <NoteEditorSheet> only when
// `noteSheetOpen === true`, the import promise doesn't fire until
// the trigger button is clicked.
const NoteEditorSheet = dynamic(
  () =>
    import("@/app/(app)/_components/note-editor-sheet").then(
      (m) => m.NoteEditorSheet
    ),
  { ssr: false }
);

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

/** Slice 25 B-1 — initial note state passed in from the play page.
 *  `null` when no note has been saved for this question yet. */
type InitialNotePayload = {
  contentJson: unknown;
  contentHtml: string;
  updatedAt: string;
};

type PracticeQuestionProps = {
  session: PracticeSessionRow;
  view: ViewModel;
  position: number;
  totalQuestions: number;
  existingAttempt: AttemptRow | null;
  bookmarked: boolean;
  /** Slice 24 — server-computed seconds left on the session timer.
   *  `null` when the session was created with no timer
   *  (`session_duration_seconds === 0`). The play screen renders no
   *  timer or expiry dialog in that case. */
  sessionRemainingSeconds: number | null;
  /** Slice 25 B-1 — `null` when this question has no saved note. */
  initialNote: InitialNotePayload | null;
  /** Slice 25 B-1 — server-built Hebrew header label for the
   *  note-editor sheet ("שאלה N · {chapter}"). */
  questionContextLabel: string;
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
  sessionRemainingSeconds,
  initialNote,
  questionContextLabel,
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

  // Slice 24 — per-session timer model. `sessionRemainingSeconds`
  // is the server-computed wall-clock budget; the visual <Timer>
  // ticks down from it. When the local tick reaches 0 we open the
  // session-expired dialog (warn-only — no auto-submit, no lock).
  // `sessionRemainingSeconds === null` means the session was created
  // with no timer, so no timer / dialog render at all.
  const sessionTimerEnabled = sessionRemainingSeconds !== null;
  const sessionAlreadyExpired =
    sessionTimerEnabled && sessionRemainingSeconds === 0;
  const [sessionTimerExpired, setSessionTimerExpired] = useState(
    sessionAlreadyExpired
  );

  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [panel360Expanded, setPanel360Expanded] = useState(false);

  // Slice 25 B-1 — Notes sheet open state. The lazy `<NoteEditorSheet>`
  // import only fires once `noteSheetOpen` flips to `true` for the
  // first time, keeping TipTap out of the play screen's initial
  // chunk. `hasNote` drives the gold-filled trigger icon.
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [hasNote, setHasNote] = useState(initialNote !== null);

  // Session timer runs continuously while it's enabled and hasn't
  // expired — independent of `revealed`. The Timer component
  // self-freezes at 0; the dialog state below mirrors that.
  const timerRunning = sessionTimerEnabled && !sessionTimerExpired;

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
    // Slice 24 — the session-level expiry dialog is independent of
    // per-question reveal, so we no longer reset it here.

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
          page-content area, NOT constrained to the centered column.
          Slice 33 — mobile compacting: tighter padding + gaps, breadcrumb
          collapses to its leaf segment, and "סיים סשן" becomes an
          icon-only button at <md. Desktop layout (md+) is unchanged. */}
      <div className="mb-4 overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 md:px-5 md:py-3">
          {/* RTL natural-start cluster: breadcrumb. Slice 33 — root +
              chapter segments hide at <md so only the leaf remains;
              the root stays reachable via the sidebar logo. */}
          <nav
            aria-label="ניווט"
            className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link
              href="/dashboard"
              className="hidden md:inline hover:text-foreground"
            >
              תרגול
            </Link>
            <ChevronLeft className="hidden md:inline size-3.5 shrink-0" aria-hidden />
            <span className="hidden md:inline truncate" dir="auto">
              {view.breadcrumbChapter}
            </span>
            <ChevronLeft className="hidden md:inline size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-medium text-foreground">
              {view.breadcrumbType}
            </span>
          </nav>
          {/* RTL natural-end cluster: counter + bookmark + timer + exit.
              Slice 33 — gap-1.5 at <md so 4–5 controls fit at 320px;
              md:gap-3 preserves the desktop rhythm. */}
          <div className="flex items-center gap-1.5 md:gap-3">
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
            <NoteTriggerButton
              hasNote={hasNote}
              onClick={() => setNoteSheetOpen(true)}
            />
            {sessionTimerEnabled && (
              <Timer
                initialSeconds={sessionRemainingSeconds}
                running={timerRunning}
                onExpired={() => setSessionTimerExpired(true)}
              />
            )}
            {/* Slice 33 — "סיים סשן" rendered TWO ways for back-compat
                with the existing tests + visual treatment on desktop:
                icon-only (LogOut) at <md to match the bookmark/note
                button footprint, and the original ghost Button text
                at md+. The icon button keeps the aria-label so SR users
                still hear "סיים סשן". */}
            <button
              type="button"
              onClick={handleExitClick}
              aria-label="סיים סשן"
              title="סיים סשן"
              className={cn(
                "md:hidden",
                "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-colors",
                "hover:border-amber-400/60 hover:bg-amber-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
            >
              <LogOut className="size-4" aria-hidden />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExitClick}
              className="hidden md:inline-flex"
            >
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
      {/* Subtopic chip row — meta-context above the question card.
          Slice 18 dropped the preceding source/angle pill ("שאלת מקור"
          / "זווית X") that used to sit before this chip. The view
          model still carries `view.kind` and `view.breadcrumbType`
          (used by ServerComponent + page wiring) — they're now dead
          render data here, kept so the engine signatures stay intact. */}
      <div className="flex flex-wrap items-center gap-2">
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
        {/* Slice 37 — question stem wrapped in <NoCopyText> so the
            copy/paste deterrent applies here (the stem isn't covered
            by the choice / 360° shared seams). */}
        <NoCopyText
          dir="auto"
          className="whitespace-pre-wrap text-[17px] leading-relaxed"
        >
          {view.question.question_text}
        </NoCopyText>

        {/* Slice 24 — the per-question "התחל טיימר" opt-in is gone.
            The session timer runs automatically when configured;
            otherwise no timer surface renders at all. */}
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

      {/* Slice 24 — session-level expiry dialog. Replaces the
          per-question variant: "המשך תרגול" dismisses; "סיים סשן"
          ends the session and routes to the summary. No auto-submit,
          no lock — the user keeps control. */}
      <TimerExpiredDialog
        open={sessionTimerExpired}
        onContinue={() => setSessionTimerExpired(false)}
        onEndSession={() => void doExit()}
        pending={exiting}
      />

      {/* Slice 25 B-1 — Notes editor (lazy-loaded — see import at
          top of file). Mounted only when the user has opened the
          sheet at least once. After close, the local hasNote flag
          flips to true so the trigger icon stays gold-filled
          (matches Bookmark's amber-fill convention). */}
      {noteSheetOpen && (
        <NoteEditorSheet
          open={noteSheetOpen}
          onClose={() => {
            setNoteSheetOpen(false);
            setHasNote(true);
          }}
          questionContextLabel={questionContextLabel}
          initialNote={initialNote}
          // Slice 26 — editor is surface-agnostic; the play screen
          // wraps the (sessionId, position) save path that resolves
          // identity via getQuestionForPosition server-side.
          onSave={({ contentJson, contentHtml }) =>
            saveNote({
              sessionId: session.id,
              position,
              contentJson,
              contentHtml,
            })
          }
        />
      )}
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
