"use client";

import { Check } from "lucide-react";

import { ChapterIcon } from "@/app/(app)/dashboard/_components/chapter-icon";
import type {
  ChapterRow,
  SubtopicRow,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P3 — Chapter panel.
 *
 * Hosts the 2×3 chapter card grid plus the inline subtopics chips. The
 * subtopics block lives INSIDE the same panel (separated by a dashed
 * border) so the "narrow the practice scope" flow reads as one
 * step — matches the prototype's `PracticeBuilder.html` structure.
 *
 * State + actions come from `usePracticeBuilder` and are passed in;
 * this panel is purely presentational so the rebuilt visuals never
 * fight the existing state machine.
 *
 * Single-select-subtopic note: the design hints multi-select chips,
 * but the underlying builder state is single (`rawSubtopicId: string |
 * null`). For Phase P3 we honour that contract — only one chip can be
 * active at a time, plus the "הכל" toggle which clears the selection.
 * If multi-select is wanted, that's a separate refactor across hook +
 * server action + DB write.
 */

type Props = {
  chapters: ChapterRow[];
  selectedChapterIds: string[];
  onToggleChapter: (id: string) => void;

  subtopicsForSelected: SubtopicRow[];
  effectiveSubtopicId: string | null;
  onSelectSubtopic: (id: string | null) => void;
};

export function ChapterPanel({
  chapters,
  selectedChapterIds,
  onToggleChapter,
  subtopicsForSelected,
  effectiveSubtopicId,
  onSelectSubtopic,
}: Props) {
  // Subtopic strip only renders when EXACTLY one chapter is selected
  // (per the §C8 clarification — multi-chapter sessions can't scope
  // to a subtopic because subtopics belong to a single chapter).
  const showSubtopics =
    selectedChapterIds.length === 1 && subtopicsForSelected.length > 0;
  const singleSelectedChapter =
    selectedChapterIds.length === 1
      ? chapters.find((c) => c.id === selectedChapterIds[0]) ?? null
      : null;

  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "24px 26px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="flex items-start justify-between gap-4 mb-[18px]">
        <div>
          <h2
            className="font-heebo font-bold flex items-center gap-2.5"
            style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
          >
            <span
              aria-hidden
              className="inline-flex items-center justify-center font-heebo font-bold"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "var(--color-gold-tint)",
                color: "var(--color-gold-deep)",
                fontSize: 13,
              }}
            >
              1
            </span>
            פרקים
          </h2>
          <p
            className="font-heebo font-normal mt-1"
            style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
          >
            בחר אחד או יותר. נושאים בלי שאלות זמינות יוצגו כמעומעמים.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {chapters.map((chapter) => {
          const selected = selectedChapterIds.includes(chapter.id);
          const empty = chapter.activeQuestionCount === 0;
          return (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              selected={selected}
              disabled={empty}
              onToggle={() => {
                if (empty) return;
                onToggleChapter(chapter.id);
              }}
            />
          );
        })}
      </div>

      {showSubtopics && (
        <div
          className="mt-[22px] pt-[18px]"
          style={{ borderTop: "1px dashed var(--color-line)" }}
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
        </div>
      )}
    </section>
  );
}

// =============================================================================
// ChapterCard
// =============================================================================

function ChapterCard({
  chapter,
  selected,
  disabled,
  onToggle,
}: {
  chapter: ChapterRow;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const numberPrefix = String(chapter.display_order).padStart(2, "0");
  const metaText = disabled
    ? "בקרוב · אין שאלות זמינות"
    : `${chapter.activeQuestionCount.toLocaleString("he-IL")} שאלות זמינות`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={disabled ? "פרק זה יופעל בקרוב" : undefined}
      className={cn(
        "group flex items-center gap-3 text-start transition-all font-heebo",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        !disabled && "hover:-translate-y-px",
        disabled && "cursor-not-allowed"
      )}
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: disabled
          ? "#F4F2EC"
          : selected
            ? "var(--card)"
            : "var(--color-paper)",
        border: disabled
          ? "1.5px dashed var(--color-line)"
          : selected
            ? "1.5px solid var(--color-navy)"
            : "1.5px solid var(--color-line)",
        boxShadow: selected ? "0 0 0 3px rgba(30, 58, 138, 0.08)" : "none",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center shrink-0 transition-colors",
          !disabled && "group-hover:shadow-sm"
        )}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: selected ? "var(--color-navy-ink)" : "var(--card)",
          border: selected
            ? "1px solid var(--color-navy-ink)"
            : "1px solid var(--color-line)",
          color: selected ? "var(--color-gold)" : "var(--color-ink-dim)",
        }}
        aria-hidden
      >
        <ChapterIcon code={chapter.code} />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block font-heebo font-bold"
          style={{
            fontSize: 11,
            color: "var(--color-ink-muted)",
            letterSpacing: "0.06em",
            lineHeight: 1,
          }}
        >
          {numberPrefix}
        </span>
        <span
          className="block font-heebo font-semibold mt-0.5"
          style={{
            fontSize: 14.5,
            color: "var(--color-navy-ink)",
            lineHeight: 1.2,
          }}
        >
          {chapter.title}
        </span>
        <span
          className="block mt-0.5"
          style={{ fontSize: 11.5, color: "var(--color-ink-muted)" }}
        >
          {metaText}
        </span>
      </span>
      <span
        className="inline-flex items-center justify-center shrink-0 transition-all"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: selected ? "var(--color-navy)" : "transparent",
          border: selected
            ? "1.5px solid var(--color-navy)"
            : "1.5px solid var(--color-line-strong)",
        }}
        aria-hidden
      >
        <Check
          className="size-3 transition-opacity"
          style={{
            color: "var(--color-white, #FFFFFF)",
            opacity: selected ? 1 : 0,
          }}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}

// =============================================================================
// SubtopicChip
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
