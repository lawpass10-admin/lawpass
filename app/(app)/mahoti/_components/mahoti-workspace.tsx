"use client";

import { ChevronLeft, ChevronRight, ClipboardCheck, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { Choice } from "@/app/(app)/practice/play/_components/choice";
import {
  ExamProgressStrip,
  type ExamProgressCellStatus,
} from "@/app/(app)/exam/play/_components/exam-progress-strip";
import { Button } from "@/components/ui/button";
import { submitMahotiAttempt, type MahotiAttempt } from "@/lib/api/mahoti";
import type { MahotiLetter, MahotiSet } from "@/lib/db/mahoti";
import { cn } from "@/lib/utils";

import { ExamTimerBar } from "./exam-timer-bar";
import { NotebookPane } from "./notebook-pane";
import styles from "./question-fit.module.css";

/** Type-scale bounds for the fit-to-box pass, in px. 15 is the size the
 *  column was designed at; 13 is the floor for the column as a whole,
 *  matching the notebook opposite it — the question is the thing being read,
 *  so it must never end up smaller than the reference material beside it. */
const FIT_MAX_FONT_PX = 15;
const FIT_MIN_FONT_PX = 13;
/** Floor for the options once the question has stopped shrinking. Below 10px
 *  Heebo stops being comfortably readable, and a question whose options only
 *  fit at 9px is one the layout genuinely cannot hold. */
const ANSWER_MIN_FONT_PX = 10;
const FIT_STEP_PX = 0.5;

/**
 * Shrinks the question column's type until the fact pattern and all four
 * options clear the box, so the candidate never has to scroll to see an
 * answer they are choosing between.
 *
 * Two stages. First the whole column steps down together, 15px to 13px. If
 * that still overflows, the fact pattern holds at 13px and only the options
 * keep shrinking — a long fact pattern is read once, while the four options
 * are what the candidate compares against each other, and all four visible
 * a size smaller beats three visible at full size.
 *
 * Writes the size straight to the DOM as a custom property rather than
 * holding it in React state: this is a measure-then-paint loop, and a
 * `setState` in an effect would both re-render the tree for a value only CSS
 * consumes and trip React 19's `set-state-in-effect` rule.
 *
 * The ResizeObserver watches the box, whose own border box is fixed by the
 * flex parent — changing the font size inside it moves `scrollHeight`, never
 * the observed size — so the loop cannot feed itself.
 */
function useFitToBox(ref: React.RefObject<HTMLDivElement | null>, key: unknown) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;

    let frame = 0;
    function fit(): void {
      if (!box) return;
      const overflows = () => box.scrollHeight > box.clientHeight;

      // Stage 1 — the column steps down as a whole. Starts from the top of
      // the range every pass, so a short question gets the full size back.
      let question = FIT_MAX_FONT_PX;
      box.style.setProperty("--mahoti-q-font", `${question}px`);
      box.style.removeProperty("--mahoti-a-font");
      while (question > FIT_MIN_FONT_PX && overflows()) {
        question -= FIT_STEP_PX;
        box.style.setProperty("--mahoti-q-font", `${question}px`);
      }
      if (!overflows()) return;

      // Stage 2 — the question is at its floor; the options give way alone.
      let answers = question;
      while (answers > ANSWER_MIN_FONT_PX && overflows()) {
        answers -= FIT_STEP_PX;
        box.style.setProperty("--mahoti-a-font", `${answers}px`);
      }
    }
    function schedule(): void {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(box);

    // The first pass can land before Heebo has swapped in, and fallback
    // metrics measure short — the text would overflow the moment the real
    // font arrived. A ResizeObserver never sees that: the swap moves
    // scrollHeight, not the box. `fonts.ready` is the signal that does.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, key]);
}

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
  const [position, setPosition] = useState(0);
  // Position -> chosen letter. Local only; nothing is persisted.
  const [answers, setAnswers] = useState<Record<number, MahotiLetter>>({});
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

  const total = set.questions.length;
  const question = set.questions[position];
  const isFirst = position === 0;
  const isLast = position === total - 1;

  const statuses: ExamProgressCellStatus[] = set.questions.map((_, i) =>
    answers[i] ? "answered" : "pending"
  );

  // "Answered the last question" is read as "nothing is left unanswered".
  // Taken literally — position === total - 1 — a candidate who jumped to the
  // last question first would stop their own clock with five questions still
  // open. Answering them in order lands on the same moment either way.
  const allAnswered =
    total > 0 && set.questions.every((_, i) => Boolean(answers[i]));

  // The review is addressed by the FILED sitting, not by the letters: it then
  // shows the score that is in the table rather than one it worked out again
  // from a URL, and matches answers to questions by number rather than by
  // position. There is no link to it before the submit has been through the
  // server, because until then there is no sitting to point at.
  function reviewUrlFor(answerId: string): string {
    return `/mahoti/review?attempt=${encodeURIComponent(answerId)}`;
  }

  function go(to: number): void {
    if (to < 0 || to > total - 1) return;
    setPosition(to);
  }

  /**
   * File the sitting, then open its review.
   *
   * The marking is the server's: the paper arrives here without
   * `correct_answer` (lib/db/mahoti.ts strips it), so this sends the letters
   * and is told what they were worth. The review tab is then opened on the row
   * that was just written, which is what makes the score on screen and the
   * score in the table the same number rather than two calculations of it.
   *
   * The tab is opened BEFORE the await, empty, and pointed at the review
   * afterwards. A tab opened after an await is no longer attributable to the
   * click and popup blockers eat it.
   *
   * Answers are sent by question NUMBER, not by position: `answers` is keyed by
   * where the question sits on screen, and the two agree only for as long as
   * nothing ever reorders a paper.
   */
  async function handleSubmit(): Promise<void> {
    if (submitting || attempt) return;
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setSubmitting(true);

    const result = await submitMahotiAttempt(
      set.questionId,
      set.questions.map((question, i) => ({
        number: question.number,
        letter: answers[i] ?? null,
      }))
    );
    setSubmitting(false);

    if (!result.ok) {
      // Nothing was filed, so leaving an empty tab open would be a second
      // thing gone wrong on screen.
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

  // Re-fit whenever the question changes: the next fact pattern is a
  // different length, so the size that fit the last one means nothing.
  useFitToBox(fitRef, position);

  return (
    // The whole screen is one non-scrolling column: the page itself never
    // grows a scrollbar, and each pane scrolls inside its own box instead.
    // That is what keeps the notebook's scrollbar, the prev/next pair and
    // the submit bar all on screen at once, whatever the paper's length.
    <div className="flex h-full min-h-0 flex-col gap-2">
      <ExamTimerBar frozen={allAnswered} onStartedChange={setExamStarted} />

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
          className="min-h-0 shrink-0 basis-[40%] lg:h-full lg:w-[calc(50%-0.5rem)] lg:basis-auto"
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

          {/* No scrollbar by design — `useFitToBox` above steps the type down
              until the fact pattern and all four options clear this box, so
              the whole question is readable in one look. `overflow-hidden` is
              the backstop for the case where even the 13px floor is not
              enough; the strip's question numbers remain the way out. */}
          <div
            ref={fitRef}
            className={cn("min-h-0 flex-1 overflow-hidden", styles.fit)}
          >
            {/* Sized by --mahoti-q-font, not a fixed value: at half the row a
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

            {/* Appears only once every question has an answer. The review
                opens in a new tab so this one stays intact — the candidate can
                go back to a question with their answers still on screen. */}
            {allAnswered ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/20">
                <p className="text-xs text-foreground/80">
                  {attempt
                    ? `ניסיון ${attempt.attempts} נשמר · ${attempt.correct}/${attempt.total} (${attempt.score}%)`
                    : `ענית על כל ${total} השאלות. השעון נעצר.`}
                </p>
                {attempt ? (
                  <Button
                    size="sm"
                    variant="outline"
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
                  <Button size="sm" onClick={handleSubmit} disabled={submitting}>
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
