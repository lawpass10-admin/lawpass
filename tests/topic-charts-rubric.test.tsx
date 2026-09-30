import { cleanup, render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AwardedLabel, TopicCharts } from "@/app/(app)/dashboard/_components/topic-charts";
import type { TopicStat } from "@/lib/dashboard/topic-stat";

/**
 * The two charts under a dashboard tab read one of three ways, and WHICH ONE is
 * decided by the rows rather than by the caller:
 *
 *   * percentages          — a multiple-choice subject, where an answer is
 *                            right or wrong and every row shares a 0-100 scale;
 *   * points on one scale  — מטלת כתיבה over all its tasks, each marked out of
 *                            the same 20;
 *   * points per row       — ONE marked task, broken into the three things it
 *                            was marked on, which do NOT share a ceiling
 *                            (תוכן 12, לשון 4, ארגון 4).
 *
 * RECHARTS IS GIVEN A SIZE HERE. It measures its container before drawing and
 * jsdom reports zero for everything, so an unmocked ResponsiveContainer renders
 * an empty box and these tests would pass over a chart that draws nothing. Only
 * the measuring wrapper is replaced; the axes below are the real recharts doing
 * its real arithmetic, which is what lets the last test check a coordinate.
 *
 * The bars themselves still do not appear: their rectangles are drawn through
 * react-smooth, which needs animation frames jsdom never delivers. So the marks
 * printed ON the bars — the white figure inside each and the orange full mark
 * past its end — are not covered here, and the plot's left edge is checked
 * instead, because that is what gives the orange figure room to exist.
 */
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    // Typed as taking the chart's own props, because that is what is being
    // injected: cloneElement on a `ReactElement` alone infers `unknown` props
    // and rejects the width it is there to supply.
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
      height?: number;
    }) => cloneElement(children, { width: 720, height: height ?? 300 }),
  };
});

afterEach(cleanup);

const rubricRows: TopicStat[] = [
  { topic: "תוכן", questions: 1, correct: null, percent: 79.2, points: 9.5, pointsMax: 12 },
  { topic: "לשון", questions: 1, correct: null, percent: 75, points: 3, pointsMax: 4 },
  { topic: "ארגון", questions: 1, correct: null, percent: 100, points: 4, pointsMax: 4 },
];

const lawRows: TopicStat[] = [
  { topic: "חוק החוזים", questions: 6, correct: null, percent: 77.5, points: 15.5 },
  { topic: "חוק השליחות", questions: 4, correct: null, percent: 60, points: 12 },
];

/** deepEqual with a message, without pulling in another matcher. */
function assertSame(got: unknown, want: unknown, message: string) {
  expect(got, message).toEqual(want);
}

