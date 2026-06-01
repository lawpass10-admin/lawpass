"use client";

import type {
  ChapterRow,
  SubtopicRow,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 34 — extracted from `chapter-panel.tsx` so the practice
 * builder's left column can stack `<CountsPanel>` → `<TimerPanel>` →
 * `<SubtopicsPanel>` on desktop and the same vertical order on
 * mobile. The "sub-topics belong to a single chapter" gating still
 * lives at the form level (the form simply doesn't render this panel
 * when more than one chapter is selected); the hook's existing
 * outputs (`subtopicsForSelected`, `effectiveSubtopicId`,
 * `setRawSubtopicId`) feed in unchanged.
 *
 * Single-select-subtopic note (kept from the original): the design
 * hints multi-select chips, but the underlying builder state is
 * single (`rawSubtopicId: string | null`). We honour that contract —
 * only one chip can be active at a time, plus the "הכל" toggle which
 * clears the selection.
 */

type Props = {
  subtopicsForSelected: SubtopicRow[];
  effectiveSubtopicId: string | null;
  onSelectSubtopic: (id: string | null) => void;
  singleSelectedChapter: ChapterRow | null;
};

export function SubtopicsPanel({
  subtopicsForSelected,
  effectiveSubtopicId,
  onSelectSubtopic,
  singleSelectedChapter,
}: Props) {
  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "22px 24px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <span
          className="font-heebo font-semibold"
          style={{ fontSize: 14, color: "var(--color-ink-dim)" }}
        >
          תת-נושאים
          {singleSelectedChapter && (
            <>
              {" · "}
              <span style={{ color: "var(--color-navy-ink)" }}>
                {singleSelectedChapter.title}
              </span>
            </>
          )}
        </span>
        {effectiveSubtopicId !== null && (
          <button
            type="button"
            onClick={() => onSelectSubtopic(null)}
            className="font-heebo font-semibold transition-colors hover:underline"
            style={{ fontSize: 12.5, color: "var(--color-gold-deep)" }}
          >
            איפוס
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <SubtopicChip
          label="הכל"
          variant="all"
          active={effectiveSubtopicId === null}
          onClick={() => onSelectSubtopic(null)}
        />
        {subtopicsForSelected.map((s) => (
          <SubtopicChip
            key={s.id}
            label={s.title}
            variant="default"
            active={effectiveSubtopicId === s.id}
            onClick={() => onSelectSubtopic(s.id)}
          />
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// SubtopicChip — lifted verbatim from the original chapter-panel block.
// =============================================================================

function SubtopicChip({
  label,
  variant,
  active,
  onClick,
}: {
  label: string;
  variant: "default" | "all";
  active: boolean;
  onClick: () => void;
}) {
  if (variant === "all") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "font-heebo font-bold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
        style={{
          padding: "7px 14px",
          borderRadius: 999,
          fontSize: 13,
          background: active ? "var(--color-gold)" : "var(--color-gold-tint)",
          color: "var(--color-navy-ink)",
          border: active
            ? "1px solid var(--color-gold)"
            : "1px solid rgba(201, 161, 73, 0.45)",
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "font-heebo font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        !active && "hover:border-[var(--color-navy)] hover:text-[var(--color-navy-ink)]"
      )}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        fontSize: 13,
        background: active ? "var(--color-navy-ink)" : "var(--color-paper)",
        color: active ? "var(--color-white, #FFFFFF)" : "var(--color-ink-dim)",
        border: active
          ? "1px solid var(--color-navy-ink)"
          : "1px solid var(--color-line)",
      }}
    >
      {label}
    </button>
  );
}
