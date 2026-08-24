"use strict";

// What to tell a student who is watching a spinner.
//
// Marking one answer takes minutes, and until it lands the results page has
// nothing to show — the row says `grading` and nothing else. This module is the
// missing middle: while a grading run is in flight it holds how long it has been
// going and how much of the marking has come back, so the polling endpoint can
// answer "how far along is it" instead of only "not yet".
//
// ── Why in-memory, and what that costs ────────────────────────────────────
// Progress is a property of a run, not of a submission, and it is worthless
// thirty seconds after the run ends. Persisting it would mean a database write
// every few hundred tokens — a lot of traffic to power a progress bar. So it
// lives in this process's memory, with two consequences that are deliberate
// rather than overlooked:
//
//   * A run started by the CLI worker, or by another instance of the server,
//     has no entry here. `get()` returns null and the page falls back to the
//     plain "being marked" message, which is exactly what it showed before.
//   * A restart mid-run loses the progress, not the marking. The row is still
//     `grading`, the worker still finishes, the student still gets their score.
//
// Nothing here is the only copy of anything.

/** answer_id -> { startedAt, chars } for runs currently in flight. */
const inFlight = new Map();

/**
 * How long recent runs actually took, newest last. The expected duration is
 * read from this rather than hard-coded, so the estimate follows the system:
 * change the effort, the model or the rubric size and the bar re-calibrates
 * itself within a few submissions instead of lying until someone edits a
 * constant.
 */
const recentDurations = [];
const HISTORY = 10;

/** Used until this process has finished a run of its own. Deliberately on the
 *  generous side — a bar that reaches the end and then keeps waiting reads as
 *  broken, while one that arrives early reads as a pleasant surprise. */
const FALLBACK_EXPECTED_MS = 240_000;

function begin(answerId) {
  inFlight.set(answerId, { startedAt: Date.now(), chars: 0 });
}

/** Called as the marking streams back. `chars` is the running total, not a
 *  delta, so a missed call cannot make the number go backwards. */
function note(answerId, chars) {
  const entry = inFlight.get(answerId);
  if (entry) entry.chars = chars;
}

function finish(answerId, durationMs) {
  inFlight.delete(answerId);
  if (Number.isFinite(durationMs) && durationMs > 0) {
    recentDurations.push(durationMs);
    if (recentDurations.length > HISTORY) recentDurations.shift();
  }
}

/** The median of recent runs — median rather than mean because one run that
 *  hit a retry storm should not drag the estimate for the next twenty. */
function expectedMs() {
  if (!recentDurations.length) return FALLBACK_EXPECTED_MS;
  const sorted = [...recentDurations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Progress for one in-flight run, or null when this process is not the one
 * marking it.
 *
 * `percent` is capped just below the end: a run that outlives the estimate is
 * still running, and showing 100% while nothing arrives is worse than showing
 * 95% for a while.
 */
function get(answerId) {
  const entry = inFlight.get(answerId);
  if (!entry) return null;

  const elapsedMs = Date.now() - entry.startedAt;
  const expected = expectedMs();

  return {
    elapsed_ms: elapsedMs,
    expected_ms: expected,
    answer_chars: entry.chars,
    percent: Math.min(95, Math.round((elapsedMs / expected) * 100)),
  };
}

module.exports = { begin, note, finish, get, expectedMs };
