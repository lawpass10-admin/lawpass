"use client";

import { useMemo, useState } from "react";

import { BatchPracticeButton } from "@/components/practice/batch-practice-button";
import {
  ChapterFilterChips,
  type ChapterChip,
} from "@/components/practice/chapter-filter-chips";
import type { BookmarkListRow } from "@/lib/db/practice";

import { BookmarkRow } from "./bookmark-row";

/**
 * Client-side list that owns:
 *  - optimistic-remove state (rows the user just removed disappear
 *    locally before the revalidatePath round-trip lands)
 *  - chapter filter state (radio-style, single active chip)
 *
 * Chapter counts are computed server-side and passed via the
 * `chapterCounts` prop. They DO NOT recompute when the user removes a
 * row in this component — per Phase 5 spec, the chip counts may go
 * stale until the next navigation flushes revalidatePath.
 */
export function BookmarksList({
  bookmarks,
  chapterCounts,
}: {
  bookmarks: BookmarkListRow[];
  chapterCounts: ChapterChip[];
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  const visible = useMemo(() => {
    return bookmarks.filter((b) => {
      if (removedIds.has(b.bookmarkId)) return false;
      if (activeChapter === null) return true;
      const chapterId =
        b.questionType === "source"
          ? b.sourceQuestion.chapterId
          : b.angleQuestion.chapterId;
      return chapterId === activeChapter;
    });
  }, [bookmarks, removedIds, activeChapter]);

  // Total in scope = bookmarks not yet locally removed. Archived
  // bookmarks still count (the user can still remove them).
  const totalCount = bookmarks.length - removedIds.size;

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
          source="bookmarks"
          chapterIdFilter={activeChapter}
          totalInScope={visible.length}
        />
      </div>

      <ul className="space-y-2">
        {visible.map((b) => (
          <li key={b.bookmarkId}>
            <BookmarkRow bookmark={b} onRemoved={markRemoved} />
          </li>
        ))}
      </ul>
    </div>
  );
}
