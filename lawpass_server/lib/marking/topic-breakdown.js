"use strict";

// topic-breakdown.js — "how did I do per subject", from a marked paper.
//
// Shared by the mahoti and diuni controllers. The two mark their papers with
// their own copies of markSubmission, but the rollup below is the one thing the
// candidate compares ACROSS the two screens, so the grouping, the label for
// unclassified questions and the row order are defined once. Two copies would
// drift, and the drift would show up as the same paper reading differently on
// two screens.

/** Questions whose source carries no subject. One honest bucket, never a guess. */
const UNCLASSIFIED = "ללא סיווג";

/**
 * Roll marked questions up by subject.
 *
 * @param {{topic: string|null, is_correct: boolean}[]} marked
 * @returns {{topic: string, correct: number, total: number, percent: number}[]}
 *
 * ORDERED WEAKEST FIRST, and that is the whole point of the table: a candidate
 * reads it to decide what to revise, so the subject they are losing most marks
 * in belongs at the top rather than wherever the alphabet puts it. Ties break on
 * the larger subject first — 2/8 is a more urgent gap than 1/4 at the same
 * percentage — and then on the name, so the order is stable between sittings.
 *
 * `percent` is rounded to one decimal, matching how `answer_score` is stored, so
 * a subject line and the headline score can never round differently.
 */
function breakdownByTopic(marked) {
  const rows = new Map();

  for (const m of marked) {
    const topic = m.topic || UNCLASSIFIED;
    const row = rows.get(topic) ?? { topic, correct: 0, total: 0 };
    row.total += 1;
    if (m.is_correct) row.correct += 1;
    rows.set(topic, row);
  }

  return [...rows.values()]
    .map((r) => ({
      ...r,
      percent: r.total > 0 ? Math.round((r.correct / r.total) * 1000) / 10 : 0,
    }))
    .sort(
      (a, b) =>
        a.percent - b.percent ||
        b.total - a.total ||
        a.topic.localeCompare(b.topic, "he")
    );
}

module.exports = { breakdownByTopic, UNCLASSIFIED };
