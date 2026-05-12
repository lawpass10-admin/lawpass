"use client";

import { useState } from "react";

import type { BookmarkListRow } from "@/lib/db/practice";

import { BookmarkRow } from "./bookmark-row";

/**
 * Client-side wrapper that owns the optimistic-remove state. Rows that
 * the user removed disappear locally before the server-side
 * revalidatePath round-trip lands — the page re-renders with the new
 * data shortly after, but the user shouldn't see a stale row in the
 * meantime.
 */
export function BookmarksList({
  bookmarks,
}: {
  bookmarks: BookmarkListRow[];
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const visible = bookmarks.filter((b) => !removedIds.has(b.bookmarkId));

  function markRemoved(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <ul className="space-y-3">
      {visible.map((b) => (
        <li key={b.bookmarkId}>
          <BookmarkRow bookmark={b} onRemoved={markRemoved} />
        </li>
      ))}
    </ul>
  );
}
