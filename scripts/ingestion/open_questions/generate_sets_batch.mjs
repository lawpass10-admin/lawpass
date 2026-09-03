// generate_sets_batch.mjs — generate_sets.mjs at half price, via the Batch API.
//
//   node scripts/ingestion/open_questions/generate_sets_batch.mjs 12        # plan + cost
//   node scripts/ingestion/open_questions/generate_sets_batch.mjs 12 --go   # run it
//   node scripts/ingestion/open_questions/generate_sets_batch.mjs --list-batches
//   node scripts/ingestion/open_questions/generate_sets_batch.mjs --resume=<run_id>
//
// SAFE BY DEFAULT: without --go this prints the plan and the estimate and calls
// nothing. Generation bills real money; a runner that starts spending on a bare
// invocation is one that spends by accident.
//
// WHY THIS EXISTS ALONGSIDE generate_sets.mjs, NOT INSTEAD OF IT.
//
// A set is three model calls that strictly depend on one another: the answer
// needs the question, the rubric needs the answer. Nothing inside a single set
// can be batched. What CAN be batched is one stage across many sets — every
// question together, then every answer, then every rubric — and that only pays
// once there are enough sets to fill a batch. For one or two sets this runner is
// slower than the sequential one for a saving of about a pound, so the
// sequential runner remains the default and this is the one you reach for at
// volume.
//
// The shape, for N sets:
//
//   adapt      N bundles -> sources/<id>.source.json        (local, no calls)
//   QUESTION   build N requests -> one batch -> process N    <- 50% off
//   ANSWER     build N requests -> one batch -> process N    <- 50% off
//   RUBRIC     build N requests -> one batch -> process N    <- 50% off
//   render + load, per set, sequentially                     (local + DB)
//
// Three barriers, because the stages are dependent. A set that fails or is
// rejected at one stage drops out and the remaining sets carry on — the same
// promise generate_sets.mjs makes, applied per stage rather than per set.
//
// HOW THE STAGES ARE DRIVEN. Not reimplemented here. Each generator CLI already
// assembles its own inputs and writes its own outputs, and it keeps doing both:
// this runner invokes it twice per stage, once with --emit-request=<envelope> to
// build the request without sending it, and once with --consume-response=<same
// envelope> after the batch has come back. See lawpass_server/lib/ai/batch-stage.js.
//
// THE RUN DIRECTORY. Everything a run needs to be resumed lives in
// generated/.batches/<run_id>/: the envelopes, and state.json recording which
// stage each set has reached and which batch ids have been submitted. An
// interrupted run is collected with --resume rather than paid for twice.

import dotenv from 'dotenv';
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { rotation, plan } from './set_plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const sourcesDir = join(here, 'sources');
const generatedDir = join(here, 'generated');
const runsDir = join(generatedDir, '.batches');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const GO = argv.includes('--go');
const RESUME = flag('resume');
const LIST = argv.includes('--list-batches');

const mmss = (ms) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

// --------------------------------------------------------------- stages

/**
 * The three batched stages, in the order they must run.
 *
 * `cli` is invoked from serverDir; `args(step)` produces its positional
 * arguments. Each stage names the file it must have produced, which is what the
 * runner checks rather than trusting an exit code.
 */
const STAGES = [
  {
    key: 'question',
    label: 'question',
    cli: join(serverDir, 'scripts', 'generate-open-question.js'),
    args: (s) => [join(sourcesDir, `${s.source.id}.source.json`), s.source.id, s.angle],
    output: (s) => join(generatedDir, `${s.source.id}-${s.angle}.generated.json`),
  },
  {
    key: 'answer',
    label: 'answer',
    cli: join(serverDir, 'scripts', 'generate-open-answer.js'),
    args: (s) => [
      join(generatedDir, `${s.source.id}-${s.angle}.generated.json`),
      join(sourcesDir, `${s.source.id}.source.json`),
    ],
    output: (s) => join(generatedDir, `${s.source.id}-${s.angle}.answer.json`),
  },
  {
    key: 'rubric',
    label: 'rubric',
    cli: join(serverDir, 'scripts', 'generate-rubric.js'),
    args: (s) => [join(generatedDir, `${s.source.id}-${s.angle}.answer.json`)],
    output: (s) => join(generatedDir, `${s.source.id}-${s.angle}.rubric.json`),
  },
];

