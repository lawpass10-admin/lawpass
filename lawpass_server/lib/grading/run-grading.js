"use strict";

// One submission, start to finish: claim it, mark it, write the score.
//
// Shared by the CLI worker and (later) the API, so the two cannot drift into
// grading the same answer by different rules. The claim/settle discipline lives
// here rather than in either caller: every path out of this function leaves the
// row in a terminal state, because a row left saying `grading` is a student
// watching a spinner that will never stop.

const db = require("../../db/grading");
const { gradeAnswer } = require("../ai/grade-answer");

/**
 * @returns {Promise<{ok: boolean, status: string, detail?: string, score?: object, usage?: object, warnings?: string[]}>}
 */
async function gradeOne(admin, answerId, { params = {}, claim = true } = {}) {
  const context = await db.getGradingContext(admin, answerId);

  if (!context) return { ok: false, status: "not_found", detail: `no answer ${answerId}` };
  if (context.blocked) {
    // Not the student's fault and not retryable by retrying — someone has to
    // approve a rubric first — so it is recorded as failed with the reason
    // rather than left pending to be picked up forever.
    await db.markGradingFailed(admin, answerId, context.blocked);
    return { ok: false, status: "blocked", detail: context.blocked };
  }
  if (context.answer.grading_status === "graded") {
    return { ok: false, status: "already_graded", detail: "this answer already has a score" };
  }

  const text = context.answer.answer_body?.text;
  if (!String(text || "").trim()) {
    await db.markGradingFailed(admin, answerId, "the stored answer has no text");
    return { ok: false, status: "empty", detail: "the stored answer has no text" };
  }

  if (claim) {
    const got = await db.claimForGrading(admin, answerId);
    if (!got) {
      return { ok: false, status: "claimed_elsewhere", detail: "another worker is grading this answer" };
    }
  }

  try {
    const { score, warnings, usage } = await gradeAnswer({
      question: context.question,
      modelAnswer: context.modelAnswer,
      rubric: context.rubric,
      studentText: text,
      params,
    });

    // Which rubric produced this score, recorded on the score itself as well as
    // on the row: the row's foreign key can be nulled if the rubric is ever
    // deleted, and the grade still has to be explainable after that.
    score.meta = {
      ...(score.meta || {}),
      rubric_id: context.rubricId,
      rubric_version: context.rubricVersion,
      attempt_number: context.answer.attempt_number,
      graded_at: new Date().toISOString(),
      // What this marking cost, kept on the row. The API path does not print the
      // usage the way the CLI does, so without this there is no way to answer
      // "what does grading cost per submission" after the fact — and the answer
      // changes with rubric size and how well the prompt cache is hitting.
      usage: usage
        ? {
            input_tokens: usage.input_tokens,
            cache_creation_input_tokens: usage.cache_creation_input_tokens,
            cache_read_input_tokens: usage.cache_read_input_tokens,
            output_tokens: usage.output_tokens,
          }
        : null,
    };

    await db.saveScore(admin, answerId, { score, rubricId: context.rubricId });
    return { ok: true, status: "graded", score, warnings, usage };
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    await db.markGradingFailed(admin, answerId, detail);
    return { ok: false, status: "failed", detail };
  }
}

module.exports = { gradeOne };
