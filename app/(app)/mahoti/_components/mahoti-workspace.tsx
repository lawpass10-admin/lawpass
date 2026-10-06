"use client";

import { ChevronLeft, ChevronRight, ClipboardCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CheckAnsweredButton } from "@/app/(app)/_components/check-answered-button";
import styles from "@/app/(app)/_components/fit-to-box/question-fit.module.css";
import { useFitToBox, type FitBounds } from "@/app/(app)/_components/fit-to-box/use-fit-to-box";
import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { useIsNarrow } from "@/app/(app)/_components/use-is-narrow";
import { Choice } from "@/app/(app)/practice/play/_components/choice";
import {
  ExamProgressStrip,
  type ExamProgressCellStatus,
} from "@/app/(app)/exam/play/_components/exam-progress-strip";
import { NavigationGuard } from "@/components/app/navigation-guard";
import { Button } from "@/components/ui/button";
import { submitMahotiAttempt, type MahotiAttempt } from "@/lib/api/mahoti";
import {
  clearSitting,
  loadAnswers,
  saveAnswers,
} from "@/lib/sittings/progress";
import type { MahotiLetter, MahotiSet } from "@/lib/db/mahoti";
import { cn } from "@/lib/utils";

import { ExamTimerBar } from "./exam-timer-bar";
import { NotebookPane } from "./notebook-pane";

/**
 * Type-scale bounds for the fit-to-box pass, in px. 15 is the size the column
 * was designed at; 13 is the floor for the column as a whole, matching the
 * notebook opposite it — the question is the thing being read, so it must never
 * end up smaller than the reference material beside it. 10 is the options'
 * floor: below it Heebo stops being comfortably readable, and a question whose
 * options only fit at 9px is one the layout genuinely cannot hold.
 */
const FIT: FitBounds = { maxPx: 15, minPx: 13, answersMinPx: 10 };

/**
 * The same question on a phone, where this screen is far tighter than /diuni.
 *
 * ── Why the floors are nearly the desktop's, not far below them ────────────
 * They used to be 8.5 / 8. The idea was to keep shrinking until the four
 * options fit without a scrollbar, and on a phone that is a race the type
 * loses: a long fact pattern drove the options down to a size nobody reads,
 * and the box scrolled anyway once even 8px would not fit.
 *
 * The phone now does the opposite, deliberately (PM request): the question
 * column gets LESS of the screen — about a third of it — holds a readable
 * size, and SCROLLS for the rest. See the notebook's share below.
 *
 * So on a phone this pass barely does anything, and that is the point. It
 * steps 14 → 13 and stops; the two-stage shrink that lets the options go
 * smaller than the question is switched off by setting both floors to 13,
 * because shrinking the options buys nothing once the box is scrolling
 * anyway — it only makes the thing you are comparing harder to read.
 *
 * Scrolling to compare the four options is the accepted cost here. It is the
 * trade the desktop still refuses, where the fit pass earns its keep by
 * keeping the whole question in one look.
 */
const FIT_NARROW: FitBounds = { maxPx: 14, minPx: 13, answersMinPx: 13 };

/**
 * The דיון מהותי study screen: the paper on the left, the notebook it was
 * generated from on the right.
 *
 * The question column is the exam player's layout — same progress strip, same
 * <Choice> rows, same prev/next pair — so a candidate moving between the two
 * screens is not re-learning the interface. What it deliberately does NOT
 * carry over is the exam machinery: no session, no timer, no window token, no
 * server writes. Nothing here is scored, so the selected letter is local
 * state and disappears on reload, and no answer is revealed (the payload
 * arrives from the server with `correct_answer` already stripped — see
 * lib/db/mahoti.ts).
 */
