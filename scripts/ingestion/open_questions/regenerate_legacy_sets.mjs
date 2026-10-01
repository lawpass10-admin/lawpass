// regenerate_legacy_sets.mjs — rebuild questions written under an older prompt.
//
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs            # plan only
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs --commit   # do it
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs --commit --retire
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs --limit=2 --commit
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs --commit --parallel
//   node scripts/ingestion/open_questions/regenerate_legacy_sets.mjs --commit --parallel=2
//
// WHAT "CONVERT" MEANS HERE, because it is not what the word suggests. There is
// no transformation that turns a question written under open-question-angle/2
// into one written under /3: the prompt is what produced the text, so the only
// way to have the new prompt's output is to run it. This script therefore
// REGENERATES — same source paper, same pipeline as a fresh set, a new angle
// letter — and the result is a NEW question, not the old one upgraded. Nothing
// about the old row's wording survives.
//
// WHICH ROWS. Every `type='new'` row whose generation_meta.prompt_version is not
// the version the generator currently emits, read out of
// lawpass_server/lib/ai/generate-open-question.js so this cannot drift from it.
// `type='source'` rows are the real exam papers and are never touched.
//
// A NEW ANGLE LETTER, NOT THE OLD ONE. Reusing the old letter would have the
// generator overwrite the files the old row was loaded from, which are its only
// provenance. nextAngle() allocates the next free letter, counting both what is
// on disk and what this run has already claimed.
//
// THE OLD ROWS SURVIVE BY DEFAULT. --retire deletes a superseded row, and only
// after its replacement is in the table: the two are never both absent. Without
// the flag you get both, and can compare them before deciding — which is the
// right default when the new text has not been read by anyone yet.
//
// ---------------------------------------------------------------------------
// --parallel: LANES, ONE PER SOURCE PAPER
// ---------------------------------------------------------------------------
//
// Sets are grouped by the paper they come from. Lanes run at the same time; the
// sets INSIDE a lane run one after another. That shape is not a compromise, it
// is the only correct one, and the reason is angle awareness.
//
// generate-open-question.js calls loadExistingAngles() and tells the model which
// angles on this paper have already been written, so it does not write the same
// one again. It reads them OFF DISK at the moment the question stage starts. Run
// four angles of one paper simultaneously and each sees only what existed before
// they all began — none of them knows the other three are being written. The
// likeliest result is two or three near-identical questions, which is precisely
// what a batch of fresh angles exists to avoid. Keeping a paper's sets in one
// sequential lane means each still sees its predecessor's angle.
//
// It also removes a file race for free: sources/<id>.source.json is keyed by the
// paper, not the angle, and is rewritten by every set. Two sets on one paper are
// never in flight together here, so nothing reads it while it is being written.
//
// THE SPEEDUP IS BOUNDED BY THE LONGEST LANE, not by the number of sets — within
// a set, question -> answer -> rubric is strictly sequential and there is nothing
// to overlap. Seven sets spread over papers as 4/2/1 take about as long as the
// four, not a seventh of the total. The plan prints the lane shape and the
// estimate before anything is spent.
//
// --parallel      every lane at once
// --parallel=N    at most N lanes at once; the longest lanes start first, which
//                 is what keeps a narrow pool from finishing early and waiting
// (no flag)       one set at a time, output straight to the terminal
//
// EACH LANE WRITES ITS OWN LOG under logs/, because several children sharing one
// stdout produce a transcript nobody can read — and an unreadable transcript is
// how a failure goes unexplained. The console shows one line per stage per lane;
// the detail is in the log.
//
// CTRL-C IS LESS TIDY IN PARALLEL. Sequentially you can stop between sets. With
// lanes running, an interrupt arrives while several children are mid-call: each
// set is still all-or-nothing against the database, so nothing is left
// half-loaded, but you will have part-written files in generated/ for whichever
// sets were in flight. They are overwritten by the next run of the same angle.
//
// COSTS REAL MONEY AND REAL TIME. Each set is three Opus calls; reckon on eight
// to eleven minutes and roughly 90-100k tokens. Without --commit nothing runs
// and nothing is spent. Parallel lanes do not cost less — they cost the same in
// tokens and less in wall clock.

