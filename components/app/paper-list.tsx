"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { loadAnswers, type SittingKind } from "@/lib/sittings/progress";
import { cn } from "@/lib/utils";

/**
 * The selectable list of generated papers, offered on the exam start pages
 * (/mahoti-start, /diuni-start) under the paper's general instructions.
 *
 * It began inside a picker dialog the sidebar opened; the dialog is gone —
 * instructions deserve a page — but the rows are unchanged.
 *
 * The listbox is built from buttons rather than a <select> because the rows are
 * the main content of their section rather than a field in a form — a bordered,
 * selectable card is not something a native option can be made to look like.
 * `role="radiogroup"` + `role="radio"` keeps that honest for a screen reader.
 */

/**
 * What the list needs of a paper. Described structurally, so MahotiSetSummary
 * and DiuniSetSummary both fit without lib/db importing from a component. Both
 * carry more than this — a question count, a law count, a creation date — and
 * the list deliberately shows none of it: see PaperRow.
 */
export type PickerSet = {
  questionId: string;
  title: string;
  /** How many times the candidate has submitted this paper. 0 or absent = never. */
  sittings?: number;
  /** Their best score across those sittings, as a percentage. */
  bestScore?: number | null;
};

export function PaperList({
  sets,
  selected,
  onSelect,
  label,
  kind,
}: {
  sets: PickerSet[];
  selected: string | null;
  onSelect: (questionId: string) => void;
  /** Accessible name for the group. */
  label: string;
  /** Which localStorage namespace to look in for unfinished sittings. */
  kind: SittingKind;
}) {
  // Which papers have an unfinished sitting in THIS browser.
  //
  // It has to be read after mount rather than during render: the server has no
  // idea what is in localStorage, so rendering a badge from it on the first
  // pass would make the client's HTML disagree with the server's. The state
  // starts empty — matching the server — and fills in once.
  const [unfinished, setUnfinished] = useState<Set<string>>(new Set());
  useEffect(() => {
    // In a microtask, matching MahotiWorkspace's restore: it keeps the setState
    // out of the effect body (react-hooks/set-state-in-effect) and defers the
    // change past the hydration tick, so the server's badge-less render and the
    // client's first render still agree.
    queueMicrotask(() => {
      const open = new Set<string>();
      for (const set of sets) {
        const saved = loadAnswers(kind, set.questionId);
        // A stored sitting with no answers in it is someone who opened the
        // paper and left. That is not progress worth advertising.
        if (saved && Object.keys(saved).length > 0) open.add(set.questionId);
      }
      setUnfinished(open);
    });
  }, [sets, kind]);

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {sets.map((set) => (
        <PaperRow
          key={set.questionId}
          set={set}
          selected={set.questionId === selected}
          onSelect={() => onSelect(set.questionId)}
          unfinished={unfinished.has(set.questionId)}
        />
      ))}
    </div>
  );
}

/**
 * The state of a paper, said once so the badge and the screen-reader text
 * cannot drift apart.
 *
 * Both markers can be true at once, and that is not a contradiction: filing a
 * sitting clears the browser copy, so a paper that is finished AND has local
 * answers is one the candidate has started again. "בתהליך" leads in that case,
 * because it is the one that tells them where they are.
 */
function Badges({ set, unfinished }: { set: PickerSet; unfinished: boolean }) {
  const sat = (set.sittings ?? 0) > 0;
  if (!sat && !unfinished) return null;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {unfinished ? (
        <span
          className="rounded-full px-2 py-0.5 font-heebo text-[11px] font-semibold"
          style={{ background: "rgba(201, 161, 73, 0.14)", color: "var(--color-gold-deep)" }}
        >
          בתהליך
        </span>
      ) : null}
      {sat ? (
        <span
          className="rounded-full px-2 py-0.5 font-heebo text-[11px] font-semibold"
          style={{ background: "rgba(30, 58, 138, 0.08)", color: "var(--color-navy-ink)" }}
        >
          {/* The best score, not the last: the row is a reason to choose this
              paper or skip it, and "my best was 85%" is what answers that.
              Rounded, because a percentage of 40 questions is never usefully
              fractional. */}
          {set.bestScore === null || set.bestScore === undefined
            ? "הושלם"
            : `הושלם · ${Math.round(set.bestScore)}%`}
          {(set.sittings ?? 0) > 1 ? ` · ${set.sittings} מועדים` : ""}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One selectable paper. Selection is carried by the gold ring and the check
 * badge together — colour alone would leave the state invisible to anyone who
 * cannot separate the navy border from the gold one.
 *
 * The name and nothing else. The row used to carry a second line —
 * "40 שאלות · 25 חוקים · נוצר ב-1 באוקטובר 2026" — from back when papers were
 * all titled "דין מהותי" and that line was the only way to tell one from
 * another. Now that they are numbered, it described what every paper has in
 * common (they are all 40 questions) and dated the authoring rather than the
 * exam, which is nothing a candidate chooses on.
 */
function PaperRow({
  set,
  selected,
  onSelect,
  unfinished,
}: {
  set: PickerSet;
  selected: boolean;
  onSelect: () => void;
  unfinished: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-xl border p-3.5 text-start transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A149]/50",
        selected
          ? "border-[#C9A149] bg-[#C9A149]/[0.07] shadow-sm"
          : "border-border bg-card hover:border-[#1E3A8A]/30 hover:bg-muted/50"
      )}
    >
      {/* items-center, not items-start: the row is one line now, so the badge
          sits beside the name rather than aligned to the first of two. */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-[#C9A149] bg-[#C9A149] text-white" : "border-border bg-background"
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate font-heebo text-sm font-semibold text-foreground">
          {set.title}
        </span>
        <Badges set={set} unfinished={unfinished} />
      </div>
    </button>
  );
}
