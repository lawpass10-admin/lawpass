"use client";

import { ChapterPanel } from "@/app/(app)/practice/_components/chapter-panel";
import { CountsPanel } from "@/app/(app)/practice/_components/counts-panel";
import { SubtopicsPanel } from "@/app/(app)/practice/_components/subtopics-panel";
import { SummaryFooter } from "@/app/(app)/practice/_components/summary-footer";
import { TimerPanel } from "@/app/(app)/practice/_components/timer-panel";
import {
  usePracticeBuilder,
  type ChapterRow,
  type SubtopicRow,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import type { PrefillInput } from "@/lib/urls";

/**
 * Slice 5 Phase P4 — PracticeSetupForm shell.
 * Slice 34 — sub-topics panel relocated out of `<ChapterPanel>` and
 *   placed at the BOTTOM of the left aside, under `<TimerPanel>`. New
 *   order (desktop right column → chapters; left column → counts →
 *   timer → sub-topics; mobile single column → chapters → counts →
 *   timer → sub-topics). The "exactly one chapter selected" gating
 *   that used to live in ChapterPanel now lives here, so the panel
 *   simply doesn't render in the multi-chapter / no-chapter cases.
 *
 * Pure layout. All state + actions come from `usePracticeBuilder`
 * (Phase P1 lift) and get threaded into 5 presentational panels:
 *
 *   - `<ChapterPanel />`    — chapters grid (collapsible)
 *   - `<CountsPanel />`     — question-count picker
 *   - `<TimerPanel />`      — preset + slider
 *   - `<SubtopicsPanel />`  — chips, gated on single-chapter
 *   - `<SummaryFooter />`   — sticky bottom equation + gold CTA
 *
 * The form adds `pb-32` to its outer container so scrollable content
 * has clearance from the fixed footer; the footer itself is rendered
 * outside the 2-col grid so it spans the full content area.
 */

export function PracticeSetupForm({
  chapters,
  subtopics,
  initialValues,
}: {
  chapters: ChapterRow[];
  subtopics: SubtopicRow[];
  initialValues?: PrefillInput | null;
}) {
  const builder = usePracticeBuilder({ chapters, subtopics, initialValues });
  const {
    selectedChapterIds,
    toggleChapter,
    selectAllChapters,
    clearAllChapters,
    setRawSubtopicId,
    effectiveSubtopicId,
    subtopicsForSelected,
    // Slice 18 — single "כמות שאלות" total replaces the prior
    // source + angles pair. `total` is now the truthful generated
    // question count (engine still receives sourceCountTarget +
    // anglesPerSource via the unchanged action signature).
    // Slice 23 — `rawTotal` is what the user typed; `total` is the
    // engine-resolved count. They differ when the typed number
    // isn't a multiple of (1 + DEFAULT_ANGLES); the counts panel
    // surfaces the rounding inline.
    rawTotal,
    setRawTotal,
    // Slice 24 — per-session timer state replaces the per-question
    // `timeSeconds` for the play UI; `timeSeconds` stays in the hook
    // for legacy reasons but is no longer rendered.
    sessionDurationSeconds,
    setSessionDurationSeconds,
    available,
    isCountPending,
    hasSelection,
    insufficient,
    total,
    submit,
    submitting,
    submitDisabled,
  } = builder;

  // Slice 34 — sub-topics panel gating. Renders only when exactly one
  // chapter is selected AND that chapter has sub-topics (the same
  // contract that lived inside ChapterPanel pre-Slice-34).
  const singleSelectedChapter =
    selectedChapterIds.length === 1
      ? chapters.find((c) => c.id === selectedChapterIds[0]) ?? null
      : null;
  const showSubtopics =
    singleSelectedChapter !== null && subtopicsForSelected.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start pb-32">
        {/* Right column (RTL visual right): chapters. */}
        <ChapterPanel
          chapters={chapters}
          selectedChapterIds={selectedChapterIds}
          onToggleChapter={toggleChapter}
          onSelectAllChapters={selectAllChapters}
          onClearAllChapters={clearAllChapters}
        />

        {/* Left column (RTL visual left): counts → timer → sub-topics. */}
        <aside className="flex flex-col gap-5">
          <CountsPanel
            rawTotal={rawTotal}
            total={total}
            onSetTotal={setRawTotal}
            available={available}
            isCountPending={isCountPending}
            hasSelection={hasSelection}
          />
          <TimerPanel
            sessionDurationSeconds={sessionDurationSeconds}
            onSet={setSessionDurationSeconds}
          />
          {showSubtopics && (
            <SubtopicsPanel
              subtopicsForSelected={subtopicsForSelected}
              effectiveSubtopicId={effectiveSubtopicId}
              onSelectSubtopic={setRawSubtopicId}
              singleSelectedChapter={singleSelectedChapter}
            />
          )}
        </aside>
      </div>

      <SummaryFooter
        total={total}
        // Slice 24 — footer now reflects the session-level timer the
        // user just configured, not the legacy per-question setting.
        sessionDurationSeconds={sessionDurationSeconds}
        hasSelection={hasSelection}
        insufficient={insufficient}
        submitting={submitting}
        submitDisabled={submitDisabled}
        onSubmit={submit}
      />
    </>
  );
}