import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rotation, nextAngle } from './set_plan.mjs';
import { generateSet } from './set_runner.mjs';
import { laneize, laneWorkers, estimateMinutes, runLanes, mmss } from './set_lanes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const generatedDir = join(here, 'generated');
const logsDir = join(here, 'logs');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const retire = argv.includes('--retire');
const limitArg = argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

// --parallel / --parallel=N. Validated here rather than left to produce a pool
// of NaN workers, which silently runs nothing.
const parallelArg = argv.find((a) => a === '--parallel' || a.startsWith('--parallel='));
const parallel = Boolean(parallelArg);
let laneLimit = Infinity;
if (parallelArg?.startsWith('--parallel=')) {
  laneLimit = Number(parallelArg.split('=')[1]);
  if (!Number.isInteger(laneLimit) || laneLimit < 1) {
    console.error(`--parallel=${parallelArg.split('=')[1]} is not a whole number of lanes.`);
    process.exit(2);
  }
}

const RUN_STARTED = Date.now();
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

/** Minutes a set takes, for the estimate only. */
const MINUTES_PER_SET = 9;

/**
 * The prompt version the generator emits TODAY, read from its source.
 *
 * Parsed rather than hard-coded so this script cannot quietly disagree with the
 * generator about what "current" means — the day someone bumps the prompt to /4
 * and forgets this file, the regex still finds it. It fails loudly if the shape
 * changes, which is better than silently treating every row as up to date and
 * reporting that there is nothing to do.
 */
function currentPromptVersion() {
  const file = join(serverDir, 'lib', 'ai', 'generate-open-question.js');
  const src = readFileSync(file, 'utf8');
  const m = /prompt_version:\s*["']([^"']+)["']/.exec(src);
  if (!m) {
    console.error(`could not read prompt_version from ${relative(appRoot, file)}`);
    console.error('The constant moved or changed shape — fix this regex before trusting the plan.');
    process.exit(2);
  }
  return m[1];
}

async function connect() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('neither DIRECT_URL nor DATABASE_URL is set');
    process.exit(2);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Delete a superseded row, AFTER its replacement loaded.
 *
 * Not fatal on failure: the replacement is in the table, which is the part that
 * matters. The stale row can be deleted by hand.
 */
async function retireRow(step, say) {
  const client = await connect();
  try {
    await client.query('DELETE FROM public.open_questions WHERE open_question_id = $1', [
      step.row.open_question_id,
    ]);
    say(`retired ${String(step.row.open_question_id).slice(0, 8)}`);
  } catch (error) {
    say(`WARNING: could not retire ${String(step.row.open_question_id).slice(0, 8)} — ${error.message}`);
  } finally {
    await client.end();
  }
}

// ------------------------------------------------------------------ main

const current = currentPromptVersion();
const sources = rotation();
const byId = new Map(sources.map((s) => [s.id, s]));

const db = await connect();
let stale;
try {
  const { rows } = await db.query(
    `SELECT open_question_id,
            created_at,
            generation_meta->>'prompt_version'     AS prompt_version,
            generation_meta->>'source_external_id' AS source_id,
            generation_meta->>'angle_letter'       AS old_angle
       FROM public.open_questions
      WHERE type = 'new'
        AND COALESCE(generation_meta->>'prompt_version', '') <> $1
      ORDER BY created_at`,
    [current]
  );
  stale = rows;
} finally {
  await db.end();
}

console.log(`current prompt : ${current}`);
console.log(`stale rows     : ${stale.length}`);

if (!stale.length) {
  console.log('\nNothing to regenerate — every generated question is on the current prompt.');
  process.exit(0);
}

