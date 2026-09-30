"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { getSubjectStats, getTopicStats, summarise } = require("./subject-stats");

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
      { score: 50, date: dates[0], points: null },
      { score: 75, date: dates[1], points: null },
      { score: 100, date: dates[2], points: null },
    ],
    "position in the series is the exam number the chart labels"
  );
});

test("an exam series without dates is still well formed", () => {
  // The chart prints no date under a point that has none, rather than guessing.
  // `points` null: a caller with no points to hand still gets the field, so the
  // chart can branch on it rather than on whether the key exists.
  assert.deepEqual(summarise([60], 1).exams, [{ score: 60, date: null, points: null }]);
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

test("a writing sitting carries its raw points and the mark they are out of", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      { score: { total: 15.5, max: 20 } },
      { score: { total: 10, max: 20 } },
    ],
  });

  const [mahoti, , writing] = await getSubjectStats(supabase, "u1");
  assert.equal(writing.pointsMax, 20, "the scale the dashboard draws the axis to");
  assert.deepEqual(
    writing.exams.map((e) => e.points),
    [15.5, 10],
    "the marks as awarded, not a percentage of them"
  );
  assert.deepEqual(
    writing.exams.map((e) => e.score),
    [77.5, 50],
    "the percentage is still there beside them"
  );
  assert.equal(mahoti.pointsMax, null, "a multiple-choice subject has no points scale");
});

test("sittings marked out of different totals have no shared points scale", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      { score: { total: 15, max: 20 } },
      { score: { total: 15, max: 15 } },
    ],
  });

  const [, , writing] = await getSubjectStats(supabase, "u1");
  assert.equal(
    writing.pointsMax,
    null,
    "15 of 20 and 15 of 15 cannot share an axis — the chart falls back to %"
  );
  assert.deepEqual(writing.exams.map((e) => e.score), [75, 100]);
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

test("each marked writing task is one pickable sitting, broken down by rubric", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      {
        answer_id: "a1",
        created_at: "2026-03-01T00:00:00Z",
        score: {
          total: 15.5,
          max: 20,
          dimensions: {
            content: { awarded: 9.5, max: 12 },
            language: { awarded: 3, max: 4 },
            organization: { awarded: 3, max: 4 },
          },
        },
        open_questions: { subject: "חוק החוזים" },
      },
    ],
  });

  const { writing } = await getTopicStats(supabase, supabase, "u1");
  assert.equal(writing.sittings.length, 1);

  const [task] = writing.sittings;
  assert.equal(task.index, 1);
  assert.equal(task.points, 15.5, "named in the picker by the mark it was given");
  assert.equal(task.title, "חוק החוזים", "and by the law it was set on — its only name");
  assert.equal(task.pointsMax, 20);
  assert.deepEqual(
    task.rows.map((r) => [r.topic, r.points, r.pointsMax]),
    [
      ["תוכן", 9.5, 12],
      ["לשון", 3, 4],
      ["ארגון", 3, 4],
    ],
    "the rubric's own order, each row carrying what it was marked out of"
  );
  assert.equal(task.rows[0].percent, 79.2, "the ratio, for ordering and the tooltip");
});

test("the whole writing history averages each rubric metric across every answer", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      {
        answer_id: "a1",
        score: {
          total: 15.5,
          max: 20,
          dimensions: {
            content: { awarded: 9.5, max: 12 },
            language: { awarded: 3, max: 4 },
            organization: { awarded: 3, max: 4 },
          },
        },
        open_questions: { subject: "חוק החוזים" },
      },
      {
        answer_id: "a2",
        score: {
          total: 10.5,
          max: 20,
          dimensions: {
            content: { awarded: 6.5, max: 12 },
            language: { awarded: 2, max: 4 },
            organization: { awarded: 2, max: 4 },
          },
        },
        open_questions: { subject: "חוק השליחות" },
      },
    ],
  });

  const { writing, mahoti } = await getTopicStats(supabase, supabase, "u1");
  assert.deepEqual(
    writing.dimensions.map((r) => [r.topic, r.points, r.pointsMax, r.questions]),
    [
      ["תוכן", 8, 12, 2],
      ["לשון", 2.5, 4, 2],
      ["ארגון", 2.5, 4, 2],
    ],
    "the rubric's own order, each metric averaged over both answers"
  );
  assert.deepEqual(
    writing.all.map((r) => r.topic),
    ["חוק החוזים", "חוק השליחות"],
    "the by-law rows are untouched — the pie still reads them"
  );
  assert.deepEqual(mahoti.dimensions, [], "a multiple-choice subject has no rubric");
});

test("a writing task marked before dimensions were stored keeps its place in the list", async () => {
  const supabase = stubSupabase({
    open_question_answers: [
      { answer_id: "old", score: { total: 12, max: 20 } },
      {
        answer_id: "new",
        score: {
          total: 10,
          max: 20,
          dimensions: {
            content: { awarded: 6, max: 12 },
            language: { awarded: 2, max: 4 },
            organization: { awarded: 2, max: 4 },
          },
        },
      },
    ],
  });

  const { writing } = await getTopicStats(supabase, supabase, "u1");
  assert.deepEqual(
    writing.sittings.map((s) => [s.index, s.rows.length]),
    [
      [1, 0],
      [2, 3],
    ],
    "the unbreakable-down one is still מטלה ראשונה — dropping it would renumber the rest"
  );
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
