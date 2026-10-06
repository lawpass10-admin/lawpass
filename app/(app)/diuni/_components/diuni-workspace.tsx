"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
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
import {
  DIUNI_TOTAL_SECONDS,
  ExamTimerBar,
} from "@/app/(app)/mahoti/_components/exam-timer-bar";
import { NavigationGuard } from "@/components/app/navigation-guard";
import { Button } from "@/components/ui/button";
import { submitDiuniAttempt, type DiuniAttempt } from "@/lib/api/diuni";
import type { DiuniLetter, DiuniSet } from "@/lib/db/diuni";
import {
  clearSitting,
  loadAnswers,
  saveAnswers,
} from "@/lib/sittings/progress";
import { cn } from "@/lib/utils";

/**
 * Type-scale bounds for the fit-to-box pass, in px.
 *
 * Larger than /mahoti's (15/13/10) at the top: this column has the whole width
 * to itself, with no notebook beside it to stay no smaller than, so a short
 * question is set at a comfortable 17px.
 *
 * The column floor is LOWER than /mahoti's — 11px, not 13. With 13 a long diuni
 * question held its size while the options alone shrank to 10px and the fourth
 * was still cut off: the fact pattern stayed large and the answers became
 * unreadable. Letting the question and the options come down together first is
 * the better trade — the stage where the options shrink on their own now starts
 * from 11px, a step away from their 10px floor rather than three. /mahoti keeps
 * 13 because its question must not read smaller than the notebook beside it;
 * there is no notebook here.
 */
const FIT: FitBounds = { maxPx: 17, minPx: 11, answersMinPx: 10 };

/**
 * The same question on a phone.
 *
 * A 980px column at 11px has room for a fact pattern and four options; a 360px
 * one does not, and the floors above are reached while the fourth option is
 * still below the fold. `overflow-hidden` then CLIPS it — the option is not
 * merely small, it is not on the screen at all, which is how a candidate
 * answers a four-option question having seen three.
 *
 * Lower floors buy roughly two more lines, which is usually the difference.
 * The backstop for when it is not is the scroll on the box itself: see the
 * reading column's className.
 */
const FIT_NARROW: FitBounds = { maxPx: 15, minPx: 8.5, answersMinPx: 8 };

/**
 * The דין דיוני study screen.
 *
 * The question column is the exam player's layout — same progress strip, same
 * <Choice> rows, same prev/next pair — so a candidate moving between screens is
 * not re-learning the interface. Unlike /mahoti there is no notebook beside it:
 * a diuni question is answered from knowledge of procedure, so the column has
 * the width to itself.
 *
 * It does share /mahoti's fit-to-box type scaling. It used to scroll instead, on
 * the reasoning that a diuni question is short enough not to need it — but real
 * ones are not, and a scrollbar puts the fourth answer below the fold, so reading
 * the question and reading the options become two separate acts.
 *
 * The selected letters are local state. Nothing is scored in the browser — the
 * paper arrives with `correct_answer` already stripped (see lib/db/diuni.ts), and
 * the marking happens on the server when the sitting is filed.
 */