// A row whose source bundle is gone cannot be regenerated: the question was
// written from that paper and there is nothing else to write the new one from.
// Reported rather than skipped silently, because it means a bundle was deleted
// after it was used and that is worth knowing.
const orphans = stale.filter((r) => !r.source_id || !byId.has(r.source_id));
const doable = stale.filter((r) => r.source_id && byId.has(r.source_id)).slice(0, limit);

// Angles are allocated for the WHOLE run before anything starts, by one planner
// holding one `claimed` set. That is what makes the parallel path safe: no lane
// ever asks for a letter, so two lanes cannot be handed the same one.
const claimed = new Set();
const steps = doable.map((row, i) => ({
  n: i + 1,
  row,
  source: byId.get(row.source_id),
  angle: nextAngle(row.source_id, claimed),
}));

console.log(`\nplan — ${steps.length} set(s) to regenerate:`);
for (const s of steps) {
  console.log(
    `  ${String(s.n).padStart(3)}. ${s.row.source_id}-${s.angle}` +
      `   replaces ${String(s.row.open_question_id).slice(0, 8)}` +
      ` (${s.row.prompt_version ?? 'no version'}, angle ${s.row.old_angle ?? '?'},` +
      ` ${s.row.created_at.toISOString().slice(0, 10)})`
  );
}
if (orphans.length) {
  console.log(`\n${orphans.length} row(s) cannot be regenerated — their source bundle is gone:`);
  for (const o of orphans) {
    console.log(`  ${String(o.open_question_id).slice(0, 8)}  source_external_id=${o.source_id ?? '(none)'}`);
  }
}

// ------------------------------------------------------------------ lanes

const lanes = laneize(steps, (s) => s.row.source_id);
const workers = laneWorkers(lanes, laneLimit);
const estimateMin = parallel
  ? estimateMinutes({ lanes, workers, setCount: steps.length, minutesPerSet: MINUTES_PER_SET })
  : steps.length * MINUTES_PER_SET;

console.log(`\nlanes — one per source paper, ${lanes.length} in all:`);
for (const lane of lanes) {
  console.log(
    `  ${lane.source.padEnd(12)} ${lane.steps.length} set(s)   ` +
      lane.steps.map((s) => `${s.row.source_id}-${s.angle}`).join(' → ')
  );
}

console.log(
  `\nmode            : ${
    parallel
      ? `PARALLEL, ${workers} lane(s) at a time${laneLimit === Infinity ? '' : ` (--parallel=${laneLimit})`}`
      : 'sequential, one set at a time'
  }`
);
console.log(`estimate        : ~${estimateMin} min (${steps.length} set(s) × ~${MINUTES_PER_SET} min each)`);
console.log(
  `old rows        : ${retire ? 'DELETED after their replacement loads' : 'kept (pass --retire to delete)'}`
);

if (!commit) {
  console.log('\nPLAN ONLY — nothing ran, nothing was spent. Pass --commit to regenerate.');
  process.exit(0);
}

mkdirSync(logsDir, { recursive: true });

const results = [];

// ------------------------------------------------------- sequential driver

async function runSequentially() {
  console.log(
    `\nEach set is three Opus calls — roughly 8-11 minutes and ~90-100k tokens. ` +
      `${steps.length} set(s) ahead. Stop with Ctrl-C between sets.\n`
  );

  for (const step of steps) {
    console.log('═'.repeat(64));
    console.log(
      `SET ${step.n}/${steps.length} — ${step.row.source_id}-${step.angle}   (elapsed ${mmss(Date.now() - RUN_STARTED)})`
    );

    const started = Date.now();
    const outcome = generateSet(step);
    results.push({ step, outcome, took: mmss(Date.now() - started) });

    if (!outcome.ok) {
      console.log(`  FAILED at ${outcome.at}: ${outcome.detail}`);
      console.log('  The old row is untouched.');
      continue;
    }

    // Retirement happens per set and only after that set loaded, so an
    // interrupted run never leaves a question with neither version present.
    if (retire) await retireRow(step, (m) => console.log(`  ${m}`));
  }
}