describe("TopicCharts", () => {
  it("leads one marked task with its mark and its name, and drops the pie", () => {
    render(
      <TopicCharts
        rows={rubricRows}
        emptyMessage="אין נתונים"
        dimensionLabel="מדד הערכה"
        maxPoints={20}
        total={{ points: 16.5, max: 20 }}
        scoreContext="תקנות סדר הדין האזרחי, תשע״ט-2018"
      />
    );

    expect(screen.getByText("הניקוד לפי מדד הערכה")).toBeTruthy();
    expect(screen.getByText("16.5 מתוך 20")).toBeTruthy();
    // In full on the card, where there is room for it — the picker trims it.
    expect(screen.getByText("תקנות סדר הדין האזרחי, תשע״ט-2018")).toBeTruthy();
    // The distribution pie is what the bar beside it already said, three slices
    // to three bars — gone from this view, still there for a whole history.
    expect(screen.queryByText(/פילוח ה/)).toBeNull();
  });

  it("takes the total from the marked answer, not from the rows", () => {
    // A row that failed to parse would shrink a total added up on screen. The
    // mark on the answer is the one the candidate was given.
    render(
      <TopicCharts
        rows={rubricRows.slice(0, 1)}
        emptyMessage="אין נתונים"
        dimensionLabel="מדד הערכה"
        maxPoints={20}
        total={{ points: 16.5, max: 20 }}
      />
    );

    expect(screen.getByText("16.5 מתוך 20")).toBeTruthy();
  });

  it("puts no total over the whole history, where no such mark exists", () => {
    render(
      <TopicCharts
        rows={lawRows}
        scoreRows={rubricRows}
        emptyMessage="אין נתונים"
        dimensionLabel="חוק"
        scoreDimensionLabel="מדד הערכה"
        maxPoints={20}
      />
    );

    // 9.5 + 3 + 4 adds up, but nobody was ever given 16.5 out of 20 — it is
    // what an imaginary exactly-average task would have scored.
    expect(screen.queryByText(/מתוך 20/)).toBeNull();
  });

  it("reads a whole writing history as points on one scale", () => {
    render(
      <TopicCharts rows={lawRows} emptyMessage="אין נתונים" dimensionLabel="חוק" maxPoints={20} />
    );

    expect(screen.getByText("ציון ממוצע לפי חוק")).toBeTruthy();
    expect(screen.getByText("ניקוד ממוצע בכל תחום · מתוך 20 נקודות")).toBeTruthy();
    // The whole history still gets both charts: which laws, and how well.
    expect(screen.getByText("פילוח התרגול לפי חוק")).toBeTruthy();
  });

  it("puts every metric's full mark on the scale under the bars", () => {
    const { container } = render(
      <TopicCharts
        rows={rubricRows}
        emptyMessage="אין נתונים"
        dimensionLabel="מדד הערכה"
        maxPoints={20}
        total={{ points: 16.5, max: 20 }}
      />
    );

    const ticks = [...container.querySelectorAll(".recharts-xAxis-tick-labels text")]
      .map((t) => Number(t.textContent))
      .sort((a, b) => a - b);

    // 4 is where a perfect לשון or ארגון bar ends, and it is not one of the
    // five even steps the axis would have drawn on its own — it is on the
    // scale because a row has that ceiling. 12 is both a ceiling and a step.
    assertSame(ticks, [0, 3, 4, 6, 9, 12], "the even steps, plus each row's full mark");
  });

  it("draws laws in the pie and rubric metrics in the bar, over a whole history", () => {
    render(
      <TopicCharts
        rows={lawRows}
        scoreRows={rubricRows}
        emptyMessage="אין נתונים"
        dimensionLabel="חוק"
        scoreDimensionLabel="מדד הערכה"
        maxPoints={20}
      />
    );

    // Both cards, each with its own vocabulary — and the score card says
    // ממוצע, because these rows are an average and not a mark anyone was given.
    expect(screen.getByText("פילוח התרגול לפי חוק")).toBeTruthy();
    expect(screen.getByText("ניקוד ממוצע לפי מדד הערכה")).toBeTruthy();
    // The pie's own subtitle still counts questions by law, not points.
    expect(screen.getByText("10 שאלות · 2 תחומים")).toBeTruthy();
  });

  it("centres the earned figure in its bar, whichever way recharts hands over the rect", () => {
    // A לשון bar worth 3, drawn on a `reversed` axis: recharts reports x at the
    // ZERO end (1109) and a NEGATIVE width back to the 3 (852). Read as given,
    // the bar looks 257px wide in the wrong direction — or narrower than the
    // threshold, which is the bug this pins: the figure went outside the bar,
    // in ink, at the zero end.
    const { container } = render(
      <svg>
        <AwardedLabel x={1109} y={100} width={-257} height={80} value={3} />
      </svg>
    );

    const label = container.querySelector("text")!;
    expect(label.textContent).toBe("3");
    expect(Number(label.getAttribute("x"))).toBe(1109 - 257 / 2);
    expect(label.getAttribute("text-anchor")).toBe("middle");
    expect(label.getAttribute("fill")).toBe("#e3e6ec");
  });

  it("moves the earned figure out of a bar too thin to hold it", () => {
    const { container } = render(
      <svg>
        <AwardedLabel x={1109} y={100} width={-12} height={80} value={0.5} />
      </svg>
    );

    const label = container.querySelector("text")!;
    // Past the bar's far end, and in ink — light grey laid on the light grey
    // remainder would be nothing at all.
    expect(Number(label.getAttribute("x"))).toBe(1109 - 12 - 6);
    expect(label.getAttribute("text-anchor")).toBe("end");
    expect(label.getAttribute("fill")).toBe("var(--color-ink-dim)");
  });

  it("stays on percentages for a subject that has no points", () => {
    // Rebuilt without `points` rather than destructured around it: the eslint
    // config counts a discarded binding as unused whatever it is named.
    const percentOnly: TopicStat[] = lawRows.map((row) => ({
      topic: row.topic,
      questions: row.questions,
      correct: row.correct,
      percent: row.percent,
    }));
    render(
      <TopicCharts
        rows={percentOnly}
        emptyMessage="אין נתונים"
        dimensionLabel="תחום התמחות"
      />
    );

    expect(screen.getByText("ציון ממוצע לפי תחום התמחות")).toBeTruthy();
    expect(screen.getByText("אחוז תשובות נכונות בכל תחום")).toBeTruthy();
  });
});
