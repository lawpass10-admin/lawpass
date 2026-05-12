"use client";

import { useMemo, useState } from "react";

import { BatchPracticeButton } from "@/components/practice/batch-practice-button";
import {
  ChapterFilterChips,
  type ChapterChip,
} from "@/components/practice/chapter-filter-chips";
import type { MistakeListRow } from "@/lib/db/practice";

import { MistakeRow } from "./mistake-row";

/**
 * Client-side list mirror of BookmarksList. Same optimistic-remove +
 * filter pattern. Counts may go stale post-remove until next navigation;
 * acceptable per Phase 5 spec.
 */
export function MistakesList({
  mistakes,
  chapterCounts,
}: {
  mistakes: MistakeListRow[];
  chapterCounts: ChapterChip[];
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  const visible = useMemo(() => {
    return mistakes.filter((m) => {
      if (removedIds.has(m.mistakeId)) return false;
      if (activeChapter === null) return true;
      const chapterId =
        m.questionType === "source"
          ? m.sourceQuestion.chapterId
          : m.angleQuestion.chapterId;
      return chapterId === activeChapter;
    });
  }, [mistakes, removedIds, activeChapter]);

  const totalCount = mistakes.length - removedIds.size;

  function markRemoved(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <ChapterFilterChips
          chapters={chapterCounts}
          totalCount={totalCount}
          active={activeChapter}
          onChange={setActiveChapter}
        />
        <BatchPracticeButton
          source="mistakes"
          chapterIdFilter={activeChapter}
          totalInScope={visible.length}
        />
      </div>

      <ul className="space-y-2">
        {visible.map((m) => (
          <li key={m.mistakeId}>
            <MistakeRow mistake={m} onRemoved={markRemoved} />
          </li>
        ))}
      </ul>
    </div>
  );
}