// --------------------------------------------------------- parallel driver

async function runInLanes() {
  console.log(
    `\n${steps.length} set(s) over ${lanes.length} lane(s), ${workers} running at a time. ` +
      `Each set is three Opus calls; tokens cost the same as sequential, wall clock does not.\n` +
      `Per-lane detail goes to logs/lane-<paper>-${STAMP}.log — the console shows stage changes only.\n`
  );

  const records = await runLanes({
    lanes,
    workers,
    logsDir,
    stamp: STAMP,
    startedAt: RUN_STARTED,
    labelOf: (step) => `${step.row.source_id}-${step.angle}`,
    // Retirement happens per set and only after that set loaded, so an
    // interrupted run never leaves a question with neither version present.
    onSet: async ({ step, outcome }, say) => {
      if (!outcome.ok) {
        say('the old row is untouched');
        return;
      }
      if (retire) await retireRow(step, (m) => say(m));
    },
  });

  for (const r of records) {
    results.push({ step: r.step, outcome: r.outcome, took: r.took, log: relative(appRoot, r.log) });
  }
}

if (parallel) {
  await runInLanes();
} else {
  await runSequentially();
}

// ---------------------------------------------------------------- report

// Parallel lanes finish out of order; the report is read by a person, so it is
// put back into plan order.
results.sort((a, b) => a.step.n - b.step.n);

const ok = results.filter((r) => r.outcome.ok);
const partial = results.filter((r) => !r.outcome.ok && r.outcome.partial);

console.log('\n' + '═'.repeat(64));
console.log(
  `${ok.length} out of ${steps.length} set(s) regenerated and loaded, total ${mmss(Date.now() - RUN_STARTED)}`
);
for (const r of results) {
  const label = `${r.step.row.source_id}-${r.step.angle}`.padEnd(14);
  if (r.outcome.ok) console.log(`  ok       ${label} ${r.took}`);
  else if (r.outcome.partial) console.log(`  PARTIAL  ${label} ${r.took}  ${r.outcome.detail}`);
  else console.log(`  FAILED   ${label} ${r.took}  at ${r.outcome.at}: ${r.outcome.detail}`);
}

if (partial.length) {
  console.log(
    `\nNEEDS A HAND: ${partial.length} set(s) put a question in the table without its rubric. ` +
      `Until the rubric is loaded those questions cannot be graded — run the command printed above for each.`
  );
}

const reportPath = join(logsDir, `regenerate-${STAMP}.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      ran_at: new Date().toISOString(),
      duration: mmss(Date.now() - RUN_STARTED),
      current_prompt_version: current,
      mode: parallel ? 'parallel' : 'sequential',
      lanes: lanes.map((l) => ({ source: l.source, sets: l.steps.length })),
      lane_workers: parallel ? workers : 1,
      retired: retire,
      results: results.map((r) => ({
        replaced_open_question_id: r.step.row.open_question_id,
        replaced_prompt_version: r.step.row.prompt_version,
        source_external_id: r.step.row.source_id,
        new_angle: r.step.angle,
        ok: r.outcome.ok,
        partial: r.outcome.partial ?? false,
        at: r.outcome.at ?? null,
        detail: r.outcome.detail ?? null,
        took: r.took,
        log: r.log ?? null,
      })),
      orphans: orphans.map((o) => o.open_question_id),
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(`\nreport: ${relative(appRoot, reportPath)}`);
console.log(`files : ${relative(appRoot, generatedDir)}`);
console.log('\nEvery new row is a DRAFT. Nothing reaches a student before a human approves it.');

// Non-zero if anything did not land whole, so a scheduled run fails loudly.
if (results.length !== ok.length) process.exitCode = 1;