const baseOf = (s) => `${s.source.id}-${s.angle}`;

/** Run a child process, streaming its output. Returns the exit status. */
function run(script, args, cwd = appRoot) {
  const res = spawnSync('node', [script, ...args], { cwd, stdio: 'inherit' });
  return res.status ?? 1;
}

/** Quietly, for the emit pass — N of these would otherwise bury the terminal. */
function runQuiet(script, args, cwd = appRoot) {
  const res = spawnSync('node', [script, ...args], { cwd, encoding: 'utf8' });
  return { status: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

// ----------------------------------------------------------- run state

const stateFileFor = (runId) => join(runsDir, runId, 'state.json');
const envelopeFor = (runId, stageKey, base) =>
  join(runsDir, runId, `${base}.${stageKey}.json`);

function saveState(state) {
  mkdirSync(join(runsDir, state.run_id), { recursive: true });
  writeFileSync(stateFileFor(state.run_id), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function loadState(runId) {
  const p = stateFileFor(runId);
  if (!existsSync(p)) {
    console.error(`no run state for ${runId}.`);
    console.error(`looked in: ${p}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

// --------------------------------------------------------------- list

if (LIST) {
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    : [];
  if (!runs.length) {
    console.log(`no batch runs in ${runsDir}`);
    process.exit(0);
  }
  console.log(`batch runs in ${runsDir}:\n`);
  for (const d of runs) {
    try {
      const st = JSON.parse(readFileSync(stateFileFor(d.name), 'utf8'));
      const done = st.steps.filter((s) => s.done).length;
      console.log(
        `  ${st.run_id}\n    ${st.steps.length} set(s), started ${st.started_at}, ` +
          `stage "${st.stage}", ${done} complete`
      );
    } catch {
      console.log(`  ${d.name} — unreadable state.json`);
    }
  }
  console.log('\nCollect one with --resume=<run_id>.');
  process.exit(0);
}

// --------------------------------------------------------------- cost
//
// Measured from the run log of the sequential runner where one exists, so the
// estimate is this pipeline's own history rather than a rate-card guess.

const RATES = { input: 5, output: 25 };
// Per set, three Opus calls. Output is measured (26,457 across question, answer
// and rubric); input is what reconciles that output to the $1.17 a set actually
// billed, and it agrees with the "roughly 90-100k tokens per set" in the header
// of generate_sets.mjs. An earlier 70k guess here under-reported by ~15%.
const PER_SET = { input: 101_500, output: 26_500 };

function estimate(n) {
  const live =
    (n * PER_SET.input * RATES.input) / 1e6 + (n * PER_SET.output * RATES.output) / 1e6;
  return { live, batched: live / 2 };
}

// ---------------------------------------------------------------- plan

const sources = rotation();
if (!sources.length) {
  console.error('no usable bundles under answers/pages/');
  process.exit(2);
}

let state;

if (RESUME) {
  state = loadState(RESUME);
  console.log(`resuming run ${state.run_id} (started ${state.started_at})`);
  console.log(`  sets  : ${state.steps.length}`);
  console.log(`  stage : ${state.stage}\n`);
} else {
  const [countArg] = argv.filter((a) => !a.startsWith('--'));
  const count = Number(countArg);
  if (!Number.isInteger(count) || count < 1) {
    console.error('usage: generate_sets_batch.mjs <count> [--go]');
    console.error('       generate_sets_batch.mjs --resume=<run_id>');
    console.error('       generate_sets_batch.mjs --list-batches');
    process.exit(2);
  }

  const steps = plan(count, sources).map((s) => ({
    n: s.n,
    source: s.source,
    angle: s.angle,
    base: baseOf(s),
    done: false,
    failedAt: null,
  }));

  const est = estimate(count);
  console.log(`\n${sources.length} source paper(s) available, newest first:`);
  for (const s of sources) console.log(`  ${s.id.padEnd(12)} ${s.folder}`);
  console.log(`\nplan — ${count} set(s):`);
  for (const s of steps) console.log(`  ${String(s.n).padStart(3)}. ${s.source.id}-${s.angle}`);
  console.log('');
  console.log(`transport   : Batch API — 3 batches (question, answer, rubric)`);
  console.log(`est. live   : $${est.live.toFixed(2)}`);
  console.log(`EST. BATCHED: $${est.batched.toFixed(2)}   (~$${(est.live - est.batched).toFixed(2)} saved)`);
  console.log('');

  if (!GO) {
    console.log('DRY RUN — nothing generated, nothing billed.');
    console.log('Pass --go to run it.');
    process.exit(0);
  }

  // A run id that sorts chronologically and is safe in a filename.
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  state = { run_id: runId, started_at: new Date().toISOString(), stage: 'adapt', steps };
  saveState(state);
  console.log(`run ${runId}\n`);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set — add it to app/.env.local.');
  process.exit(2);
}

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 6,
  timeout: 15 * 60 * 1000,
});

const live = () => state.steps.filter((s) => !s.failedAt);

// --------------------------------------------------------------- adapt

if (state.stage === 'adapt') {
  console.log('── adapting bundles ' + '─'.repeat(45));
  for (const s of live()) {
    const r = runQuiet(join(here, 'generate_from_source.mjs'), [
      `--folder=${s.source.folder}`,
      `--angle=${s.angle}`,
      '--adapt-only',
    ]);
    if (r.status !== 0) {
      s.failedAt = 'adapt';
      console.log(`  ${s.base}: FAILED to adapt`);
      console.log(r.out.split('\n').slice(-6).join('\n'));
    } else {
      console.log(`  ${s.base}: adapted`);
    }
  }
  state.stage = 'question';
  saveState(state);
  console.log('');
}

// ------------------------------------------------------------- batching

/**
 * Submit one stage for every still-live set, wait, and process the replies.
 *
 * Each set is emitted, batched and consumed by its own CLI, so validation,
 * rejection files and run logs are produced exactly as they are in a sequential
 * run. A set that fails at any point in the stage is marked and skipped from
 * here on; the rest of the run continues without it.
 */
async function runStage(stage) {
  const steps = live().filter((s) => !s.done);
  if (!steps.length) return;

  console.log(`── ${stage.label}: building ${steps.length} request(s) ` + '─'.repeat(30));

  const submitted = [];
  for (const s of steps) {
    const envelope = envelopeFor(state.run_id, stage.key, s.base);
    const r = runQuiet(stage.cli, [...stage.args(s), `--emit-request=${envelope}`], serverDir);
    if (r.status !== 0 || !existsSync(envelope)) {
      s.failedAt = `${stage.key} (build)`;
      console.log(`  ${s.base}: FAILED to build — ${r.out.trim().split('\n').slice(-2).join(' ')}`);
      continue;
    }
    submitted.push({ step: s, envelope });
  }
  if (!submitted.length) {
    console.log('  nothing to submit at this stage.');
    state.stage = nextStageKey(stage.key);
    saveState(state);
    return;
  }

  // Reuse the batch already submitted for this stage if we are resuming into
  // the middle of it, rather than paying for the same requests twice.
  const existingId = state.batches?.[stage.key];
  let batch;
  if (existingId) {
    batch = await anthropic.messages.batches.retrieve(existingId);
    console.log(`  reusing batch ${batch.id} (${batch.processing_status})`);
  } else {
    const requests = submitted.map(({ step, envelope }) => ({
      custom_id: step.base.replace(/[^a-zA-Z0-9_-]/g, '_'),
      params: JSON.parse(readFileSync(envelope, 'utf8')).request,
    }));
    batch = await anthropic.messages.batches.create({ requests });
    state.batches = { ...(state.batches ?? {}), [stage.key]: batch.id };
    saveState(state);
    console.log(`  batch ${batch.id} submitted — ${requests.length} request(s)`);
    console.log(`  if interrupted:  --resume=${state.run_id}`);
  }

  const startedAt = Date.now();
  let status = batch;
  while (status.processing_status !== 'ended') {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await anthropic.messages.batches.retrieve(batch.id);
    const c = status.request_counts ?? {};
    process.stdout.write(
      `\r  ${status.processing_status}: ${c.succeeded ?? 0} done, ${c.processing ?? 0} running, ` +
        `${c.errored ?? 0} errored  [${mmss(Date.now() - startedAt)}]   `
    );
  }
  process.stdout.write('\n');

  // Write each reply back into its envelope, then let the CLI consume it.
  const byId = new Map(submitted.map(({ step, envelope }) => [
    step.base.replace(/[^a-zA-Z0-9_-]/g, '_'),
    { step, envelope },
  ]));

  for await (const entry of await anthropic.messages.batches.results(batch.id)) {
    const hit = byId.get(entry.custom_id);
    if (!hit) continue;
    if (entry.result.type !== 'succeeded') {
      hit.step.failedAt = `${stage.key} (${entry.result.type})`;
      console.log(`  ${hit.step.base}: ${entry.result.type}`);
      continue;
    }
    const envelope = JSON.parse(readFileSync(hit.envelope, 'utf8'));
    envelope.message = entry.result.message;
    writeFileSync(hit.envelope, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
    hit.step.gotMessage = true;
  }

  console.log(`── ${stage.label}: processing replies ` + '─'.repeat(32));
  for (const { step, envelope } of submitted) {
    if (step.failedAt) continue;
    if (!step.gotMessage) {
      step.failedAt = `${stage.key} (no reply)`;
      console.log(`  ${step.base}: no reply returned`);
      continue;
    }
    const status2 = run(stage.cli, [...stage.args(step), `--consume-response=${envelope}`], serverDir);
    if (status2 !== 0 || !existsSync(stage.output(step))) {
      step.failedAt = `${stage.key} (rejected)`;
      console.log(`  ${step.base}: rejected or not written — see generated/rejected/`);
    }
  }

  state.stage = nextStageKey(stage.key);
  saveState(state);
  console.log('');
}

function nextStageKey(key) {
  const i = STAGES.findIndex((s) => s.key === key);
  return i === STAGES.length - 1 ? 'load' : STAGES[i + 1].key;
}

for (const stage of STAGES) {
  const order = ['question', 'answer', 'rubric', 'load'];
  if (order.indexOf(state.stage) > order.indexOf(stage.key)) continue; // already past it
  await runStage(stage);
}

// ---------------------------------------------------------- render + load
//
// Unchanged from the sequential runner and deliberately still sequential: these
// are local renders and database writes, they cost nothing per call, and the
// load order is what keeps a question and its rubric together.

console.log('── rendering and loading ' + '─'.repeat(40));
for (const s of live()) {
  const base = s.base;
  const sourceFile = join(sourcesDir, `${s.source.id}.source.json`);
  const questionJson = join(generatedDir, `${base}.generated.json`);
  const answerJson = join(generatedDir, `${base}.answer.json`);
  const rubricJson = join(generatedDir, `${base}.rubric.json`);

  const missing = [
    ['question', questionJson],
    ['answer', answerJson],
    ['rubric', rubricJson],
  ].filter(([, p]) => !existsSync(p)).map(([n]) => n);
  if (missing.length) {
    s.failedAt ??= `incomplete (${missing.join(', ')})`;
    console.log(`  ${base}: incomplete — ${missing.join(', ')} missing, nothing loaded`);
    continue;
  }

  if (run(join(serverDir, 'scripts', 'render-open-question-pdf.js'), [questionJson, sourceFile, '--html-only'], serverDir) !== 0) {
    s.failedAt = 'question html';
    continue;
  }
  if (run(join(serverDir, 'scripts', 'render-open-answer-pdf.js'), [answerJson, sourceFile, '--html-only'], serverDir) !== 0) {
    s.failedAt = 'answer html';
    continue;
  }
  if (run(join(here, 'load_generated_questions.mjs'), [`${base}.answer.json`, '--commit']) !== 0) {
    s.failedAt = 'database';
    continue;
  }
  if (run(join(here, 'load_rubric.mjs'), [`${base}.rubric.json`, '--commit']) !== 0) {
    // The one stage that cannot be atomic: the rubric row is looked up by the
    // question row, so the question goes in first. Reported apart from a plain
    // failure because the fix is different — only the rubric is missing.
    s.failedAt = 'database (PARTIAL — question loaded, rubric not)';
    console.log(
      `  ${base}: PARTIAL — finish with:\n` +
        `    node scripts/ingestion/open_questions/load_rubric.mjs ${base}.rubric.json --commit`
    );
    continue;
  }
  s.done = true;
  console.log(`  ${base}: loaded`);
}

state.stage = 'done';
saveState(state);

// -------------------------------------------------------------- summary

const ok = state.steps.filter((s) => s.done);
const bad = state.steps.filter((s) => !s.done);
console.log(`\n${ok.length}/${state.steps.length} set(s) complete.`);
for (const s of bad) console.log(`  ${s.base}: ${s.failedAt ?? 'not finished'}`);
console.log(`\nrun state: ${relative(appRoot, stateFileFor(state.run_id))}`);
