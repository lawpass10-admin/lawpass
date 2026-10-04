// generate-batch.mjs — generate N more diuni questions, retrying what the
// grounding gates reject, until the target is met.
//
//   node scripts/diuni/generate-batch.mjs                 # plan + cost, spends nothing
//   node scripts/diuni/generate-batch.mjs --go            # actually generate
//   node scripts/diuni/generate-batch.mjs --target=27 --go
//   node scripts/diuni/generate-batch.mjs --target=27 --effort=xhigh --go
//   node scripts/diuni/generate-batch.mjs --target=27 --model=claude-opus-5 --go
//   node scripts/diuni/generate-batch.mjs --target=27 --batch-api --go   # half price
//
// SAFE BY DEFAULT: without --go this reports what it would generate and what it
// would cost, and calls nothing. The generator bills real money per question;
// a wrapper that starts spending on a bare invocation is a wrapper that spends
// by accident.
//
// WHY A WRAPPER AND NOT JUST --count=27. The generator drops a question whose
// quotes do not appear verbatim in its source, or whose facts leak the case
// name — roughly one in ten. `--count=27` therefore returns 24 or 25 and stops,
// and you find out by counting files. This asks for the shortfall again until
// the target is actually met, and gives up rather than looping forever when a
// round produces nothing.
//
// ONE GENERATOR CALL PER ROUND, NOT PER QUESTION. The batch spread
// (spreadByArea) works across the whole pool it is handed, so asking for 27 at
// once spreads across 27 areas and docket types; 27 separate calls would each
// spread a batch of one. It also keeps the prompt cache warm for the run — the
// ~12.7k-token exemplar prefix is written once and read 26 times.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { acquireGeneratedLock } from "./generated-lock.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const generatedDir = join(here, "generated");

const argv = process.argv.slice(2);
const flag = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const GO = argv.includes("--go");
// Passed straight through to the generator. Half price on input and output,
// for a run that returns everything at once instead of question by question.
const BATCH_API = argv.includes("--batch-api");
const TARGET = Number(flag("target") ?? 27);
const EFFORT = flag("effort");
// Passed straight through to the generator, like --effort. Without this the
// wrapper always ran whatever the params file pinned, so there was no way to
// try a model for one batch without editing config.
const MODEL = flag("model");
const MAX_ROUNDS = Number(flag("max-rounds") ?? 6);

if (!Number.isInteger(TARGET) || TARGET < 1) {
  console.error("--target must be a positive integer");
  process.exit(1);
}

mkdirSync(generatedDir, { recursive: true });
const draftCount = () =>
  readdirSync(generatedDir).filter((f) => f.endsWith(".json")).length;

// --------------------------------------------------------------- cost
//
// Estimated from the usage actually recorded on the drafts already written,
// not from a rate card guess. Falls back to the measured figures from the
// first 13 when the folder is empty.

// Per-million-token list prices, keyed by model. This used to be one hardcoded
// set of Opus 5 numbers, which quietly over-reported the bill the moment the
// params file moved to a cheaper model — an estimate that is wrong in the
// reassuring direction is worse than no estimate.
const RATE_CARD = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};
const EXEMPLAR_PREFIX_TOKENS = 12740; // 10 exemplars + rules + guidance

/** The model this run will actually use: the flag, else the params file. */
function modelId() {
  if (MODEL) return MODEL;
  return JSON.parse(readFileSync(join(here, "diuni-LLM-Params.json"), "utf8")).model.id;
}

/** Rates for that model, or null when we have no card for it. */
function ratesFor(id) {
  return RATE_CARD[id] ?? null;
}

function measuredAverages() {
  const rows = [];
  for (const f of readdirSync(generatedDir).filter((x) => x.endsWith(".json"))) {
    try {
      const g = JSON.parse(readFileSync(join(generatedDir, f), "utf8")).generated_from;
      if (!g?.usage) continue;
      rows.push({
        kind: g.grounding_kind ?? "verdict",
        input: g.usage.input_tokens ?? 0,
        out: g.usage.output_tokens ?? 0,
      });
    } catch {
      // An unreadable draft costs us one data point, not the estimate.
    }
  }
  if (rows.length === 0) return { verdict: { input: 6350, out: 6054 }, law: { input: 695, out: 7015 } };
  const avg = (kind, field) => {
    const s = rows.filter((r) => r.kind === kind);
    const from = s.length ? s : rows;
    return from.reduce((a, r) => a + r[field], 0) / from.length;
  };
  return {
    verdict: { input: avg("verdict", "input"), out: avg("verdict", "out") },
    law: { input: avg("law", "input"), out: avg("law", "out") },
  };
}

