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
 * Slice 34:
 *   - The 16-card grid is now collapsed BEHIND a "הצג פרקים" toggle by
 *     default. The grid itself + each <ChapterCard> stay untouched — we
 *     just gate visibility behind a local `chaptersOpen` UI state.
 *     When collapsed, the panel surfaces a one-line summary of the
 *     selected chapter titles so the user still sees their choice
 *     without scrolling through the grid.
 *   - Header gets a small text button "בחר הכל" / "נקה בחירה" wired
 *     to `selectAllChapters` / `clearAllChapters` on the builder hook.
 *     Tap once → all selectable chapters selected; tap again → clear.
 *     Subtopics-panel gating ("exactly one chapter selected") is
 *     unchanged — select-all collapses it deliberately.
 *   - The sub-topics chip block previously rendered INSIDE this panel
 *     under a dashed border has moved OUT into
 *     `<SubtopicsPanel>` (mounted in the left aside under <TimerPanel>
 *     by `practice-setup-form.tsx`). The hook's outputs feed the new
 *     location directly — no hook signature changes.
 *
 * Layout: chapter cards laid out in a 1-col → 2-col @md grid.
 * Single-select-subtopic note continues to live with SubtopicsPanel.
 */

type Props = {
  chapters: ChapterRow[];
  selectedChapterIds: string[];
  onToggleChapter: (id: string) => void;
  onSelectAllChapters: () => void;
  onClearAllChapters: () => void;
};

export function ChapterPanel({
  chapters,
  selectedChapterIds,
  onToggleChapter,
  onSelectAllChapters,
  onClearAllChapters,
}: Props) {
  // Slice 34 — local collapse state. Default closed so a long taxonomy
  // doesn't dominate the page on first paint. Pure UI; the hook is
  // not involved (no need to persist across remounts).
  const [chaptersOpen, setChaptersOpen] = useState(false);

  // Slice 34 — "select all" toggle semantics: if every selectable
  // chapter is currently selected, the button switches to "נקה בחירה".
  // Disabled ("בקרוב") chapters are excluded from both the target set
  // and the "all selected" check, matching `selectAllChapters` in the
  // hook so the two states stay aligned.
  const selectableChapters = chapters.filter(
    (c) => c.activeQuestionCount > 0
  );
  const allSelectableSelected =
    selectableChapters.length > 0 &&
    selectableChapters.every((c) => selectedChapterIds.includes(c.id));

  // One-line summary string for the collapsed state. Joined by " · "
  // so the divider is recognisable from the rest of the cream copy on
  // the page. `truncate` on the wrapper handles overflow.
  const selectedTitles = chapters
    .filter((c) => selectedChapterIds.includes(c.id))
    .map((c) => c.title);

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
        {/* Slice 34 — "בחר הכל" / "נקה בחירה" small text button. Styled
            like the existing gold-deep affordance language (איפוס in
            the subtopics block) — small font, semibold, underline on
            hover. */}
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

      {/* Slice 34 — Toggle between collapsed (summary line) and open
          (the existing 16-card grid). The toggle button itself mirrors
          the "הצג עוד" pattern in `mastery-rows-client.tsx` — dashed
          border, full-width, gold-deep label, chevron flip on state. */}
      {chaptersOpen ? (
        <>
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
          <button
            type="button"
            onClick={() => setChaptersOpen(false)}
            aria-expanded={true}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-muted/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
            style={{ color: "var(--color-gold-deep)" }}
          >
            <ChevronUp className="size-4" aria-hidden />
            הסתר פרקים
          </button>
        </>
      ) : (
        <>
          <div
            className="mb-3 truncate font-heebo"
            style={{
              fontSize: 13.5,
              color:
                selectedTitles.length > 0
                  ? "var(--color-navy-ink)"
                  : "var(--color-ink-muted)",
            }}
            aria-live="polite"
          >
            {selectedTitles.length > 0
              ? selectedTitles.join(" · ")
              : "לא נבחרו פרקים"}
          </div>
          <button
            type="button"
            onClick={() => setChaptersOpen(true)}
            aria-expanded={false}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border px-5 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-muted/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            )}
            style={{ color: "var(--color-gold-deep)" }}
          >
            <ChevronDown className="size-4" aria-hidden />
            הצג פרקים ({selectedChapterIds.length}/{chapters.length})
          </button>
        </>
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
