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
const { startSpan, secs } = require("../timing");
const progress = require("./progress-registry");

/**
 * One `[grade] TIMING` line per submission — the only record of how long
 * marking actually took, since the row stores `graded_at` but never a start.
 *
 * Printed for failures as well as successes: a submission that takes 90 seconds
 * to fail is a different problem from one that fails at once, and the status
 * alone does not distinguish them.
 *
 * The token counts sit on the same line on purpose. Output tokens are what a
 * long grading run is actually made of, so `out=` next to `model=` is the
 * measurement that says whether the answer is "the model is thinking too long"
 * (raise nothing, shorten the output) or "the network is slow" — and
 * `cache_read` vs `cache_write` says whether the prompt cache is earning its
 * keep or being rebuilt on every submission.
 */
function logTiming({ answerId, status, spans, usage, timings }) {
  const parts = [
    `total=${secs(spans.total)}`,
    `queued=${secs(spans.queued)}`,
    `ctx=${secs(spans.ctx)}`,
    `claim=${secs(spans.claim)}`,
    `llm=${secs(spans.llm)}`,
    `save=${secs(spans.save)}`,
  ];

  if (timings) {
    parts.push(`model=${secs(timings.model_ms)}`);
    parts.push(`parse=${secs(timings.parse_ms)}`);
    parts.push(`prompt_chars=${timings.prompt_chars}`);
    parts.push(`answer_chars=${timings.answer_chars}`);
  }

  if (usage) {
    const out = usage.output_tokens ?? 0;
    parts.push(`in=${usage.input_tokens ?? 0}`);
    parts.push(`cache_read=${usage.cache_read_input_tokens ?? 0}`);
    parts.push(`cache_write=${usage.cache_creation_input_tokens ?? 0}`);
    parts.push(`out=${out}`);
    // Output tokens per second of model time. The single most useful number
    // here: it separates "we asked for a lot of text" from "the model was slow".
    if (timings && timings.model_ms > 0) {
      parts.push(`out_tps=${(out / (timings.model_ms / 1000)).toFixed(1)}`);
    }
  }

  console.info(
    `[grade] TIMING answer=${answerId} status=${status} ${parts.join(" ")}`
  );
}

/**
 * @returns {Promise<{ok: boolean, status: string, detail?: string, score?: object, usage?: object, warnings?: string[]}>}
 */
async function gradeOne(admin, answerId, { params = {}, claim = true } = {}) {
  // Spans for the four things this function does. They are declared together
  // and defaulted to 0 so the log line has the same shape on every exit path —
  // a missing key would make the output harder to read across submissions than
  // a zero does.
  const totalSpan = startSpan();
  const spans = { total: 0, queued: 0, ctx: 0, claim: 0, llm: 0, save: 0 };

  const ctxSpan = startSpan();
  const context = await db.getGradingContext(admin, answerId);
  spans.ctx = ctxSpan();

  if (!context) return { ok: false, status: "not_found", detail: `no answer ${answerId}` };

  // How long the submission sat before marking began. On the API path this is
  // near zero — grading starts in the same request — so a large value means the
  // row was picked up later by the CLI worker, which is a completely different
  // reason for a student to have waited. Clamped at zero because `created_at`
  // comes from the database clock and this one does not.
  const createdAt = Date.parse(context.answer?.created_at ?? "");
  spans.queued = Number.isFinite(createdAt)
    ? Math.max(0, Date.now() - createdAt - spans.ctx)
    : 0;
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
    // No text, but pages: the student answered on paper. This grader reads
    // text, so it has nothing to say about the answer — and saying so as
    // `failed` would tell someone who did the work that their submission could
    // not be checked. Left `pending` instead, untouched and unclaimed, so the
    // day a grader can read the photos it is already in the queue waiting.
    const pages = Array.isArray(context.answer.hand_writing)
      ? context.answer.hand_writing.length
      : 0;
    if (pages > 0) {
      return {
        ok: false,
        status: "handwriting_only",
        detail: `answered by hand (${pages} page${pages === 1 ? "" : "s"}) — this grader reads text`,
      };
    }

    // No text and no pages: an empty row, which is a bug rather than a choice.
    await db.markGradingFailed(admin, answerId, "the stored answer has no text");
    return { ok: false, status: "empty", detail: "the stored answer has no text" };
  }

  if (claim) {
    const claimSpan = startSpan();
    const got = await db.claimForGrading(admin, answerId);
    spans.claim = claimSpan();
    if (!got) {
      return { ok: false, status: "claimed_elsewhere", detail: "another worker is grading this answer" };
    }
  }

  // Announced only once the run is genuinely about to start — after the claim,
  // so a submission another worker already holds never appears to be in flight
  // here. Retired in the `finally` below, on every path out including a throw:
  // an entry left behind would report a run that is over as still going.
  progress.begin(answerId);
  // Only a run that produced a score teaches us how long a run takes; left at
  // zero, the registry ignores it.
  let succeededInMs = 0;

  try {
    const llmSpan = startSpan();
    const { score, warnings, usage, timings } = await gradeAnswer({
      question: context.question,
      modelAnswer: context.modelAnswer,
      rubric: context.rubric,
      studentText: text,
      params,
      onProgress: ({ chars }) => progress.note(answerId, chars),
    });
    spans.llm = llmSpan();

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
      // Kept beside the usage for the same reason: logs age out of the hosting
      // provider's retention, and `score` is jsonb, so this is the one place a
      // duration survives long enough to compare last month's grading times
      // with this month's after a prompt or model change. No total — the write
      // carrying this row has not happened yet when it is assembled — but the
      // parts add up to within one DB round-trip of one.
      timing: timings ? { ...timings, db_ms: spans.ctx + spans.claim } : null,
    };

    const saveSpan = startSpan();
    await db.saveScore(admin, answerId, { score, rubricId: context.rubricId });
    spans.save = saveSpan();

    spans.total = totalSpan();
    succeededInMs = spans.total;
    logTiming({ answerId, status: "graded", spans, usage, timings });
    return { ok: true, status: "graded", score, warnings, usage };
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    // The llm span is whatever had elapsed when it threw, which is the number
    // worth having: a timeout and a rubric validation failure look identical in
    // the status and completely different here.
    if (!spans.llm) spans.llm = totalSpan() - spans.ctx - spans.claim;
    spans.total = totalSpan();
    logTiming({ answerId, status: "failed", spans });
    await db.markGradingFailed(admin, answerId, detail);
    return { ok: false, status: "failed", detail };
  } finally {
    // A failed run is not fed into the estimate: it may have died in two
    // seconds or timed out after fifteen minutes, and neither is what the next
    // student should be told to expect.
    progress.finish(answerId, succeededInMs);
  }
}

module.exports = { gradeOne };
