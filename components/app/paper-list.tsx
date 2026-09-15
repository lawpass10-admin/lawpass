"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The selectable list of generated papers, offered on the exam start pages
 * (/mahoti-start, /diuni-start) under the paper's general instructions.
 *
 * It began inside a picker dialog the sidebar opened; the dialog is gone —
 * instructions deserve a page — but the rows are unchanged.
 *
 * The listbox is built from buttons rather than a <select> for two reasons: a
 * paper is two lines (its name, then its size), which a native option cannot
 * show, and the rows are the main content of their section rather than a field
 * in a form. `role="radiogroup"` + `role="radio"` keeps that honest for a screen
 * reader.
 */

/**
 * What the list needs of a paper. Described structurally, so MahotiSetSummary
 * (with a law count) and DiuniSetSummary (without one) both fit without lib/db
 * importing from a component. `lawCount` is optional because a diuni paper has
 * no notebook to count laws in.
 */
export type PickerSet = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questionCount: number | null;
  lawCount?: number | null;
};

export function PaperList({
  sets,
  selected,
  onSelect,
  label,
}: {
  sets: PickerSet[];
  selected: string | null;
  onSelect: (questionId: string) => void;
  /** Accessible name for the group. */
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {sets.map((set) => (
        <PaperRow
          key={set.questionId}
          set={set}
          selected={set.questionId === selected}
          onSelect={() => onSelect(set.questionId)}
        />
      ))}
    </div>
  );
}

/**
 * One selectable paper. Selection is carried by the gold ring and the check
 * badge together — colour alone would leave the state invisible to anyone who
 * cannot separate the navy border from the gold one.
 */
function PaperRow({
  set,
  selected,
  onSelect,
}: {
  set: PickerSet;
  selected: boolean;
  onSelect: () => void;
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
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-[#C9A149] bg-[#C9A149] text-white" : "border-border bg-background"
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heebo text-sm font-semibold text-foreground">
            {set.title}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{describe(set)}</span>
        </span>
      </div>
    </button>
  );
}

/**
 * "40 שאלות · 25 חוקים · נוצר ב-14 בספטמבר 2026" — every part of which can be
 * missing (a diuni paper never has a law count, an older row may have no
 * question count), so the pieces are joined rather than templated.
 */
function describe(set: PickerSet): string {
  const parts: string[] = [];
  if (set.questionCount) parts.push(`${set.questionCount} שאלות`);
  if (set.lawCount) parts.push(`${set.lawCount} חוקים`);
  if (set.createdAt) {
    const date = new Date(set.createdAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        `נוצר ב-${date.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`
      );
    }
  }
  return parts.join(" · ");
}
