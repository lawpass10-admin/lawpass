"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Letter = "א" | "ב" | "ג" | "ד";

type ChoiceProps = {
  letter: Letter;
  text: string;
  isCorrect?: boolean;
  selected: boolean;
  revealed: boolean;
  disabled: boolean;
  onSelect: (letter: Letter) => void;
};

/**
 * Single choice button. Five visual states driven by (selected, revealed,
 * isCorrect):
 *   - default       — gray border
 *   - selected only — primary tint, primary border
 *   - revealed + correct           — emerald
 *   - revealed + selected + wrong  — destructive
 *   - revealed + neither           — muted
 *
 * `isCorrect` is undefined before reveal (the page strips this from the
 * choice payload until an attempt exists, per stripAnswerFromChoices in
 * lib/db/practice.ts). After reveal — either via existing attempt or
 * via submitAttempt response — the page re-fetches the full choice
 * with is_correct populated and re-renders.
 *
 * `dir="auto"` on the text span: most choices are pure Hebrew, but legal
 * citations occasionally embed Latin (e.g. "ע"א 3506/13") — the auto
 * direction keeps mixed lines readable.
 */
export function Choice({
  letter,
  text,
  isCorrect,
  selected,
  revealed,
  disabled,
  onSelect,
}: ChoiceProps) {
  const showCorrect = revealed && isCorrect === true;
  const showWrong = revealed && selected && isCorrect === false;

  return (
    <button
      type="button"
      onClick={() => !revealed && !disabled && onSelect(letter)}
      disabled={disabled || revealed}
      aria-pressed={selected}
      className={cn(
        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-lg border px-4 py-3 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        // Default / unrevealed — Phase 9d hotfix: bg-card (white) so each
        // choice reads as its own white card on the gray page bg.
        !revealed && !selected && "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
        !revealed && selected && "border-primary bg-primary/10 font-medium",
        // Revealed states
        showCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
        showWrong && "border-destructive bg-destructive/10",
        revealed && !showCorrect && !showWrong && "border-border bg-muted/30 text-muted-foreground",
        // Disabled cursor handling
        (disabled || revealed) && "cursor-default"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
          showCorrect && "bg-emerald-500 text-white",
          showWrong && "bg-destructive text-white",
          !revealed && selected && "bg-primary text-primary-foreground",
          !revealed && !selected && "bg-muted text-muted-foreground",
          revealed && !showCorrect && !showWrong && "bg-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {letter}
      </span>
      {/* Slice 37 — copy/paste deterrent on the choice text label
          ONLY. The button element above keeps its click/focus
          handlers intact; user-select/onContextMenu on the inner
          span doesn't interfere with button activation. */}
      <span
        dir="auto"
        className="no-copy-content text-[15px] leading-relaxed"
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {text}
      </span>
      {showCorrect && (
        <Check className="size-5 text-emerald-600" aria-hidden />
      )}
      {showWrong && (
        <X className="size-5 text-destructive" aria-hidden />
      )}
      {!showCorrect && !showWrong && <span aria-hidden />}
    </button>
  );
}
