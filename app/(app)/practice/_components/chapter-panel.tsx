"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { ChapterIcon } from "@/app/(app)/dashboard/_components/chapter-icon";
import type {
  ChapterRow,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P3 — Chapter panel.
 * Slice 34 — added the "בחר הכל" / "נקה בחירה" header action and
 *   moved the sub-topics block out into `<SubtopicsPanel>`.
 * Slice 35:
 *   - The full-collapse behavior from Slice 34 is gone. The chapters
 *     grid is VISIBLE by default; only the overflow past 3 rows is
 *     hidden until the user toggles "הצג הכל".
 *   - "3 rows" is computed against the responsive grid:
 *       mobile (1 col) → 3 cards visible (indices 0–2)
 *       desktop (2 col, md+) → 6 cards visible (indices 0–5)
 *     Implemented purely via Tailwind responsive visibility on each
 *     card so the SSR markup is correct at both breakpoints with no
 *     hydration flash (`hidden md:flex` for indices 3–5 when
 *     collapsed; `hidden` for indices ≥6).
 *   - The toggle styling mirrors the dashboard mastery-card "הצג עוד"
 *     pattern: dashed full-width button, chevron flip on state,
 *     label "הצג הכל ({chapters.length})" → "הצג פחות".
 */

type Props = {
  chapters: ChapterRow[];
  selectedChapterIds: string[];
  onToggleChapter: (id: string) => void;
  onSelectAllChapters: () => void;
  onClearAllChapters: () => void;
};

// Slice 35 — `INITIAL_DESKTOP_VISIBLE` = 3 rows × 2 cols at md+;
// `INITIAL_MOBILE_VISIBLE` = 3 rows × 1 col on mobile. Cards at
// indices in [INITIAL_MOBILE_VISIBLE, INITIAL_DESKTOP_VISIBLE) hide
// on mobile only when collapsed; cards at indices ≥ INITIAL_DESKTOP_VISIBLE
// hide at all breakpoints when collapsed.
const INITIAL_MOBILE_VISIBLE = 3;
const INITIAL_DESKTOP_VISIBLE = 6;

export function ChapterPanel({
  chapters,
  selectedChapterIds,
  onToggleChapter,
  onSelectAllChapters,
  onClearAllChapters,
}: Props) {
  // Slice 35 — collapse state controls only the overflow rows; the
  // first ~3 rows are always visible. Default collapsed.
  const [showAllChapters, setShowAllChapters] = useState(false);

  // "בחר הכל" toggle semantics: when every selectable chapter is
  // currently selected, the button switches to "נקה בחירה". Disabled
  // ("בקרוב") chapters are excluded from both the target set and the
  // "all selected" check, matching `selectAllChapters` in the hook.
  const selectableChapters = chapters.filter(
    (c) => c.activeQuestionCount > 0
  );
  const allSelectableSelected =
    selectableChapters.length > 0 &&
    selectableChapters.every((c) => selectedChapterIds.includes(c.id));

  const hasOverflow = chapters.length > INITIAL_MOBILE_VISIBLE;

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
        {/* Slice 34 — "בחר הכל" / "נקה בחירה" small text button. */}
        <button
          type="button"
          onClick={
            allSelectableSelected ? onClearAllChapters : onSelectAllChapters
          }
          className="font-heebo font-semibold transition-colors hover:underline shrink-0"
          style={{ fontSize: 13, color: "var(--color-gold-deep)" }}
        >
          {allSelectableSelected ? "נקה בחירה" : "בחר הכל"}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {chapters.map((chapter, i) => {
          const selected = selectedChapterIds.includes(chapter.id);
          const empty = chapter.activeQuestionCount === 0;
          // Slice 35 — overflow-row hiding. When collapsed, indices
          // ≥6 hide everywhere; indices 3–5 hide on mobile only
          // (mobile has 1 col, so rows 0–2 = indices 0–2). When
          // expanded, no hidden classes are added.
          let overflowClass = "";
          if (!showAllChapters) {
            if (i >= INITIAL_DESKTOP_VISIBLE) {
              overflowClass = "hidden";
            } else if (i >= INITIAL_MOBILE_VISIBLE) {
              overflowClass = "hidden md:flex";
            }
          }
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
              className={overflowClass}
            />
          );
        })}
      </div>

      {hasOverflow && (
        <button
          type="button"
          onClick={() => setShowAllChapters((v) => !v)}
          aria-expanded={showAllChapters}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium transition-colors",
            "hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
          style={{ color: "var(--color-gold-deep)" }}
        >
          {showAllChapters ? (
            <>
              <ChevronUp className="size-4" aria-hidden />
              הצג פחות
            </>
          ) : (
            <>
              <ChevronDown className="size-4" aria-hidden />
              הצג הכל ({chapters.length})
            </>
          )}
        </button>
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
  className,
}: {
  chapter: ChapterRow;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** Slice 35 — extra classes merged into the button's className,
   *  used by the parent to apply per-card responsive visibility
   *  (`hidden md:flex` / `hidden`) for the 3-row default collapse. */
  className?: string;
}) {
  const numberPrefix = String(chapter.display_order).padStart(2, "0");
  // Slice 54 B — the per-chapter available-question count is hidden for
  // ALL users (it leaked the still-thin content depth per chapter). The
  // disabled "coming soon" treatment is preserved for zero-question
  // chapters; the meta-row simply renders nothing for populated ones.
  const metaText = disabled ? "בקרוב · אין שאלות זמינות" : null;

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
        disabled && "cursor-not-allowed",
        className
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
        {metaText && (
          <span
            className="block mt-0.5"
            style={{ fontSize: 11.5, color: "var(--color-ink-muted)" }}
          >
            {metaText}
          </span>
        )}
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
