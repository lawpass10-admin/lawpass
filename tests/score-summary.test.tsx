import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScoreSummary } from "@/components/app/score-summary";
import { breakdownByTopic } from "@/lib/scoring/topic-breakdown";

/**
 * <ScoreSummary> is the one panel that draws a run over a generated paper —
 * the filed sitting on /mahoti/results and /diuni/results, and the mid-sitting
 * "בדוק שאלות" check on the two review screens.
 *
 * What is pinned here is the ARITHMETIC ON SCREEN, not the styling: a candidate
 * reads these numbers to decide what to revise, and the mid-sitting case is the
 * one where they are easiest to get wrong — the score is out of what was
 * ANSWERED, while the questions not yet reached are counted separately and
 * never as mistakes.
 */
afterEach(cleanup);

/** The three tallies, by their labels, as rendered. */
function tally(label: string): string {
  const term = screen.getByText(label);
  const cell = term.parentElement;
  if (!cell) throw new Error(`no tally around "${label}"`);
  return within(cell).getAllByText(/^\d+$/)[0].textContent ?? "";
}

describe("ScoreSummary — a filed sitting", () => {
  it("scores out of the whole paper and counts unanswered questions as blank", () => {
    render(
      <ScoreSummary correct={30} total={40} answered={38} byTopic={[]} />
    );

    // Read off the headline itself — "30" alone also appears in the tally
    // below it, which is the point of asking for the pair.
    expect(screen.getByText("/40").parentElement?.textContent).toBe("30/40");
    expect(screen.getByText("75% תשובות נכונות")).toBeInTheDocument();

    expect(tally("נכונות")).toBe("30");
    expect(tally("שגויות")).toBe("8");
    expect(tally("ללא מענה")).toBe("2");
    expect(screen.queryByText("טרם נענו")).not.toBeInTheDocument();
  });
});

describe("ScoreSummary — a mid-sitting check", () => {
  it("scores out of what was answered and keeps the rest of the paper separate", () => {
    render(
      <ScoreSummary
        correct={4}
        total={10}
        answered={10}
        pending={30}
        caption="נענו 10 מתוך 40 שאלות · המבחן עצמו עדיין לא הוגש"
        byTopic={[]}
      />
    );

    // 4 of the TEN answered — never 4 of 40, which would read as a score on an
    // exam the candidate has not finished.
    expect(screen.getByText("/10").parentElement?.textContent).toBe("4/10");
    expect(screen.getByText("40% תשובות נכונות")).toBeInTheDocument();
    expect(
      screen.getByText("נענו 10 מתוך 40 שאלות · המבחן עצמו עדיין לא הוגש")
    ).toBeInTheDocument();

    expect(tally("נכונות")).toBe("4");
    expect(tally("שגויות")).toBe("6");
    // The thirty not yet reached are pending, NOT "ללא מענה": they are not
    // mistakes and are not part of the score.
    expect(tally("טרם נענו")).toBe("30");
    expect(screen.queryByText("ללא מענה")).not.toBeInTheDocument();
  });

  it("draws the per-subject table weakest first, as the review page feeds it", () => {
    // Exactly the shape the review screens build from the questions shown.
    const byTopic = breakdownByTopic([
      { topic: "חוק החוזים", is_correct: true },
      { topic: "חוק החוזים", is_correct: true },
      { topic: "חוק הערבות", is_correct: false },
      { topic: "חוק הערבות", is_correct: false },
      { topic: null, is_correct: true },
    ]);

    render(<ScoreSummary correct={3} total={5} answered={5} byTopic={byTopic} />);

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "חוק הערבות", // 0% — the revision list starts here
      "חוק החוזים", // 100% over two questions: the larger subject breaks the tie
      "ללא סיווג", // 100% over one; questions with no subject group under one row
    ]);
    expect(within(rows[0]).getByText("0/2")).toBeInTheDocument();
    expect(within(rows[0]).getByText("0%")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2/2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100%")).toBeInTheDocument();
  });

  it("says nothing about subjects when the rollup is empty", () => {
    render(<ScoreSummary correct={0} total={1} answered={1} byTopic={[]} />);

    expect(screen.queryByText("פילוח לפי נושא")).not.toBeInTheDocument();
  });
});
