"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { Choice } from "@/app/(app)/practice/play/_components/choice";
import {
  ExamProgressStrip,
  type ExamProgressCellStatus,
} from "@/app/(app)/exam/play/_components/exam-progress-strip";
import {
  DIUNI_TOTAL_SECONDS,
  ExamTimerBar,
} from "@/app/(app)/mahoti/_components/exam-timer-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitDiuniAttempt, type DiuniAttempt } from "@/lib/api/diuni";
import type { DiuniLetter, DiuniSet } from "@/lib/db/diuni";
import { cn } from "@/lib/utils";

/**
 * How many answers unlock "שלח את המבחן לבדיקה" before the paper is finished.
 *
 * Three quarters of the paper, matching the rule /mahoti uses (30 of 40): a
 * candidate who has answered that much has done enough for the marking to be
 * worth reading, and waiting for the last question turns a useful review into
 * an all-or-nothing one. The unanswered questions still count against the score.
 */
const SUBMIT_UNLOCK_FRACTION = 0.75;

/**
 * The דין דיוני study screen.
 *
 * The question column is the exam player's layout — same progress strip, same
 * <Choice> rows, same prev/next pair — so a candidate moving between screens is
 * not re-learning the interface. Unlike /mahoti there is no notebook beside it:
 * a diuni question is answered from knowledge of procedure, so the column has
 * the width to itself and the fit-to-box type shrinking that screen needs is
 * unnecessary here.
 *
 * The selected letters are local state. Nothing is scored in the browser — the
 * paper arrives with `correct_answer` already stripped (see lib/db/diuni.ts), and
 * the marking happens on the server when the sitting is filed.
 */
export function DiuniWorkspace({ set }: { set: DiuniSet }) {
  const [position, setPosition] = useState(0);
  // Position -> chosen letter.
  const [answers, setAnswers] = useState<Record<number, DiuniLetter>>({});
  // Flipped by the timer bar's "התחל בחינה". Until then the choices are inert:
  // answering a timed paper while the clock reads a full 100:00 is not a run of
  // the sitting. Browsing stays open — only committing an answer waits.
  const [examStarted, setExamStarted] = useState(false);
  // The filed sitting, once the submit has been through the server. Holding it
  // here is what stops a second click filing a second attempt for one run.
  const [attempt, setAttempt] = useState<DiuniAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
  const unanswered = total - answeredCount;
  const allAnswered = total > 0 && answeredCount === total;
  const unlockAt = Math.max(1, Math.ceil(total * SUBMIT_UNLOCK_FRACTION));
  const canSubmit = total > 0 && answeredCount >= Math.min(unlockAt, total);

  function reviewUrlFor(answerId: string): string {
    return `/diuni/review?attempt=${encodeURIComponent(answerId)}`;
  }

  function go(to: number): void {
    if (to < 0 || to > total - 1) return;
    setPosition(to);
  }

  /**
   * File the sitting, then open its review.
   *
   * The marking is the server's: the paper arrives without `correct_answer`, so
   * this sends the letters and is told what they were worth. The tab is opened
   * BEFORE the await, empty, and pointed at the review afterwards — a tab opened
   * after an await is no longer attributable to the click and popup blockers eat
   * it.
   *
   * Answers are sent by question NUMBER, not by position: `answers` is keyed by
   * where the question sits on screen, and the two agree only for as long as
   * nothing reorders a paper.
   */
  async function handleSubmit(): Promise<void> {
    if (submitting || attempt) return;
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setSubmitting(true);

    const result = await submitDiuniAttempt(
      set.questionId,
      set.questions.map((q, i) => ({
        number: q.number,
        letter: answers[i] ?? null,
      })),
    );
    setSubmitting(false);

    if (!result.ok) {
      tab?.close();
      toast.error(result.error);
      return;
    }

    setAttempt(result.data);
    // Built from the response rather than from state: setAttempt has not been
    // applied yet at this point in the same tick.
    const url = reviewUrlFor(result.data.answer_id);
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* 100 minutes — the length of חלק ב' of the real paper. Also frozen once
          the sitting is filed: a clock still running after the paper has been
          marked is counting nothing. */}
      <ExamTimerBar
        totalSeconds={DIUNI_TOTAL_SECONDS}
        frozen={allAnswered || attempt !== null}
        onStartedChange={setExamStarted}
      />

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

        {/* The one scrolling region on the screen. A diuni fact pattern is
            shorter than a mahoti one and has the full width, so it fits without
            the type-shrinking pass /mahoti needs — and where a very long one
            does not, scrolling the column is better than shrinking the four
            answers the candidate is comparing. */}
        {/* The reading column is capped and centred rather than filling the
            card. The page is as wide as /mahoti so the progress strip can lay
            34-40 cells out in one straight row, but a fact pattern set across
            1480px runs to ~180 characters a line, which nobody reads twice.
            The strip gets the width; the prose does not. */}
        <div className="mx-auto min-h-0 w-full max-w-[980px] flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-border bg-background p-5">
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
              clicking a choice that silently does nothing reads it as a broken
              page rather than as a locked one. */}
          <div
            className={cn(
              "mt-4 flex flex-col gap-2 transition-opacity",
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

            {canSubmit ? (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2",
                  // Amber while questions are still open: the bar is an offer,
                  // not the finish line, and green would read as "done".
                  allAnswered || attempt
                    ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20"
                    : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
                )}
              >
                <p className="text-xs text-foreground/80">
                  {attempt
                    ? `ניסיון ${attempt.attempts} נשמר · ${attempt.correct}/${attempt.total} (${attempt.score}%)`
                    : allAnswered
                      ? `ענית על כל ${total} השאלות. השעון נעצר.`
                      : `ענית על ${answeredCount} מתוך ${total} שאלות. אפשר לשלוח לבדיקה עכשיו — ${unanswered} שאלות שלא נענו ייחשבו כשגויות.`}
                </p>
                {attempt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a
                        href={reviewUrlFor(attempt.answer_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ClipboardCheck className="size-4" aria-hidden />
                    <span className="ms-1.5">פתח שוב את הבדיקה</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      unanswered > 0 ? setConfirmOpen(true) : handleSubmit()
                    }
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>לשלוח את המבחן עכשיו?</DialogTitle>
            <DialogDescription>
              ענית על {answeredCount} מתוך {total} שאלות. {unanswered} שאלות
              שנשארו ללא מענה ייחשבו כשגויות בציון. אפשר גם להמשיך לענות ולשלוח
              בסוף — ואפשר לגשת למבחן הזה שוב בכל עת.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              המשך לענות
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                void handleSubmit();
              }}
            >
              שלח לבדיקה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
