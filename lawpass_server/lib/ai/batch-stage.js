"use strict";

// batch-stage.js — run one generation stage over either transport.
//
// WHY THIS EXISTS. The three generator CLIs each spend ~300 lines assembling
// their inputs (finding the bundle, building the locked quote bank, resolving
// the angle, loading exemplars) and writing their outputs (the generated file,
// the rejected file, the run log). All of that is worth keeping exactly as it
// is. The only thing the Batch API changes is the middle: instead of one live
// call per set, every set's request is built first, the whole lot is submitted
// as one job, and the replies are processed afterwards.
//
// So rather than a second copy of each CLI that batches, each CLI gains two
// flags and hands its one model call to this helper:
//
//   --emit-request=<file>      build the request, write it, call nothing
//   --consume-response=<file>  process a reply the runner has already collected
//
// With neither flag the CLI behaves exactly as it always has — one live call,
// same code path. That is what keeps the sequential runner trustworthy while
// the batched one is new.
//
// THE ENVELOPE. Both flags name the same file across the two passes:
//
//   pass 1 (--emit-request)      writes { request, context }
//   the runner                   adds   { message }
//   pass 2 (--consume-response)  reads  { context, message }
//
// The context is carried in the file rather than rebuilt on the second pass on
// purpose. Rebuilding would re-read a `generated/` directory that the batch is
// in the middle of filling, so the second pass would assemble its inputs from a
// world that has moved since the request was written. Carrying it makes the
// reply provably processed against the state that produced it.

const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {object}   a
 * @param {string[]} a.flags      argv entries beginning with `--`
 * @param {object}   a.args       the stage's own arguments
 * @param {Function} a.build      (args) => { request, context }
 * @param {Function} a.process    (message, context) => result   (may be async)
 * @param {Function} a.generate   (args) => result               (live transport)
 * @returns {Promise<{emitted?: true, result?: object}>}
 */
async function runStage({ flags = [], args, build, process: processMessage, generate }) {
  const valueOf = (name) =>
    flags.find((f) => f.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

  const emitTo = valueOf("emit-request");
  const consumeFrom = valueOf("consume-response");

  if (emitTo && consumeFrom) {
    throw new Error(
      "[ai] --emit-request and --consume-response are the two halves of a batched " +
        "run and cannot be given together."
    );
  }

  if (emitTo) {
    const { request, context } = build(args);
    fs.mkdirSync(path.dirname(path.resolve(emitTo)), { recursive: true });
    fs.writeFileSync(
      emitTo,
      JSON.stringify({ request, context }, null, 2) + "\n",
      "utf8"
    );
    console.log(`request written to ${emitTo} — nothing sent, nothing billed.`);
    return { emitted: true };
  }

  if (consumeFrom) {
    const envelope = JSON.parse(fs.readFileSync(consumeFrom, "utf8"));
    if (!envelope.message) {
      throw new Error(
        `[ai] ${consumeFrom} carries no \`message\` — the batch result for this ` +
          "stage was never written back into it."
      );
    }
    return { result: await processMessage(envelope.message, envelope.context) };
  }

  return { result: await generate(args) };
}

module.exports = { runStage };
