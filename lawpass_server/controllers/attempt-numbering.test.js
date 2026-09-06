"use strict";

// Attempt numbering — the contract both subjects' answer tables promise.
//
// RE-SITTING IS SUPPORTED ON PURPOSE. Neither table has a unique constraint on
// (user_id, question_id) and neither caps `attempts`; the migrations say so
// explicitly. A candidate may sit the same paper as often as they like, and the
// dashboard's "מבחן ראשון / שני / …" picker and the 75% → 30.8% → 30%
// progression both exist because of it.
//
// What must hold is the NUMBERING. `attempts` is assigned by a database trigger
// as MAX+1 per (user, paper) under an advisory lock, so for one candidate on one
// paper the numbers must be 1, 2, 3 … with no gaps, no repeats and no zero. A
// break in that is silent and ugly: two sittings both calling themselves
// "מבחן שני", or a picker with a hole in it.
//
// These tests are pure — they assert the invariant against fixture rows rather
// than against the database, so they run in CI without credentials. The live
// data is checked by scripts/check-attempt-numbering.mjs.

const test = require("node:test");
const assert = require("node:assert/strict");

const { auditAttemptNumbering } = require("../lib/marking/attempt-numbering");

const row = (user, question, attempts, score = 50) => ({
  user_id: user,
  question_id: question,
  attempts,
  answer_score: score,
});

test("a single sitting is valid", () => {
  const { problems } = auditAttemptNumbering([row("u1", "p1", 1)]);
  assert.deepEqual(problems, []);
});

test("re-sitting the same paper is valid, not a problem to report", () => {
  const { problems, pairs } = auditAttemptNumbering([
    row("u1", "p1", 1),
    row("u1", "p1", 2),
    row("u1", "p1", 3),
  ]);
  assert.deepEqual(problems, [], "re-sits are supported and must not be flagged");
  assert.equal(pairs, 1);
});

test("two candidates on one paper each start from 1", () => {
  const { problems } = auditAttemptNumbering([
    row("u1", "p1", 1),
    row("u2", "p1", 1),
    row("u2", "p1", 2),
  ]);
  assert.deepEqual(problems, []);
});

test("one candidate across two papers numbers each paper separately", () => {
  const { problems } = auditAttemptNumbering([
    row("u1", "p1", 1),
    row("u1", "p2", 1),
    row("u1", "p2", 2),
  ]);
  assert.deepEqual(problems, []);
});

test("a duplicate attempt number is a problem", () => {
  const { problems } = auditAttemptNumbering([
    row("u1", "p1", 1),
    row("u1", "p1", 2),
    row("u1", "p1", 2),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /repeated/);
  assert.match(problems[0], /2/);
});

test("a gap in the sequence is a problem", () => {
  const { problems } = auditAttemptNumbering([
    row("u1", "p1", 1),
    row("u1", "p1", 3),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /gap/);
});

test("numbering that does not start at 1 is a problem", () => {
  const { problems } = auditAttemptNumbering([row("u1", "p1", 2)]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /start/);
});

test("a zero or negative attempt number is a problem", () => {
  const { problems } = auditAttemptNumbering([row("u1", "p1", 0)]);
  assert.ok(problems.length >= 1);
});

test("a score outside 0-100 is a problem", () => {
  // The table has a CHECK for this; the audit repeats it so a row that somehow
  // got in — a constraint dropped, a restore from an older dump — is visible.
  const { problems } = auditAttemptNumbering([row("u1", "p1", 1, 140)]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /score/);
});

test("an empty table is valid", () => {
  const { problems, pairs } = auditAttemptNumbering([]);
  assert.deepEqual(problems, []);
  assert.equal(pairs, 0);
});
