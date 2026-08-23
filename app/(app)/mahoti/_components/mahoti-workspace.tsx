"use client";

import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { Choice } from "@/app/(app)/practice/play/_components/choice";
import {
  ExamProgressStrip,
  type ExamProgressCellStatus,
} from "@/app/(app)/exam/play/_components/exam-progress-strip";
import { Button } from "@/components/ui/button";
import type { MahotiLetter, MahotiSet } from "@/lib/db/mahoti";

import { ExamTimerBar } from "./exam-timer-bar";
import { NotebookPane } from "./notebook-pane";

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

  // One letter per question, dash-separated, in question order. Unanswered
  // positions cannot occur here (the link only renders once all are in), but
  // the review page tolerates gaps anyway.
  const answersParam = set.questions
    .map((_, i) => answers[i] ?? "")
    .join("-");

  function go(to: number): void {
    if (to < 0 || to > total - 1) return;
    setPosition(to);
  }

  return (
    <div className="space-y-4">
      <ExamTimerBar frozen={allAnswered} />

      <ExamProgressStrip
        total={total}
        current={position}
        statuses={statuses}
        onJump={go}
      />

      {/* flex-col-reverse on small screens puts the question (second in the
          DOM) above the notebook. On lg the row is laid out RTL, so the
          notebook — first in the DOM — takes the start edge, which is the
          visual RIGHT, leaving the question on the left as asked. */}
      <div className="flex flex-col-reverse gap-5 lg:flex-row lg:items-start">
        {/* An even split, not a favoured side: half the row each, with the
            gap-5 (1.25rem) taken half from each column so the two panes come
            out exactly the same width. The question column is the only
            flexible item, so it takes precisely the space this one leaves. */}
        <aside
          aria-label="מחברת החקיקה"
          className="lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)] lg:w-[calc(50%-0.625rem)] lg:shrink-0"
        >
          {/* Sibling of the question column, not a child of it, so the
              notebook's own page state survives moving between questions —
              flipping to question 3 must not throw the reader back to
              page 1. */}
          <NotebookPane notebook={set.notebook} />
        </aside>

        <section aria-label="שאלה" className="min-w-0 flex-1">
          {/* Counter only. The question's law used to sit opposite it, but
              naming the law is half the answer while the candidate is still
              working — it belongs in the review, where the references list
              already carries it. */}
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              שאלה {position + 1} / {total}
            </span>
          </div>

          {/* 16px, not the 19px this column carried at 56% width: a fact
              pattern runs long, and at half the row the larger type pushed
              the choices below the fold. Still a step above the notebook's
              13px, so the question stays the thing being read. */}
          <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <NoCopyText
              dir="auto"
              className="text-[16px] leading-relaxed whitespace-pre-wrap"
            >
              {[question.fact_pattern, question.stem]
                .filter((part) => part && part.trim())
                .join("\n\n")}
            </NoCopyText>
          </div>

          <div className="mb-6 flex flex-col gap-2">
            {question.options.map((option) => (
              <Choice
                key={option.letter}
                letter={option.letter}
                text={option.text}
                isCorrect={undefined}
                selected={answers[position] === option.letter}
                revealed={false}
                disabled={false}
                onSelect={(letter) =>
                  setAnswers((prev) => ({ ...prev, [position]: letter }))
                }
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => go(position - 1)}
              disabled={isFirst}
            >
              <ChevronRight className="size-4" aria-hidden />
              <span className="ms-1.5">שאלה קודמת</span>
            </Button>
            <Button onClick={() => go(position + 1)} disabled={isLast}>
              <span>השאלה הבאה</span>
              <ChevronLeft className="ms-1.5 size-4" aria-hidden />
            </Button>
          </div>

          {/* Appears only once every question has an answer. A plain link
              rather than a button: the review is its own page, and opening
              it in a new tab leaves this one intact — the candidate can go
              back to a question with their answers still on screen. */}
          {allAnswered ? (
            <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-50 p-4 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground/80">
                  ענית על כל {total} השאלות. השעון נעצר.
                </p>
                <Button
                  render={
                    <a
                      href={`/mahoti/review?set=${encodeURIComponent(set.questionId)}&answers=${encodeURIComponent(answersParam)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ClipboardCheck className="size-4" aria-hidden />
                  <span className="ms-1.5">שלח שאלה לבדיקה</span>
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
