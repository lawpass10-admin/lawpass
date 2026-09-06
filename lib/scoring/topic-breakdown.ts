import type { TopicScore } from "@/lib/scoring/topic-score";

/**
 * Roll marked questions up by subject.
 *
 * A TypeScript port of lawpass_server/lib/marking/topic-breakdown.js. The
 * server computes this at marking time and returns it with a freshly filed
 * sitting; this one recomputes it from a STORED sitting, whose `given` entries
 * each carry their own `topic`, so an old attempt can be reopened without the
 * server having to be asked again.
 *
 * TWO IMPLEMENTATIONS, PINNED BY A TEST. They exist because one runs in the
 * Express server (CommonJS, at submit time) and one in Next (at page render),
 * and neither runtime can import the other's module. `tests/topic-breakdown-parity.test.ts`
 * runs both over the same inputs and asserts the output is identical, so a
 * change to one that is not made to the other fails the suite rather than
 * showing a candidate two different tables for one sitting.
 */

/** Questions whose source carries no subject. One honest bucket, never a guess. */
export const UNCLASSIFIED = "ללא סיווג";

export type MarkedForBreakdown = {
  topic?: string | null;
  is_correct: boolean;
};

/**
 * ORDERED WEAKEST FIRST — the table is a revision list, so the subject costing
 * the most marks belongs at the top rather than wherever the alphabet puts it.
 * Ties break on the larger subject first (2/8 is a more urgent gap than 1/4 at
 * the same percentage), then on the name so the order is stable between
 * sittings.
 */
export function breakdownByTopic(marked: MarkedForBreakdown[]): TopicScore[] {
  const rows = new Map<string, { topic: string; correct: number; total: number }>();

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
      // One decimal, matching how `answer_score` is stored, so a subject line
      // and the headline score can never round differently.
      percent: r.total > 0 ? Math.round((r.correct / r.total) * 1000) / 10 : 0,
    }))
    .sort(
      (a, b) =>
        a.percent - b.percent ||
        b.total - a.total ||
        a.topic.localeCompare(b.topic, "he")
    );
}
