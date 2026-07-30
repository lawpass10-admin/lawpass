"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createExamSession } from "@/app/(app)/exam/_actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ExamMode } from "@/lib/exam/clusters";
import { cn } from "@/lib/utils";

import { IntroHero, IntroStatsAndBox } from "./intro-content";

/**
 * Fresh-user entry point at `/exam`. Renders the mode picker, the shared
 * IntroContent (mode-aware) and the two-button footer. "התחל בחינה"
 * fires createExamSession with the selected mode; on success we navigate
 * to the play URL via window.location.assign (same pattern as
 * createPracticeSession in Slice 2).
 *
 * Slice 9 — three modes (procedural / substantive / combined). The
 * picker defaults to procedural; PM decision is no "last mode used"
 * preference, so every fresh visit starts at the same default.
 *
 * Sidebar is hidden across the whole /exam/* subtree at the layout
 * level — see app/(app)/layout.tsx (Phase 0). This page therefore
 * renders full-bleed.
 */
export function ExamIntro() {
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<ExamMode>("procedural");

  function handleStart() {
    if (submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      const result = await createExamSession({ mode });
      if (!result.ok) {
        toast.error(
          result.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setSubmitting(false);
        return;
      }
      // Stash the window token before navigation — the play page reads
      // it on mount to validate against the row's active_window_token.
      // Key includes the session id so each exam has its own slot;
      // Phase 5's claim flow uses the same key.
      try {
        window.localStorage.setItem(
          `lawpass.exam.${result.sessionId}.windowToken`,
          result.windowToken
        );
      } catch {
        // Private-browsing / quota — Phase 3 falls back to running
        // without the guard. Phase 5 hardens this path.
      }
      // Cross-segment navigation matches Slice 2's convention.
      window.location.assign(result.url);
    });
  }

  return (
    <>
      {/* Slice 33 — vertical order is hero → mode picker → stats+box →
          footer buttons. The picker was previously above the hero;
          PM wanted it to sit just under the title so the user reads
          "40 שאלות. 100 דקות." first, then chooses the mode against
          that frame, then sees the KPI breakdown. Picker keeps its
          radiogroup semantics and grid-cols-1 sm:grid-cols-3 layout. */}
      <IntroHero mode={mode} />
      {/* Slice 33.1 — comfortable gap between the hero subline and the
          ModePicker (~24px). Mobile is already tight enough; keep mt-6
          across breakpoints. */}
      <div className="mx-auto mt-6 w-full max-w-3xl space-y-4">
        <ModePicker mode={mode} onChange={setMode} disabled={submitting} />
      </div>
      {/* Slice 33.1 — notably larger gap on md+ between the picker and
          the KPI grid so the two card rows don't crowd each other on
          desktop. Mobile keeps the smaller mt-6 since the single-column
          stack already feels relaxed at narrow widths. */}
      <div className="mt-6 md:mt-10">
        <IntroStatsAndBox />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-2 pb-10 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost" }), "sm:min-w-32")}
        >
          חזרה
        </Link>
        <Button
          size="lg"
          onClick={handleStart}
          disabled={submitting || isPending}
          className="sm:min-w-44"
        >
          <span>{submitting ? "יוצר סימולציה..." : "התחל בחינה"}</span>
          {!submitting && <Play className="ms-2 size-4" aria-hidden />}
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mode picker — 3 cards
// ---------------------------------------------------------------------------

type ModeCard = {
  mode: ExamMode;
  title: string;
  blurb: string;
};

const MODE_CARDS: readonly ModeCard[] = [
  {
    mode: "procedural",
    title: "דיוני בלבד",
    blurb: "40 שאלות מאשכולות א/ב/ג — סדרי דין, ראיות, חוקתי, הוצאה לפועל.",
  },
  {
    mode: "substantive",
    title: "מהותי בלבד",
    blurb: "40 שאלות מתחומי הדין המהותי — חוזים, קניין, חברות, נזיקין ועוד.",
  },
  {
    mode: "combined",
    title: "משולב",
    blurb: "20 דיוני + 20 מהותי. כיסוי רחב יותר בסימולציה אחת.",
  },
];

/**
 * Radio-like card group. Each card is a button with `aria-pressed`;
 * keyboard arrow-key navigation falls out of native focus order (the
 * group is a `<div role="radiogroup">` but the cards are buttons rather
 * than radios so the Tailwind variant utilities work cleanly — same
 * tradeoff as <PlanCard /> in the pricing screen).
 */
function ModePicker({
  mode,
  onChange,
  disabled,
}: {
  mode: ExamMode;
  onChange: (next: ExamMode) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="בחר מצב סימולציה"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {MODE_CARDS.map((card) => {
        const selected = card.mode === mode;
        return (
          <button
            key={card.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (disabled) return;
              if (card.mode !== mode) onChange(card.mode);
            }}
            disabled={disabled}
            className={cn(
              "flex flex-col gap-1 rounded-xl border p-4 text-start transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <span className="text-sm font-semibold">{card.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {card.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
