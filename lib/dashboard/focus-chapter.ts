/**
 * Slice 4 — "התמקד היום ב-X" focus chapter picker.
 *
 * Plan §2.1 D2:
 *   - 0 lifetime attempts → null (hide focus line)
 *   - Among chapters with `(total - skipped) >= 5`, pick MIN(accuracy)
 *   - If no chapter qualifies → fallback to chapter matching `fallbackCode`
 *     (default `'civil_proc'`); if that's also missing → null
 *
 * Pure function. Caller provides the per-chapter stats slice — typically
 * derived from the same aggregate that drives `getMasteryByChapter`.
 *
 * Ties on accuracy are broken by chapter input order (stable). Production
 * order is `chapters.display_order`; tests can choose any order.
 */

import type { FocusChapter } from "@/lib/dashboard/types";

export type FocusChapterStat = {
  chapterId: string;
  chapterCode: string;
  chapterTitle: string;
  correct: number;
  total: number;
  skipped: number;
};

/**
 * Minimum (total - skipped) for a chapter to be eligible as the focus
 * pick. Below this, the chapter is treated as "not enough data".
 */
export const MIN_CHAPTER_ATTEMPTS_FOR_FOCUS = 5;

function nonSkipped(stat: FocusChapterStat): number {
  return stat.total - stat.skipped;
}

export function pickFocusChapter(
  perChapterStats: FocusChapterStat[],
  fallbackCode: string = "civil_proc"
): FocusChapter {
  const lifetimeAttempts = perChapterStats.reduce(
    (acc, c) => acc + nonSkipped(c),
    0
  );
  if (lifetimeAttempts === 0) return null;

  const eligible = perChapterStats.filter(
    (c) => nonSkipped(c) >= MIN_CHAPTER_ATTEMPTS_FOR_FOCUS
  );

  if (eligible.length > 0) {
    let bestIdx = 0;
    let bestAccuracy = Infinity;
    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      const acc = c.correct / nonSkipped(c);
      if (acc < bestAccuracy) {
        bestAccuracy = acc;
        bestIdx = i;
      }
    }
    const pick = eligible[bestIdx];
    return {
      chapterId: pick.chapterId,
      chapterCode: pick.chapterCode,
      chapterTitle: pick.chapterTitle,
    };
  }

  const fallback = perChapterStats.find((c) => c.chapterCode === fallbackCode);
  if (!fallback) return null;
  return {
    chapterId: fallback.chapterId,
    chapterCode: fallback.chapterCode,
    chapterTitle: fallback.chapterTitle,
  };
}
