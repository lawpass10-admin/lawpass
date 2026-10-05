"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { getGradeCount, getGradeQuota, recordGrade } = require("./open-question-grade-counts");
const { env } = require("../config/env");

/** A stub of the PostgREST chain the reader uses, ending in maybeSingle(). */
function stubClient({ row = null, error = null } = {}) {
  const calls = [];
  const chain = {
    select: () => chain,
    eq: (column, value) => {
      calls.push([column, value]);
      return chain;
    },
    maybeSingle: async () => ({ data: row, error }),
  };
  return { calls, from: () => chain };
}

/** Run one assertion with a temporary limit, then put the real one back. */
function withLimit(limit, fn) {
  const previous = env.openQuestions.maxGradesPerQuestion;
  env.openQuestions.maxGradesPerQuestion = limit;
  try {
    return fn();
  } finally {
    env.openQuestions.maxGradesPerQuestion = previous;
  }
}

test("a student with no counter row has spent nothing", async () => {
  const client = stubClient({ row: null });
  assert.equal(await getGradeCount(client, "u1", "q1"), 0);
});

test("the count is scoped to one student and one question", async () => {
  const client = stubClient({ row: { no_of_grades: 2 } });
  await getGradeCount(client, "u1", "q1");
  assert.deepEqual(client.calls, [
    ["user_id", "u1"],
    ["open_question_id", "q1"],
  ]);
});

test("a read failure throws rather than reading as zero", async () => {
  // The tempting shortcut is to treat an unreadable counter as 0 so a database
  // hiccup never blocks a submission. That makes the one check standing
  // between us and unbounded model spend fail OPEN exactly when it matters.
  const client = stubClient({ error: { message: "connection reset" } });
  await assert.rejects(() => getGradeCount(client, "u1", "q1"));
});

test("the quota is spent at the limit, not past it", async () => {
  await withLimit(1, async () => {
    const fresh = await getGradeQuota(stubClient({ row: null }), "u1", "q1");
    assert.equal(fresh.exhausted, false);
    assert.equal(fresh.remaining, 1);

    const used = await getGradeQuota(stubClient({ row: { no_of_grades: 1 } }), "u1", "q1");
    assert.equal(used.exhausted, true, "one grade used out of one is exhausted");
    assert.equal(used.remaining, 0);
  });
});

test("raising the limit reopens a question that was exhausted", async () => {
  // The whole point of the env knob: the count stays, the allowance moves.
  const client = () => stubClient({ row: { no_of_grades: 1 } });
  await withLimit(1, async () => {
    assert.equal((await getGradeQuota(client(), "u1", "q1")).exhausted, true);
  });
  await withLimit(3, async () => {
    const quota = await getGradeQuota(client(), "u1", "q1");
    assert.equal(quota.exhausted, false);
    assert.equal(quota.remaining, 2);
  });
});

test("a counter already over the limit never reports negative headroom", async () => {
  // Reachable when the limit is lowered after grades were spent at the old one.
  await withLimit(1, async () => {
    const quota = await getGradeQuota(stubClient({ row: { no_of_grades: 5 } }), "u1", "q1");
    assert.equal(quota.exhausted, true);
    assert.equal(quota.remaining, 0, "remaining is clamped, not -4");
  });
});

test("recording a grade goes through the RPC, not a read-modify-write", async () => {
  // Two gradings finishing together must not both read the same number and
  // both write it back plus one. The single-statement RPC is what prevents it,
  // so the call shape is worth pinning down.
  let received = null;
  const admin = {
    rpc: async (name, args) => {
      received = { name, args };
      return { data: 2, error: null };
    },
  };

  const total = await recordGrade(admin, {
    userId: "u1",
    openQuestionId: "q1",
    answerId: "a1",
  });

  assert.equal(total, 2);
  assert.equal(received.name, "record_open_question_grade");
  assert.deepEqual(received.args, {
    p_user_id: "u1",
    p_open_question_id: "q1",
    p_answer_id: "a1",
  });
});