export function DiuniWorkspace({ set }: { set: DiuniSet }) {
  const router = useRouter();
  const [position, setPosition] = useState(0);
  // Position -> chosen letter. Kept in localStorage as well, so a reload or a
  // crash does not throw away a 100-minute sitting — see
  // lib/sittings/progress.ts. The server still learns nothing until submit.
  const [answers, setAnswers] = useState<Record<number, DiuniLetter>>({});
  // Nothing may be written back before the restore has run, or the empty
  // initial state would overwrite a real sitting on mount.
  const restored = useRef(false);
  // Flipped by the timer bar's "התחל בחינה". Until then the choices are inert:
  // answering a timed paper while the clock reads a full 100:00 is not a run of
  // the sitting. Browsing stays open — only committing an answer waits.
  const [examStarted, setExamStarted] = useState(false);
  // The filed sitting, once the submit has been through the server. Holding it
  // here is what stops a second click filing a second attempt for one run.
  const [attempt, setAttempt] = useState<DiuniAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fitRef = useRef<HTMLDivElement | null>(null);

  // Restore in a microtask, matching the window-token read in
  // exam/play/_components/exam-question.tsx: it keeps the setState out of the
  // effect body (react-hooks/set-state-in-effect) and defers the change past
  // the hydration tick, so the server's empty sheet and the client's first
  // render still agree.
  useEffect(() => {
    queueMicrotask(() => {
      const stored = loadAnswers("diuni", set.questionId);
      restored.current = true;
      if (stored) setAnswers(stored as Record<number, DiuniLetter>);
    });
  }, [set.questionId]);

  useEffect(() => {
    if (!restored.current) return;
    saveAnswers("diuni", set.questionId, answers);
  }, [answers, set.questionId]);

  // `position` alone was the re-fit key; the viewport has to be in it too, or
  // rotating a phone leaves the type sized for the width it no longer has.
  const narrow = useIsNarrow();
  useFitToBox(fitRef, `${position}:${narrow}`, narrow ? FIT_NARROW : FIT);

  const total = set.questions.length;
  const question = set.questions[position];
  const isFirst = position === 0;
  const isLast = position === total - 1;

  const statuses: ExamProgressCellStatus[] = set.questions.map((_, i) =>
    answers[i] ? "answered" : "pending",
  );

  const answeredCount = set.questions.reduce(
    (count, _, i) => (answers[i] ? count + 1 : count),
    0,
  );
  const allAnswered = total > 0 && answeredCount === total;
  // Sent for marking only once EVERY question has an answer — the same rule as
  // /mahoti. It used to unlock at three quarters of the paper with the rest
  // counted wrong; removed on PM request, along with the confirmation dialog
  // that guarded an early submit, since there is no longer an early submit.
  const canSubmit = allAnswered;

  function resultsUrlFor(answerId: string): string {
    return `/diuni/results?attempt=${encodeURIComponent(answerId)}`;
  }

  function go(to: number): void {
    if (to < 0 || to > total - 1) return;
    setPosition(to);
  }

  /**
   * File the sitting, then go to its results page.
   *
   * The marking is the server's: the paper arrives without `correct_answer`, so
   * this sends the letters and is told what they were worth.
   *
   * NAVIGATES RATHER THAN OPENING A DIALOG OR A TAB. The score used to be a
   * modal over the paper, which could not hold a table of up to 25 subjects,
   * and before that a tab opened ahead of the await to dodge popup blockers.
   * Both are gone: /diuni/results reads the stored sitting, so it is a normal
   * page the candidate can link to, reload and come back to.
   *
   * Answers are sent by question NUMBER, not by position: `answers` is keyed by
   * where the question sits on screen, and the two agree only for as long as
   * nothing reorders a paper.
   */
  async function handleSubmit(): Promise<void> {
    if (submitting || attempt) return;
    setSubmitting(true);

    const result = await submitDiuniAttempt(
      set.questionId,
      set.questions.map((q, i) => ({
        number: q.number,
        letter: answers[i] ?? null,
      })),
    );

    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    // Filed, so the recovery copy has done its job. Left behind it would
    // offer to resume a paper that has already been marked — and the next
    // sitting of this same paper must start from an empty sheet.
    clearSitting("diuni", set.questionId);

    // `submitting` is deliberately left true: the navigation is in flight and
    // re-enabling the button would offer a second filing of the same sitting.
    setAttempt(result.data);
    router.push(resultsUrlFor(result.data.answer_id));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Nothing about a sitting in progress is on the server — the letters
          and the clock live in this component's state, so leaving the page
          discards a 100-minute paper with no way to recover it. Until the
          sitting is filed, every exit therefore asks first. Disarms on its
          own once `attempt` is set: after marking there is nothing left to
          lose, and the candidate must be free to open the solution. */}
      <NavigationGuard
        active={examStarted && attempt === null}
        title="לצאת מהמבחן?"
        description="המבחן בעיצומו והתשובות שסימנת עדיין לא נשלחו לבדיקה. יציאה מהדף תמחק אותן ואת הזמן שנותר, ולא ניתן יהיה לשחזר אותם."
      />
      {/* 100 minutes — the length of חלק ב' of the real paper. Also frozen once
          the sitting is filed: a clock still running after the paper has been
          marked is counting nothing. */}
      <ExamTimerBar
        totalSeconds={DIUNI_TOTAL_SECONDS}
        frozen={allAnswered || attempt !== null}
        onStartedChange={setExamStarted}
        sitting={{ kind: "diuni", setId: set.questionId }}
      >
        <CheckAnsweredButton
          reviewRoute="/diuni/review"
          setId={set.questionId}
          given={set.questions.map((question, i) => ({
            number: question.number,
            letter: answers[i] ?? null,
          }))}
        />
      </ExamTimerBar>

      <div className="shrink-0 overflow-hidden rounded-lg">
        <ExamProgressStrip
          total={total}
          current={position}
          statuses={statuses}
          onJump={go}
          sticky={false}
          fit
          className="py-1.5"
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
        {/* Capped to the same measure as the reading column below, so the
            question counter and the nav row line up with the prose rather than
            drifting out to the card's edges. */}
        <div className="mx-auto flex w-full max-w-[980px] shrink-0 items-baseline justify-between gap-3 px-5 pt-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            שאלה {position + 1} / {total}
          </span>
          {!examStarted ? (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              לחצו „התחל בחינה&rdquo; כדי לענות
            </span>
          ) : null}
        </div>

        {/* No scrollbar — `useFitToBox` steps the type down until the fact
            pattern and all four options clear this box, so the whole question
            is readable in one look. `overflow-hidden` is the backstop for the
            rare question that does not fit even at the floors; the strip's
            question numbers remain the way out.

            The reading column is capped and centred rather than filling the
            card. The page is as wide as /mahoti so the progress strip can lay
            34-40 cells out in one straight row, but a fact pattern set across
            1480px runs to ~180 characters a line, which nobody reads twice.
            The strip gets the width; the prose does not. */}
        <div
          ref={fitRef}
          className={cn(
            // Scrolls on a phone, clips on a desktop. The desktop behaviour is
            // deliberate and documented above — the fit hook guarantees the
            // question fits, so a scrollbar there would be a bug made visible.
            // On a phone the floors can genuinely run out, and a reachable
            // fourth option beats a tidy box.
            "mx-auto min-h-0 w-full max-w-[980px] flex-1 overflow-y-auto px-5 py-3 md:overflow-hidden",
            styles.fit,
          )}
        >
          {/* Padding in em (styles.questionCard), so it shrinks with the type
              instead of holding ~40px of height the text could have used.

              The fact pattern and the question sentence are two blocks with a
              small gap, not one string joined by "\n\n": under
              whitespace-pre-wrap that blank line cost a full line-height at
              whatever size the text was set — the largest single gap in the
              column, and pure whitespace. */}
          <div
            className={cn(
              "rounded-lg border border-border bg-background",
              styles.questionCard,
            )}
          >
            {question.fact_pattern?.trim() ? (
              <NoCopyText dir="auto" className="leading-relaxed whitespace-pre-wrap">
                {question.fact_pattern.trim()}
              </NoCopyText>
            ) : null}
            {question.stem?.trim() ? (
              <NoCopyText
                dir="auto"
                className={cn(
                  "leading-relaxed whitespace-pre-wrap font-medium",
                  question.fact_pattern?.trim() && "mt-[0.6em]",
                )}
              >
                {question.stem.trim()}
              </NoCopyText>
            ) : null}
          </div>

          {/* Dimmed as well as disabled while the clock is unstarted: a
              <button disabled> alone gives no visual cue, and a candidate
              clicking a choice that silently does nothing reads it as a broken
              page rather than as a locked one. */}
          <div
            className={cn(
              "mt-3 flex flex-col gap-1.5 transition-opacity",
              styles.answers,
              !examStarted && "opacity-60",
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

        {/* The rule spans the whole card; its contents sit on the same 980px
            measure as everything above. */}
        <div className="shrink-0 border-t border-border">
          <div className="mx-auto w-full max-w-[980px] space-y-2 px-5 py-3">
            <div className="flex items-center justify-between gap-4">
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

            {canSubmit || attempt ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/20">
                <p className="text-xs text-foreground/80">
                  {attempt
                    ? `ניסיון ${attempt.attempts} נשמר · ${attempt.correct}/${attempt.total} (${attempt.score}%)`
                    : `ענית על כל ${total} השאלות. השעון נעצר.`}
                </p>
                {attempt ? (
                  // Re-opens the result rather than the solution. The score and
                  // its per-subject table are what a candidate comes back to;
                  // the solution is one click further, from inside it.
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
        </div>
      </section>
    </div>
  );
}
