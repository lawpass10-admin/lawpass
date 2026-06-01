/**
 * Slice 21 — shared per-choice review row used by both the
 * exam-results page (`/exam/results/[id]`) and the practice-summary
 * page (`/practice/summary`). Extracted verbatim from
 * `app/(app)/exam/results/_components/exam-results.tsx:495-560`.
 *
 * Indicator conventions per choice (unchanged from the exam-side
 * original):
 *   - correct         → green ✓ accent (status-strong tokens)
 *   - selected wrong  → red ✗ accent (status-weak tokens)
 *   - other wrong     → neutral (no accent)
 *
 * Slice 19 — adds an always-visible "סימנת" pill on the choice the
 * user actually picked (`isUserPick`), LAYERED on top of the existing
 * green/red tone rather than replacing it. On a CORRECT pick the user
 * couldn't otherwise tell their selection from the system-rendered
 * correct answer.
 *
 * When `selectedLetter` is null (skipped or unanswered) no pill
 * renders anywhere.
 */

"use client";

import { Check, X } from "lucide-react";

import type { Choice } from "@/lib/db/practice";
import { cn } from "@/lib/utils";

type Letter = Choice["letter"];

export type ChoiceAnalysisRowProps = {
  choice: Choice;
  selectedLetter: Letter | null;
};

export function ChoiceAnalysisRow({
  choice,
  selectedLetter,
}: ChoiceAnalysisRowProps) {
  const isUserPick = selectedLetter !== null && choice.letter === selectedLetter;
  const isWrongPick = isUserPick && !choice.is_correct;

  let toneClasses: string;
  let icon: React.ReactNode;
  if (choice.is_correct) {
    toneClasses =
      "border-[color:var(--color-status-strong)]/40 bg-[var(--color-status-strong-bg)] text-[var(--color-status-strong)]";
    icon = <Check className="size-3.5" aria-hidden />;
  } else if (isWrongPick) {
    toneClasses =
      "border-[color:var(--color-status-weak)]/40 bg-[var(--color-status-weak-bg)] text-[var(--color-status-weak)]";
    icon = <X className="size-3.5" aria-hidden />;
  } else {
    toneClasses = "border-border bg-card text-muted-foreground";
    icon = null;
  }

  return (
    /* Slice 37 — copy/paste deterrent. The row's choice text + the
       distractor analysis at the bottom are blocked here at the
       shared seam, covering exam-results / practice-summary / notes
       bank in one place. The "סימנת" pill + icon (UI metadata) ride
       the same container, which is fine — they have no copy-worthy
       text payload. */
    <div
      className={cn(
        "no-copy-content",
        "rounded-md border p-3 text-sm leading-relaxed",
        toneClasses
      )}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
            choice.is_correct && "bg-[var(--color-status-strong)] text-white",
            isWrongPick && "bg-[var(--color-status-weak)] text-white",
            !choice.is_correct && !isWrongPick && "bg-muted"
          )}
          aria-hidden
        >
          {choice.letter}
        </span>
        <span dir="auto" className="flex-1 text-foreground">
          {choice.choice_text}
        </span>
        {isUserPick ? (
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-semibold",
              "border border-current/40"
            )}
          >
            סימנת
          </span>
        ) : null}
        {icon !== null ? (
          <span className="mt-0.5 shrink-0">{icon}</span>
        ) : null}
      </div>
      {choice.distractor_analysis ? (
        <p
          dir="auto"
          className="mt-2 whitespace-pre-wrap pe-7 text-[13px] text-foreground/80"
        >
          {choice.distractor_analysis}
        </p>
      ) : null}
    </div>
  );
}
