import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { breakdownByTopic } from "@/lib/scoring/topic-breakdown";

/**
 * The subject breakdown is implemented twice — once in the Express server
 * (CommonJS, run at marking time) and once in TypeScript (run when a stored
 * sitting is reopened). Neither runtime can import the other's module, so this
 * suite is what keeps them the same: it runs both over the same inputs and
 * requires identical output.
 *
 * If this fails, one implementation was changed and the other was not. Fix the
 * lagging one rather than relaxing the test — the two feed the same table on
 * the same screen, and a candidate seeing different numbers for one sitting
 * depending on whether they just submitted or came back later is the exact bug
 * this exists to prevent.
 */
const require = createRequire(import.meta.url);
const server = require("../lawpass_server/lib/marking/topic-breakdown.js") as {
  breakdownByTopic: (m: { topic?: string | null; is_correct: boolean }[]) => unknown;
  UNCLASSIFIED: string;
};

const q = (topic: string | null, is_correct: boolean) => ({ topic, is_correct });

const CASES: { name: string; marked: { topic: string | null; is_correct: boolean }[] }[] = [
  { name: "empty paper", marked: [] },
  {
    name: "single subject, mixed",
    marked: [q("חוק החוזים", true), q("חוק החוזים", false), q("חוק החוזים", true)],
  },
  {
    name: "weakest-first ordering",
    marked: [
      q("חזק", true), q("חזק", true),
      q("בינוני", true), q("בינוני", false),
      q("חלש", false), q("חלש", false),
    ],
  },
  {
    name: "tie on percent, bigger subject first",
    marked: [
      q("גדול", true), q("גדול", true), q("גדול", true), q("גדול", true),
      q("גדול", false), q("גדול", false), q("גדול", false), q("גדול", false),
      q("קטן", true), q("קטן", false),
    ],
  },
  {
    name: "unclassified questions",
    marked: [q(null, true), q(null, false), q("חוק המקרקעין", true)],
  },
  {
    name: "repeating third rounds to one decimal",
    marked: [q("א", true), q("א", false), q("א", false)],
  },
  {
    name: "a realistic 40-question paper",
    marked: Array.from({ length: 40 }, (_, i) =>
      q(["חוק החוזים", "חוק המקרקעין", "חוק החברות", "חוק הירושה"][i % 4], i % 3 !== 0)
    ),
  },
];

describe("topic breakdown parity between the server and the client", () => {
  for (const { name, marked } of CASES) {
    it(`agrees on: ${name}`, () => {
      expect(breakdownByTopic(marked)).toEqual(server.breakdownByTopic(marked));
    });
  }

  it("uses the same label for unclassified questions", () => {
    const [row] = breakdownByTopic([q(null, true)]);
    expect(row.topic).toBe(server.UNCLASSIFIED);
  });
});
