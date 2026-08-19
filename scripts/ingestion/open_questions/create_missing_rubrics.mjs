// create_missing_rubrics.mjs — find every generated question in the database
// that has no rubric, and write the missing rubrics.
//
//   node scripts/ingestion/open_questions/create_missing_rubrics.mjs --list
//   node scripts/ingestion/open_questions/create_missing_rubrics.mjs
//   node scripts/ingestion/open_questions/create_missing_rubrics.mjs --commit
//   node scripts/ingestion/open_questions/create_missing_rubrics.mjs --only=2026-S-Q1-E --commit
//
// WHY THIS EXISTS. A question row with no rubric is a task a student can sit and
// nobody can grade. generate_sets.mjs will not create one — it loads a set only
// when all three parts exist — but a set can still end up half-finished: the
// rubric stage failed after the question was already loaded, or an earlier run
// loaded the question before that gate existed. This finds those rows and
// finishes them, without regenerating the question and answer that were already
// paid for.
//
// WHAT COUNTS AS MISSING. type = 'new' (a model wrote it) and no row at all in
// open_question_rubrics — draft or approved. A draft rubric is not missing; it
// is waiting for a human to read it, which is a different problem.
//
// THREE FILES PER SET, NO HTML. A finished set on disk is
//   <id>.generated.json   the question
//   <id>.answer.json      the model answer  (the input this script needs)
//   <id>.rubric.json      the marking scheme (what this script writes)
// The renderers are not run: HTML is for reviewing, and no loader reads it.
//
// WHAT IT WILL NOT DO. It cannot invent an answer. A question whose
// <id>.answer.json is not on disk is reported and skipped — the rubric is
// derived from the question and the model answer together, so without the
// bundle there is nothing to derive it from.
//
// COSTS REAL MONEY. One Opus call per rubric, two to four minutes each. Run
// --list first: it queries and reports without calling the model or writing
// anything.
//
// SAFE BY DEFAULT. Without --commit this writes the rubric JSON to generated/
// and stops. Nothing reaches the database until you pass --commit, and even
// then the rubric lands as a DRAFT — it grades nothing until someone reads it
// and re-runs load_rubric.mjs with --approve.

import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const generatedDir = join(here, 'generated');
const logsDir = join(here, 'logs');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const RUN_STARTED = Date.now();
const mmss = (ms) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

const argv = process.argv.slice(2);
const listOnly = argv.includes('--list');
const commit = argv.includes('--commit');
const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

// Flags the rubric generator understands, forwarded verbatim so a one-off
// experiment does not require editing llm-params-rubric.json.
const passthrough = argv.filter(
  (a) => /^--(effort|model|max-tokens)=/.test(a) || a === '--no-cache'
);

// ------------------------------------------------------------ connection

// Same resolution order as load_rubric.mjs: the direct host first, the pooler
// second, because this runs from a workstation and not from Vercel.
async function connect() {
  const direct = process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!direct && !pooled) throw new Error('neither DIRECT_URL nor DATABASE_URL is set');

  for (const url of [direct, pooled].filter(Boolean)) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      if (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN') throw err;
    }
  }
  throw new Error('no reachable database host');
}

/** Generated questions carrying no rubric row of any status. */
async function findUngraded(client) {
  const { rows } = await client.query(
    `SELECT q.open_question_id,
            q.question->>'external_id' AS external_id
       FROM public.open_questions q
       LEFT JOIN public.open_question_rubrics r
              ON r.open_question_id = q.open_question_id
      WHERE q.type = 'new'
        AND r.rubric_id IS NULL
      ORDER BY 2`
  );
  return rows;
}

// ------------------------------------------------------------------ steps

function run(script, args, cwd = appRoot) {
  const res = spawnSync('node', [script, ...args], { cwd, stdio: 'inherit' });
  return res.status ?? 1;
}

// ------------------------------------------------------------------- main

const client = await connect();
let candidates;
try {
  candidates = await findUngraded(client);
} finally {
  await client.end().catch(() => {});
}

// A row whose question JSON has no external_id cannot be matched to a file on
// disk. Reported rather than skipped silently — it is a data problem worth
// seeing, not noise.
const unidentified = candidates.filter((c) => !c.external_id);
let work = candidates.filter((c) => c.external_id);
if (only) work = work.filter((c) => c.external_id === only);

// Classify before spending anything.
const plan = work.map((c) => {
  const answerJson = join(generatedDir, `${c.external_id}.answer.json`);
  const rubricJson = join(generatedDir, `${c.external_id}.rubric.json`);
  if (!existsSync(answerJson)) return { ...c, state: 'no bundle', answerJson, rubricJson };
  // Already generated but never loaded — regenerating would pay for a model
  // call to reproduce a file that is already sitting there.
  if (existsSync(rubricJson)) return { ...c, state: 'ready to load', answerJson, rubricJson };
  return { ...c, state: 'generate', answerJson, rubricJson };
});

const toGenerate = plan.filter((p) => p.state === 'generate');
const readyToLoad = plan.filter((p) => p.state === 'ready to load');
const noBundle = plan.filter((p) => p.state === 'no bundle');

