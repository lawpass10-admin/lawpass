"use strict";

// Wall-clock spans for the paths that take long enough to be worth explaining.
//
// Grading one open question is a minute-scale operation made of one very slow
// step (the model call) and several fast ones (three DB reads, a claim, a
// write). Without numbers, "grading is slow" cannot be acted on: the fix for a
// slow model call and the fix for a slow database are different fixes. These
// spans exist so the log says which one it is.
//
// Deliberately not a metrics library: one line per graded submission, printed
// through the same `[tag] EVENT key=value` console convention the rest of
// lawpass_server uses, so it is greppable in Render/Railway logs with no
// collector to run. `lib/progress.js` is the CLI-facing sibling — a ticking
// clock for a human watching a terminal — and rounds to whole seconds, which is
// too coarse to separate a 200ms query from a 20ms one.

/**
 * Start a span. Returns a function giving elapsed milliseconds since the call.
 *
 * @returns {() => number}
 */
function startSpan() {
  const started = Date.now();
  return () => Date.now() - started;
}

/** 61903 -> "61.90s". Seconds, because every span here is read next to a
 *  minute-long one and milliseconds would need counting digits. */
function secs(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

module.exports = { startSpan, secs };
