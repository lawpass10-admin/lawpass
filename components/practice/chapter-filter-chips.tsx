"use client";

import { cn } from "@/lib/utils";

export type ChapterChip = {
  id: string;
  title: string;
  count: number;
};

type Props = {
  chapters: ChapterChip[];
  totalCount: number;
  active: string | null;
  onChange: (chapterId: string | null) => void;
};

/**
 * Horizontal row of filter chips for the bookmarks/mistakes lists.
 *  - First chip = "הכל ({totalCount})", maps to null active state.
 *  - One chip per chapter that has ≥1 item in scope.
 *
 * Pure client state — the underlying list rows already arrived via the
 * Server Component; the active filter just narrows what's rendered.
 * Counts are server-computed and frozen until the next navigation
 * (per Phase 5 spec: chip counts may drift if the user removes items,
 * acceptable trade-off).
 */
export function ChapterFilterChips({
  chapters,
  totalCount,
  active,
  onChange,
}: Props) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible">
      <Chip active={active === null} onClick={() => onChange(null)}>
        הכל ({totalCount})
      </Chip>
      {chapters.map((ch) => (
        <Chip
          key={ch.id}
          active={active === ch.id}
          onClick={() => onChange(ch.id)}
        >
          <span dir="auto">
            {ch.title} ({ch.count})
          </span>
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}
