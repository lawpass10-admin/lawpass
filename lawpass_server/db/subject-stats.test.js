"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { getSubjectStats, summarise } = require("./subject-stats");

/** A stub of the query builder chain the reader uses. */
function stubSupabase(byTable) {
  return {
    from(table) {
      const rows = byTable[table] ?? [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        // The readers order by created_at, so the rows arrive oldest first and
        // their position is the exam number the dashboard chart plots. The stub
        // hands back what the fixture already lists in order rather than
        // sorting, so a fixture written out of order would show up as a failing
        // expectation instead of being quietly fixed here.
        order: () => chain,
        then: (resolve) => resolve({ data: rows, error: null }),
      };
      return chain;
    },
  };
}

test("no attempts yields nulls, not zeros", () => {
  const s = summarise([], 0);
  assert.equal(s.attempts, 0);
  assert.equal(s.average, null, "an average of nothing is not 0%");
  assert.equal(s.lowest, null);
  assert.equal(s.highest, null);
});

test("average, lowest and highest come off the scores", () => {
  const s = summarise([50, 75, 100], 120);
  assert.equal(s.attempts, 3);
  assert.equal(s.questions, 120);
  assert.equal(s.average, 75);
  assert.equal(s.lowest, 50);
  assert.equal(s.highest, 100);
});

test("the exam series keeps each score with its own date, in order", () => {
  const dates = ["2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", "2026-03-01T00:00:00Z"];
  const s = summarise([50, 75, 100], 120, dates);

  assert.deepEqual(
    s.exams,
    [
      { score: 50, date: dates[0] },
      { score: 75, date: dates[1] },
      { score: 100, date: dates[2] },
    ],
    "position in the series is the exam number the chart labels"
  );
});

test("an exam series without dates is still well formed", () => {
  // The chart prints no date under a point that has none, rather than guessing.
  assert.deepEqual(summarise([60], 1).exams, [{ score: 60, date: null }]);
  assert.deepEqual(summarise([], 0).exams, []);
});

test("a writing row skipped for an unusable score does not shift the dates", () => {
  // The reader drops score and date together; this is the invariant that
  // protects — one dropped row must not date every later point with the
  // sitting before it.
  const s = summarise([80, 90], 2, ["2026-05-01T00:00:00Z", "2026-07-01T00:00:00Z"]);
  assert.equal(s.exams[1].date, "2026-07-01T00:00:00Z");
});

test("average is rounded to one decimal, like answer_score", () => {
  assert.equal(summarise([50, 75, 76], 0).average, 67);
  assert.equal(summarise([1, 2], 0).average, 1.5);
});

test("questions counted are the ones answered, not the paper's length", async () => {
  const supabase = stubSupabase({
    mahoti_answers: [
      { answer_score: 75, answer_body: { answered: 30, total: 40 } },
      { answer_score: 50, answer_body: { answered: 40, total: 40 } },
    ],
  });

  const [mahoti] = await getSubjectStats(supabase, "u1");
  assert.equal(mahoti.questions, 70, "30 answered + 40 answered");
  assert.equal(mahoti.attempts, 2);
  assert.equal(mahoti.average, 62.5);
});

test("rows written before `answered` existed fall back to the total", async () => {
  const supabase = stubSupabase({
    mahoti_answers: [{ answer_score: 80, answer_body: { total: 40 } }],
  });

  const [mahoti] = await getSubjectStats(supabase, "u1");
  assert.equal(mahoti.questions, 40);
});

test("a writing task is one question, scored as points out of points", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      { score: { total: 15, max: 20 } }, // 75%
      { score: { total: 10, max: 20 } }, // 50%
    ],
  });

  const [, , writing] = await getSubjectStats(supabase, "u1");
  assert.equal(writing.questions, 2);
  assert.equal(writing.average, 62.5);
  assert.equal(writing.lowest, 50);
  assert.equal(writing.highest, 75);
});

test("an unscorable writing row is skipped, never counted as 0%", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      { score: { total: 18, max: 20 } },
      { score: { total: 5, max: 0 } }, // max 0 -> no percentage exists
      { score: {} },
    ],
  });

  const [, , writing] = await getSubjectStats(supabase, "u1");
  assert.equal(writing.questions, 1);
  assert.equal(writing.average, 90);
  assert.equal(writing.lowest, 90);
});

test("the three subjects come back in dashboard order", async () => {
  const subjects = await getSubjectStats(stubSupabase({}), "u1");
  assert.deepEqual(
    subjects.map((s) => s.key),
    ["mahoti", "diuni", "writing"]
  );
  assert.deepEqual(
    subjects.map((s) => s.label),
    ["דין מהותי", "דין דיוני", "מטלת כתיבה"]
  );
});

test("a candidate with no history gets three empty cards, not an error", async () => {
  const subjects = await getSubjectStats(stubSupabase({}), "u1");
  for (const s of subjects) {
    assert.equal(s.questions, 0);
    assert.equal(s.average, null);
  }
});