function estimateCost(n) {
  const params = JSON.parse(readFileSync(join(here, "diuni-LLM-Params.json"), "utf8"));
  const mix = params.grounding.mix;
  const lawShare = mix.law / (mix.verdict + mix.law || 1);
  const nL = Math.round(n * lawShare);
  const nV = n - nL;
  const a = measuredAverages();

  const inTok = nV * a.verdict.input + nL * a.law.input;
  const outTok = nV * a.verdict.out + nL * a.law.out;

  // The Batch API is half price on every token type.
  const card = ratesFor(modelId());
  // No card for this model: still report the mix and the token volume, but say
  // the price is unknown instead of quoting someone else's rates for it.
  const r = card
    ? BATCH_API
      ? Object.fromEntries(Object.entries(card).map(([k, v]) => [k, v / 2]))
      : card
    : null;

  // Cache accounting, and why batching makes it a range rather than a number.
  //
  // Sequential: the first question of each grounding kind writes the exemplar
  // prefix and every later one reads it — two writes, n-2 reads.
  //
  // Batched: the requests are handed over together rather than queued behind
  // one another, so a prefix can be written by several before any of them has
  // finished writing it. The best case is still two writes; the worst is one
  // per question. Both are priced, because the truth sits between them and
  // depends on scheduling we do not control.
  const priceWith = (writes) => {
    const cw = writes * EXEMPLAR_PREFIX_TOKENS;
    const cr = Math.max(0, n - writes) * EXEMPLAR_PREFIX_TOKENS;
    return (
      (inTok / 1e6) * r.input +
      (outTok / 1e6) * r.output +
      (cw / 1e6) * r.cacheWrite +
      (cr / 1e6) * r.cacheRead
    );
  };

  const dollars = r ? priceWith(2) : null;
  // Only batching can degrade to all-writes; the sequential path cannot.
  const dollarsHigh = r ? (BATCH_API ? priceWith(n) : dollars) : null;

  return { nV, nL, outTok, dollars, dollarsHigh, priced: Boolean(r) };
}

// --------------------------------------------------------------- plan

const before = draftCount();
const est = estimateCost(TARGET);
const params = JSON.parse(readFileSync(join(here, "diuni-LLM-Params.json"), "utf8"));

console.log(`target new questions : ${TARGET}`);
console.log(`drafts already on disk: ${before}  ->  ${before + TARGET} when done`);
console.log(`model                : ${modelId()} (effort ${EFFORT ?? params.model.effort})`);
console.log(`grounding mix        : ~${est.nV} verdict, ~${est.nL} law`);
console.log(`selection            : ${params.selection.order} (spread across area + docket category)`);
console.log(`exemplars            : ${params.exemplars.count}, pick=${params.exemplars.pick}`);
console.log(`est. output tokens   : ${Math.round(est.outTok).toLocaleString()}`);
console.log(
  `transport            : ${
    BATCH_API
      ? "Batch API — half price, returns all at once"
      : "live streamed calls at list price (--batch-api halves it)"
  }`
);
console.log(
  `EST. COST            : ${
    !est.priced
      ? `unknown — no rate card for ${modelId()}; add one to RATE_CARD in this file`
      : est.dollarsHigh > est.dollars
        ? `$${est.dollars.toFixed(2)}–$${est.dollarsHigh.toFixed(2)}  (range = how much of the cached prefix is rewritten)`
        : `$${est.dollars.toFixed(2)}`
  }  (+~10% for rejected rounds)`
);
console.log(
  `EST. TIME            : ~${Math.round((TARGET * 115) / 60)} min` +
    (BATCH_API ? " of model work, delivered in one go at the end" : "")
);
console.log("");

if (BATCH_API) {
  console.log("If a round is interrupted while polling, the work is still running");
  console.log("and still billed. Collect it rather than paying for it twice:");
  console.log("  node scripts/diuni/generate-diuni-set.mjs --list-batches");
  console.log("  node scripts/diuni/generate-diuni-set.mjs --resume=<batch_id>");
  console.log("");
}

if (!GO) {
  console.log("DRY RUN — nothing generated, nothing billed.");
  console.log("Pass --go to run it.");
  process.exit(0);
}

// --------------------------------------------------------------- run

// Only one writer in generated/ at a time. A no-op when build-diuni-exam.mjs
// already holds it (it sets the pass-through env var for its own children);
// this guards the case where someone runs this script directly while a build
// is in flight.
try {
  acquireGeneratedLock(generatedDir, `generate-batch --target=${TARGET}`);
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}

let stalls = 0;
for (let round = 1; round <= MAX_ROUNDS; round++) {
  const have = draftCount() - before;
  const remaining = TARGET - have;
  if (remaining <= 0) break;

  console.log(`--- round ${round}: asking for ${remaining} ---`);
  const args = [
    join(here, "generate-diuni-set.mjs"),
    `--count=${remaining}`,
    ...(EFFORT ? [`--effort=${EFFORT}`] : []),
    ...(MODEL ? [`--model=${MODEL}`] : []),
    ...(BATCH_API ? ["--batch-api"] : []),
  ];
  const res = spawnSync(process.execPath, args, {
    cwd: appRoot,
    stdio: "inherit",
  });
  if (res.error) {
    console.error(`round ${round} could not start: ${res.error.message}`);
    break;
  }

  const gained = draftCount() - before - have;
  console.log(`--- round ${round}: +${gained} (${draftCount() - before}/${TARGET}) ---\n`);

  // A round that produces nothing means either every candidate source is
  // already used or the gates are rejecting everything. Retrying is free of
  // charge only in the first sense, so stop after two.
  if (gained === 0) {
    if (++stalls >= 2) {
      console.error("two rounds in a row produced nothing — stopping.");
      break;
    }
  } else {
    stalls = 0;
  }
}

const gainedTotal = draftCount() - before;
console.log(`\nDONE — ${gainedTotal}/${TARGET} new drafts in ${generatedDir}`);
if (gainedTotal < TARGET) {
  console.log("Short of target. Check the rejection reasons above, or widen");
  console.log("selection (min_text_chars, exclude_areas) in diuni-LLM-Params.json.");
}
console.log("\nNext:");
console.log("  node scripts/diuni/measure-spread.mjs          # appeal ratio + concept spread");
console.log("  node scripts/diuni/load-diuni-questions.mjs --update=<question_id> --commit");
