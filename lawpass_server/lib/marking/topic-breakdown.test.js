"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { breakdownByTopic, UNCLASSIFIED } = require("./topic-breakdown");

const q = (topic, is_correct) => ({ topic, is_correct });

test("groups by subject and counts correct out of total", () => {
  const rows = breakdownByTopic([
    q("חוק החוזים", true),
    q("חוק החוזים", false),
    q("חוק החוזים", true),
    q("דיני נזיקין", true),
  ]);

  const byTopic = Object.fromEntries(rows.map((r) => [r.topic, r]));
  assert.equal(byTopic["חוק החוזים"].correct, 2);
  assert.equal(byTopic["חוק החוזים"].total, 3);
  assert.equal(byTopic["דיני נזיקין"].correct, 1);
  assert.equal(byTopic["דיני נזיקין"].total, 1);
});

test("orders weakest subject first — the table is a revision list", () => {
  const rows = breakdownByTopic([
    q("חזק", true),
    q("חזק", true),
    q("בינוני", true),
    q("בינוני", false),
    q("חלש", false),
    q("חלש", false),
  ]);

  assert.deepEqual(
    rows.map((r) => r.topic),
    ["חלש", "בינוני", "חזק"]
  );
});

test("at equal percentage the bigger subject ranks first", () => {
  const rows = breakdownByTopic([
    // Both 50%, but the eight-question subject is the more urgent gap.
    q("גדול", true), q("גדול", true), q("גדול", true), q("גדול", true),
    q("גדול", false), q("גדול", false), q("גדול", false), q("גדול", false),
    q("קטן", true), q("קטן", false),
  ]);

  assert.equal(rows[0].topic, "גדול");
  assert.equal(rows[0].total, 8);
});

test("questions with no subject land in one honest bucket, never a guess", () => {
  const rows = breakdownByTopic([q(null, true), q(undefined, false), q("", true)]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].topic, UNCLASSIFIED);
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].correct, 2);
});

test("percent is rounded the same way answer_score is, to one decimal", () => {
  // 1/3 -> 33.3, not 33.33333
  const rows = breakdownByTopic([q("א", true), q("א", false), q("א", false)]);
  assert.equal(rows[0].percent, 33.3);
});

test("the subject totals reconcile with the paper total", () => {
  const marked = Array.from({ length: 40 }, (_, i) =>
    q(["א", "ב", "ג"][i % 3], i % 4 !== 0)
  );
  const rows = breakdownByTopic(marked);

  assert.equal(rows.reduce((n, r) => n + r.total, 0), 40);
  assert.equal(
    rows.reduce((n, r) => n + r.correct, 0),
    marked.filter((m) => m.is_correct).length
  );
});

test("an empty paper produces no rows rather than a divide by zero", () => {
  assert.deepEqual(breakdownByTopic([]), []);
});
