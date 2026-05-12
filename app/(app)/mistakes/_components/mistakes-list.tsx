"use client";

import { useState } from "react";

import type { MistakeListRow } from "@/lib/db/practice";

import { MistakeRow } from "./mistake-row";

/**
 * Client wrapper that owns the optimistic-remove state. Mirror of
 * BookmarksList — kept separate per Phase 4 spec to preserve the
 * per-route action symmetry.
 */
export function MistakesList({ mistakes }: { mistakes: MistakeListRow[] }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const visible = mistakes.filter((m) => !removedIds.has(m.mistakeId));

  function markRemoved(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <ul className="space-y-3">
      {visible.map((m) => (
        <li key={m.mistakeId}>
          <MistakeRow mistake={m} onRemoved={markRemoved} />
        </li>
      ))}
    </ul>
  );
}