export function MahotiWorkspace({ set }: { set: MahotiSet }) {
  const router = useRouter();
  const [position, setPosition] = useState(0);
  // Position -> chosen letter. Kept in localStorage as well, so a reload or a
  // crash does not throw away a 160-minute sitting — see
  // lib/sittings/progress.ts. The server still learns nothing until submit.
  const [answers, setAnswers] = useState<Record<number, MahotiLetter>>({});
  // Nothing may be written back before the restore has run, or the empty
  // initial state would overwrite a real sitting on mount.
  const restored = useRef(false);
  // Flipped by the timer bar's "התחל בחינה". Until then the choices are
  // inert: answering a timed paper while the clock reads a full 160:00 is
  // not a run of the sitting, and the elapsed time the review reports would
  // be meaningless. Browsing and reading the notebook stay open — only
  // committing an answer waits for the clock.
  const [examStarted, setExamStarted] = useState(false);
  // The filed sitting, once "שלח את המבחן לבדיקה" has been through the server.
  // Holding it here is what stops a second click filing a second attempt for
  // one run of the paper — re-sitting is allowed, but only by sitting it again.
  const [attempt, setAttempt] = useState<MahotiAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fitRef = useRef<HTMLDivElement | null>(null);

  // Restore in a microtask, matching the window-token read in
  // exam/play/_components/exam-question.tsx: it keeps the setState out of the
  // effect body (react-hooks/set-state-in-effect) and defers the change past
  // the hydration tick, so the server's empty sheet and the client's first
  // render still agree.
  useEffect(() => {
    queueMicrotask(() => {
      const stored = loadAnswers("mahoti", set.questionId);
      restored.current = true;
      if (stored) setAnswers(stored as Record<number, MahotiLetter>);
    });
  }, [set.questionId]);

  useEffect(() => {
    if (!restored.current) return;
    saveAnswers("mahoti", set.questionId, answers);
  }, [answers, set.questionId]);

  const total = set.questions.length;
  const question = set.questions[position];
  const isFirst = position === 0;
  const isLast = position === total - 1;

  const statuses: ExamProgressCellStatus[] = set.questions.map((_, i) =>
    answers[i] ? "answered" : "pending"
  );

  const answeredCount = set.questions.reduce(
    (count, _, i) => (answers[i] ? count + 1 : count),
    0
  );
  // "Answered the last question" is read as "nothing is left unanswered".
  // Taken literally — position === total - 1 — a candidate who jumped to the
  // last question first would stop their own clock with five questions still
  // open. Answering them in order lands on the same moment either way.
  const allAnswered = total > 0 && answeredCount === total;

  // The paper is sent for marking only once EVERY question has an answer. It
  // used to unlock at 30 of 40, with the rest counted wrong; that was removed
  // on PM request — the real sitting is answered in full, so this is too. With
  // nothing left unanswered there is no early submit to confirm, which is why
  // the confirmation dialog that used to guard it is gone as well.
  const canSubmit = allAnswered;

  // The review is addressed by the FILED sitting, not by the letters: it then
  // shows the score that is in the table rather than one it worked out again
  // from a URL, and matches answers to questions by number rather than by
  // position. There is no link to it before the submit has been through the
  // server, because until then there is no sitting to point at.
  function resultsUrlFor(answerId: string): string {
    return `/mahoti/results?attempt=${encodeURIComponent(answerId)}`;
  }

  function go(to: number): void {
    if (to < 0 || to > total - 1) return;
    setPosition(to);
  }

  /**
   * File the sitting, then show the result.
   *
   * The marking is the server's: the paper arrives here without
   * `correct_answer` (lib/db/mahoti.ts strips it), so this sends the letters
   * and is told what they were worth. The score shown is the one that was just
   * written to the row, which is what makes the score on screen and the score
   * in the table the same number rather than two calculations of it.
   *
   * NO TAB IS OPENED HERE ANY MORE. This used to open one before the await —
   * empty, then pointed at the review — because a tab opened after an await is
   * no longer attributable to the click and popup blockers eat it. The score
   * modal replaced that: the candidate sees what they scored and per which law,
   * and opens the solution from a real link inside it, which is a fresh user
   * gesture and needs no such workaround.
   *
   * Answers are sent by question NUMBER, not by position: `answers` is keyed by
   * where the question sits on screen, and the two agree only for as long as
   * nothing ever reorders a paper.
   */
  async function handleSubmit(): Promise<void> {
    if (submitting || attempt) return;
    setSubmitting(true);

    const result = await submitMahotiAttempt(
      set.questionId,
      set.questions.map((question, i) => ({
        number: question.number,
        letter: answers[i] ?? null,
      }))
    );
    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    // Filed, so the recovery copy has done its job. Left behind it would
    // offer to resume a paper that has already been marked — and the next
    // sitting of this same paper must start from an empty sheet.
    clearSitting("mahoti", set.questionId);

    // `submitting` is deliberately left true: the navigation is in flight and
    // re-enabling the button would offer a second filing of the same sitting.
    setAttempt(result.data);
    router.push(resultsUrlFor(result.data.answer_id));
  }

  // Re-fit whenever the question changes: the next fact pattern is a
  // different length, so the size that fit the last one means nothing.
  // The viewport joins the re-fit key — see the note in diuni-workspace.tsx.
  const narrow = useIsNarrow();
  useFitToBox(fitRef, `${position}:${narrow}`, narrow ? FIT_NARROW : FIT);

  return (
    // The whole screen is one non-scrolling column: the page itself never
    // grows a scrollbar, and each pane scrolls inside its own box instead.
    // That is what keeps the notebook's scrollbar, the prev/next pair and
    // the submit bar all on screen at once, whatever the paper's length.
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Nothing about a sitting in progress is on the server — the letters
          and the clock live in this component's state, so leaving the page
          discards a 160-minute paper with no way to recover it. Until the
          sitting is filed, every exit therefore asks first. Disarms on its
          own once `attempt` is set: after marking there is nothing left to
          lose, and the candidate must be free to open the solution. */}
      <NavigationGuard
        active={examStarted && attempt === null}
        title="לצאת מהמבחן?"
        description="המבחן בעיצומו והתשובות שסימנת עדיין לא נשלחו לבדיקה. יציאה מהדף תמחק אותן ואת הזמן שנותר, ולא ניתן יהיה לשחזר אותם."
      />
      {/* Also frozen once the sitting is filed: a clock still running after
          the paper has been marked is counting nothing. */}
      <ExamTimerBar
        frozen={allAnswered || attempt !== null}
        onStartedChange={setExamStarted}
        sitting={{ kind: "mahoti", setId: set.questionId }}
      >
        <CheckAnsweredButton
          reviewRoute="/mahoti/review"
          setId={set.questionId}
          given={set.questions.map((question, i) => ({
            number: question.number,
            letter: answers[i] ?? null,
          }))}
        />
      </ExamTimerBar>

      {/* Not sticky here (see the `sticky` prop's note in the strip): inside
          a fixed-height column a sticky strip lifts off and covers the two
          panes. In flow it stays the lid they hang from. */}
      <div className="shrink-0 overflow-hidden rounded-lg">
        <ExamProgressStrip
          total={total}
          current={position}
          statuses={statuses}
          onJump={go}
          sticky={false}
          className="py-1.5"
        />
      </div>

      {/* flex-col-reverse on small screens puts the question (second in the
          DOM) above the notebook. On lg the row is laid out RTL, so the
          notebook — first in the DOM — takes the start edge, which is the
          visual RIGHT, leaving the question on the left as asked. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:flex-row lg:items-stretch">
        {/* An even split, not a favoured side: half the row each, with the
            gap-4 (1rem) taken half from each column so the two panes come
            out exactly the same width. The question column is the only
            flexible item, so it takes precisely the space this one leaves.
            `h-full` rather than the old sticky + calc(100vh-7rem): the
            parent now owns the height, so the notebook can no longer
            disagree with it by a header's worth of pixels. */}
        <aside
          aria-label="מחברת החקיקה"
          // ON A PHONE THE NOTEBOOK TAKES THE LARGER SHARE (55%), which is the
          // reverse of what this was. It went 40% → 32% on the reasoning that
          // the question is the thing being answered, so it should get the
          // room — but in practice a 32% notebook on a phone shows about four
          // lines of statute, which is too little to read a section in, and the
          // candidate ends up scrolling a tiny window the whole sitting.
          //
          // Both panes scroll in place, so neither is ever cut off; the only
          // question is which one you scroll MORE. A statute is read in long
          // passages and a question is read once and then compared against four
          // short options, so the long-form reading gets the bigger window.
          //
          // 68% after two rounds of looking at it on a real handset: 32% was
          // the original, 55% was still not enough statute on screen to read a
          // section without scrolling the window itself. The notebook is now
          // roughly where the question column used to be, and vice versa.
          //
          // One number to tune: basis-[68%]. It must stay a literal class —
          // Tailwind scans source text, so an interpolated value compiles to
          // nothing. lg: is untouched; the desktop split is still even.
          className="min-h-0 shrink-0 basis-[68%] lg:h-full lg:w-[calc(50%-0.5rem)] lg:basis-auto"
        >
          {/* Sibling of the question column, not a child of it, so the
              notebook's own page state survives moving between questions —
              flipping to question 3 must not throw the reader back to
              page 1. */}
          <NotebookPane notebook={set.notebook} />
        </aside>

        <section
          aria-label="שאלה"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {/* Counter only. The question's law used to sit opposite it, but
              naming the law is half the answer while the candidate is still
              working — it belongs in the review, where the references list
              already carries it. */}
          <div className="mb-1.5 flex shrink-0 items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              שאלה {position + 1} / {total}
            </span>
            {!examStarted ? (
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-500">
                לחצו „התחל בחינה” כדי לענות
              </span>
            ) : null}
          </div>

          {/* DESKTOP: no scrollbar by design — `useFitToBox` above steps the
              type down until the fact pattern and all four options clear this
              box, so the whole question is readable in one look.
              `overflow-hidden` is the backstop for the case where even the
              13px floor is not enough; the strip's question numbers remain the
              way out.

              PHONE: the opposite. This box is now the smaller of the two panes
              and scrolls at a readable size instead of shrinking to fit — see
              FIT_NARROW. The fit pass still runs, but between 14px and 12px it
              is trimming rather than cramming. */}
          <div
            ref={fitRef}
            // Scrolls on a phone, clips on a desktop — see diuni-workspace.tsx
            // for why the desktop must not scroll.
            className={cn("min-h-0 flex-1 overflow-y-auto md:overflow-hidden", styles.fit)}
          >
            {/* Sized by --fit-q-font, not a fixed value: at half the row a
                long fact pattern at 19px pushed the choices below the fold,
                and even 15px does not always fit. */}
            <div className="mb-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <NoCopyText
                dir="auto"
                className="leading-relaxed whitespace-pre-wrap"
              >
                {[question.fact_pattern, question.stem]
                  .filter((part) => part && part.trim())
                  .join("\n\n")}
              </NoCopyText>
            </div>

            {/* Dimmed as well as disabled while the clock is unstarted: a
                <button disabled> alone gives no visual cue, and a candidate
                clicking a choice that silently does nothing reads it as a
                broken page rather than as a locked one. */}
            <div
              className={cn(
                "flex flex-col gap-1.5 transition-opacity",
                styles.answers,
                !examStarted && "opacity-60"
              )}
            >
              {question.options.map((option) => (
                <Choice
                  key={option.letter}
                  letter={option.letter}
                  text={option.text}
                  isCorrect={undefined}
                  selected={answers[position] === option.letter}
                  revealed={false}
                  disabled={!examStarted}
                  onSelect={(letter) =>
                    setAnswers((prev) => ({ ...prev, [position]: letter }))
                  }
                />
              ))}
            </div>
          </div>

          {/* Pinned action stack. No left gutter needed: the accessibility
              and QA launchers moved to the top-left corner, so nothing
              floats over this row any more. */}
          <div className="shrink-0 space-y-2 pt-2">
            {/* px-3 matches the green bar's own padding below, so "השאלה
                הבאה" and "שלח את המבחן לבדיקה" share one left edge and
                "שאלה קודמת" lines up with the bar's text. Without it the
                nav row runs to the column edge and the two primary buttons
                sit 12px out of step. */}
            <div className="flex items-center justify-between gap-4 px-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => go(position - 1)}
                disabled={isFirst}
              >
                <ChevronRight className="size-4" aria-hidden />
                <span className="ms-1.5">שאלה קודמת</span>
              </Button>
              <Button
                size="sm"
                onClick={() => go(position + 1)}
                disabled={isLast}
              >
                <span>השאלה הבאה</span>
                <ChevronLeft className="ms-1.5 size-4" aria-hidden />
              </Button>
            </div>

            {/* Appears once every question is answered (see canSubmit) and
                stays after the sitting is filed, to reopen its results. */}
            {canSubmit || attempt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/20">
                <p className="text-xs text-foreground/80">
                  {attempt
                    ? `ניסיון ${attempt.attempts} נשמר · ${attempt.correct}/${attempt.total} (${attempt.score}%)`
                    : `ענית על כל ${total} השאלות. השעון נעצר.`}
                </p>
                {attempt ? (
                  // Re-opens the result rather than the solution. The score and
                  // its per-law table are what a candidate comes back to; the
                  // solution is one click further, from inside it.
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={resultsUrlFor(attempt.answer_id)} />}
                  >
                    <ClipboardCheck className="size-4" aria-hidden />
                    <span className="ms-1.5">הצג שוב את התוצאות</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <ClipboardCheck className="size-4" aria-hidden />
                    )}
                    <span className="ms-1.5">
                      {submitting ? "שולח…" : "שלח את המבחן לבדיקה"}
                    </span>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

    </div>
  );
}
