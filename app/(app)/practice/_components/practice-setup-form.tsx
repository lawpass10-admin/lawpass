"use client";

import { ChapterPanel } from "@/app/(app)/practice/_components/chapter-panel";
import { CountsPanel } from "@/app/(app)/practice/_components/counts-panel";
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
 *
 * Pure layout. All state + actions come from `usePracticeBuilder`
 * (Phase P1 lift) and get threaded into 4 presentational panels:
 *
 *   - `<ChapterPanel />`   — chapters grid + subtopic chips (P3)
 *   - `<CountsPanel />`    — source + angle pickers (P4)
 *   - `<TimerPanel />`     — preset + slider (P4)
 *   - `<SummaryFooter />`  — sticky bottom equation + gold CTA (P4)
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
    setRawSubtopicId,
    effectiveSubtopicId,
    subtopicsForSelected,
    setRawSourceCount,
    effectiveSourceCount,
    angles,
    setAngles,
    timeSeconds,
    setTimeSeconds,
    available,
    isCountPending,
    hasSelection,
    insufficient,
    total,
    submit,
    submitting,
    submitDisabled,
  } = builder;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start pb-32">
        {/* Right column (RTL visual right): chapters + subtopics. */}
        <ChapterPanel
          chapters={chapters}
          selectedChapterIds={selectedChapterIds}
          onToggleChapter={toggleChapter}
          subtopicsForSelected={subtopicsForSelected}
          effectiveSubtopicId={effectiveSubtopicId}
          onSelectSubtopic={setRawSubtopicId}
        />

        {/* Left column (RTL visual left): counts + timer stacked. */}
        <aside className="flex flex-col gap-5">
          <CountsPanel
            sourceCount={effectiveSourceCount}
            onSetSourceCount={setRawSourceCount}
            angles={angles}
            onSetAngles={setAngles}
            available={available}
            isCountPending={isCountPending}
            hasSelection={hasSelection}
          />
          <TimerPanel timeSeconds={timeSeconds} onSet={setTimeSeconds} />
        </aside>
      </div>

      <SummaryFooter
        sourceCount={effectiveSourceCount}
        angles={angles}
        total={total}
        timeSeconds={timeSeconds}
        hasSelection={hasSelection}
        insufficient={insufficient}
        submitting={submitting}
        submitDisabled={submitDisabled}
        onSubmit={submit}
      />
    </>
  );
}