console.log(`\n${candidates.length} generated question(s) in the database with no rubric.`);
if (only) console.log(`--only=${only} — ${work.length} of them selected.`);
for (const p of plan) console.log(`  ${p.state.padEnd(14)} ${p.external_id}`);
for (const c of unidentified) {
  console.log(`  NO EXTERNAL_ID ${c.open_question_id} — cannot be matched to a file on disk`);
}
if (noBundle.length) {
  console.log(
    `\n${noBundle.length} question(s) have no <id>.answer.json in ${relative(appRoot, generatedDir)}. ` +
      `A rubric is derived from the question AND the model answer, so these cannot be written here — ` +
      `regenerate the set with generate_sets.mjs.`
  );
}

if (!toGenerate.length && !readyToLoad.length) {
  console.log('\nNothing to do.');
  process.exit(noBundle.length || unidentified.length ? 1 : 0);
}

console.log(
  `\n${toGenerate.length} rubric(s) to generate (one Opus call each, two to four minutes), ` +
    `${readyToLoad.length} already on disk.`
);
console.log(
  commit
    ? 'Rubrics will be loaded to the database as DRAFTS.'
    : 'DRY: nothing will be written to the database. Pass --commit to load them.'
);

if (listOnly) {
  console.log('\n--list — nothing generated, nothing written.');
  process.exit(0);
}

const generated = [];
const loaded = [];
const failed = [];

for (const [i, p] of toGenerate.entries()) {
  const started = Date.now();
  console.log('═'.repeat(72));
  console.log(`RUBRIC ${i + 1}/${toGenerate.length} — ${p.external_id}   (elapsed ${mmss(Date.now() - RUN_STARTED)})`);
  console.log('═'.repeat(72));

  const status = run(join(serverDir, 'scripts', 'generate-rubric.js'), [p.answerJson, ...passthrough], serverDir);
  const took = mmss(Date.now() - started);

  if (status !== 0 || !existsSync(p.rubricJson)) {
    failed.push({ ...p, took, detail: 'rejected or failed — see generated/rejected/' });
    console.error(`\n✗ ${p.external_id} failed after ${took}\n`);
    continue;
  }
  generated.push({ ...p, took });
  console.log(`\n✓ ${p.external_id} written in ${took}\n`);
}

// Loading is a separate pass so a run that generates several rubrics and fails
// on one still loads the ones that succeeded.
if (commit) {
  for (const p of [...readyToLoad, ...generated]) {
    const status = run(join(here, 'load_rubric.mjs'), [`${p.external_id}.rubric.json`, '--commit']);
    if (status !== 0) {
      failed.push({ ...p, took: p.took ?? '—', detail: 'rubric written but load failed' });
      continue;
    }
    loaded.push(p);
  }
}

// ---------------------------------------------------------------- summary

const attempted = toGenerate.length + (commit ? readyToLoad.length : 0);
const headline = commit
  ? `${loaded.length} out of ${attempted} rubric(s) loaded to the database`
  : `${generated.length} out of ${toGenerate.length} rubric(s) written to disk`;

const lines = [
  ...(commit ? loaded : generated).map((p) => `  ok       ${p.external_id.padEnd(16)} ${p.took ?? '—'}`),
  ...failed.map((p) => `  FAILED   ${p.external_id.padEnd(16)} ${p.took}  ${p.detail}`),
  ...noBundle.map((p) => `  SKIPPED  ${p.external_id.padEnd(16)} no ${p.external_id}.answer.json on disk`),
];

console.log('═'.repeat(72));
console.log(`RUN COMPLETE — ${headline}, total ${mmss(Date.now() - RUN_STARTED)}`);
console.log('═'.repeat(72));
for (const line of lines) console.log(line);

if (!commit && generated.length) {
  console.log(
    `\nRead them, fix any wrong weightings in place, then load — from app/:\n` +
      generated.map((p) => `  node scripts/ingestion/open_questions/load_rubric.mjs ${p.external_id}.rubric.json --commit`).join('\n')
  );
}
if (commit && loaded.length) {
  console.log('\nEvery rubric loaded is a DRAFT and grades nothing. Re-run load_rubric.mjs with --approve once read.');
}

const finishedAt = new Date();
const report = [
  'LawPass — missing rubrics',
  `finished    : ${finishedAt.toISOString()}`,
  `duration    : ${mmss(Date.now() - RUN_STARTED)}`,
  `mode        : ${listOnly ? 'list' : commit ? 'generate + load' : 'generate only'}`,
  '',
  headline.toUpperCase(),
  '',
  ...lines,
  '',
].join('\n');

mkdirSync(logsDir, { recursive: true });
const reportPath = join(logsDir, `rubrics-${finishedAt.toISOString().replace(/[:.]/g, '-')}.txt`);
writeFileSync(reportPath, report, 'utf8');
console.log(`\nreport: ${relative(appRoot, reportPath)}`);

if (failed.length || noBundle.length || unidentified.length) process.exitCode = 1;
