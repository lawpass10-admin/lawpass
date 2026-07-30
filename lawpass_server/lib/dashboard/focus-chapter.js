"use strict";

// Ported from lib/dashboard/focus-chapter.ts. "התמקד היום ב-X" picker.
//
//   - 0 lifetime attempts → null (hide focus line)
//   - Among chapters with (total - skipped) >= 5, pick MIN(accuracy)
//   - Else fall back to the chapter matching `fallbackCode`
//     (default 'civil_proc'); if that's missing too → null
//
// Pure function. Ties on accuracy break by input order (stable);
// production order is chapters.display_order.

/** Minimum (total - skipped) for a chapter to be eligible as the pick. */
const MIN_CHAPTER_ATTEMPTS_FOR_FOCUS = 5;

function nonSkipped(stat) {
  return stat.total - stat.skipped;
}

function pickFocusChapter(perChapterStats, fallbackCode = "civil_proc") {
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

module.exports = { pickFocusChapter, MIN_CHAPTER_ATTEMPTS_FOR_FOCUS };
