// generate_sets.mjs — the production runner. One number in, N question/answer
// sets out: JSON, HTML, and a row each in public.open_questions.
//
//   node scripts/ingestion/open_questions/generate_sets.mjs
//   node scripts/ingestion/open_questions/generate_sets.mjs 5
//
// With no argument it asks at the terminal how many sets to generate. That is
// the only input it takes; everything else comes from the source bundles and
// from llm-params.json / llm-params-answers.json.
//
// WHICH SOURCE EACH SET COMES FROM. The bundles under answers/pages/ are ranked
// newest sitting first, and the runner walks that list in order: 1 set uses the
// newest paper, 2 sets use the newest two, and so on. Past the end of the list
// it wraps to the top and goes round again, so with ten bundles the eleventh set
// returns to 2026 — a SECOND angle on that paper, not a repeat of the first: the
// angle letter advances to the next one free (A, then B, then C).
//
//   set 1  2026-S-Q1 A      set 6   2022-W-Q2 A
//   set 2  2026-S-Q2 A      set 7   2021-S-Q1 A
//   set 3  2023-S-Q1 A      set 8   2021-S-Q2 A
//   set 4  2023-S-Q2 A      set 9   2021-W-Q1 A
//   set 5  2022-W-Q1 A      set 10  2021-W-Q2 A
//                           set 11  2026-S-Q1 B   <- wraps, next free angle
//
// WHAT EACH SET RUNS, in order, reusing the scripts that already do each job:
//
//   1. generate_from_source.mjs   adapt the bundle, write the question, write
//                                 the answer  -> generated/<id>-<angle>.generated.json
//                                                generated/<id>-<angle>.answer.json
//   2. generate-rubric.js         the marking scheme for that pair
//                                             -> generated/<id>-<angle>.rubric.json
//   3. render-open-question-pdf.js --html-only -> generated/<id>-<angle>.generated.html
//   4. render-open-answer-pdf.js   --html-only -> generated/<id>-<angle>.answer.html
//   5. load_generated_questions.mjs --commit   -> one row in open_questions,
//                                                 type='new', with its quote bank,
//                                                 inherited subject and generation_meta
//   6. load_rubric.mjs --commit                -> one row in open_question_rubrics,
//                                                 status 'draft', version 1
//
// JSON and HTML only — no PDF is produced, which is also why the runner does not
// need a browser on the machine.
//
// COSTS REAL MONEY AND REAL TIME. Each set is three Opus calls; reckon on eight
// to eleven minutes and roughly 90-100k tokens per set. Sets run one at a time,
// on purpose: the quote-lock validators reject work often enough that a failed
// set should not be competing for the API with nine others.
//
// A FAILED SET DOES NOT STOP THE RUN. Generation can be rejected by the quote
// lock, and that verdict is correct behaviour, not a crash. The runner records
// the failure, moves to the next set, and prints a summary at the end; the
// rejected output stays in generated/rejected/ for inspection.
//
// A SET LOADS WHOLE OR NOT AT ALL. Before step 5 the runner checks that all
// three parts exist on disk — question, answer, rubric — and loads nothing if
// any is missing. So a set that fails at generation or at the rubric leaves the
// database untouched, and its files stay on disk to be inspected or finished by
// hand. The one case that cannot be made atomic is step 6: the rubric row is
// looked up by the question row, so the question must be inserted first and a
// failure there leaves a question with no rubric. That case is reported
// separately as PARTIAL, with the command to finish it.
//
// WHAT IT REPORTS. The summary counts what reached the DATABASE, not what was
// generated — "4 out of 5 set(s) loaded to the database" — split into loaded,
// PARTIAL and FAILED, and the same report is written to logs/run-<timestamp>.txt
// because a twenty-minute run scrolls off the screen. Exit code is 1 if any set
// was partial or failed.
//
// NOTHING REACHES A STUDENT. Every row lands with status "draft" — the question,
// the answer and the rubric alike — exactly as the single-set path does. A draft
// rubric grades nothing: it becomes the scheme students are marked against only
// when someone reads it and re-runs load_rubric.mjs with --approve.

import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const pagesDir = join(here, 'answers', 'pages');
const sourcesDir = join(here, 'sources');
const generatedDir = join(here, 'generated');
const logsDir = join(here, 'logs');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const RUN_STARTED = Date.now();
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

// --------------------------------------------------------- the rotation

/**
 * Every bundle that can drive generation, newest sitting first.
 *
 * Ordering comes off the external_id (2026-S-Q1), not the folder name, which is
 * inconsistent — the 2026 papers sit in q1-answer/q2-answer while the rest carry
 * their year. Within a year the summer sitting (S/קיץ) is the later one, so it
 * ranks above winter (W/חורף).
 */
function rotation() {
  const entries = [];

  for (const dir of readdirSync(pagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const questionPath = join(pagesDir, dir.name, 'question.json');
    if (!existsSync(questionPath)) continue; // rubric/ holds an answer only

    const bundle = JSON.parse(readFileSync(questionPath, 'utf8'));
    const id = bundle.external_id;
    const m = /^(\d{4})-([SW])-Q(\d+)$/.exec(id ?? '');
    if (!m) {
      console.warn(`  ignoring ${dir.name}: external_id "${id}" is not <year>-<S|W>-Q<n>`);
      continue;
    }
    entries.push({
      folder: dir.name,
      id,
      year: Number(m[1]),
      season: m[2],
      number: Number(m[3]),
      subject: bundle.subject ?? null,
    });
  }

  return entries.sort(
    (a, b) =>
      b.year - a.year ||
      (a.season === b.season ? 0 : a.season === 'S' ? -1 : 1) ||
      a.number - b.number
  );
}

/**
 * The next angle letter free for a source, counting what is already on disk AND
 * what this run has already allocated. Reusing a letter would have the question
 * generator overwrite the earlier angle's files.
 */
function nextAngle(sourceId, claimed) {
  const onDisk = new Set(
    readdirSync(generatedDir)
      .map((f) => new RegExp(`^${sourceId}-([A-Z])\\.(generated|answer)\\.json$`).exec(f)?.[1])
      .filter(Boolean)
  );
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const key = `${sourceId}-${letter}`;
    if (!onDisk.has(letter) && !claimed.has(key)) {
      claimed.add(key);
      return letter;
    }
  }
  throw new Error(`${sourceId} already has angles A-Z — nothing left to allocate`);
}

/** The plan, before a single token is spent. */
function plan(count, sources) {
  const claimed = new Set();
  return Array.from({ length: count }, (_, i) => {
    const source = sources[i % sources.length];
    return { n: i + 1, source, angle: nextAngle(source.id, claimed) };
  });
}

// ------------------------------------------------------------- the steps

/**
 * Run one stage. Output streams through so the long model calls show progress.
 * Returns the exit status rather than exiting, so one bad set does not take the
 * rest of the run down with it.
 */
function run(script, args, cwd = appRoot) {
  const res = spawnSync('node', [script, ...args], { cwd, stdio: 'inherit' });
  return res.status ?? 1;
}

function generateSet(step) {
  const { source, angle } = step;
  const base = `${source.id}-${angle}`;
  const sourceFile = join(sourcesDir, `${source.id}.source.json`);
  const questionJson = join(generatedDir, `${base}.generated.json`);
  const answerJson = join(generatedDir, `${base}.answer.json`);
  const rubricJson = join(generatedDir, `${base}.rubric.json`);

  // 1. adapt + question + answer. generate_from_source.mjs writes the adapted
  //    source file the two renderers and the loader then read.
  let status = run(join(here, 'generate_from_source.mjs'), [`--folder=${source.folder}`, `--angle=${angle}`]);
  if (status !== 0) return { ok: false, at: 'generation', detail: 'rejected or failed — see generated/rejected/' };
  if (!existsSync(questionJson)) return { ok: false, at: 'generation', detail: `${base}.generated.json was not written` };
  if (!existsSync(answerJson)) return { ok: false, at: 'generation', detail: `${base}.answer.json was not written` };

  // 2. the marking scheme, derived from the question and the answer together.
  //    Runs here rather than after the renders so that a set which cannot be
  //    marked is known before anything is loaded — a question in the table with
  //    no rubric is a task a student can sit and nobody can grade.
  status = run(join(serverDir, 'scripts', 'generate-rubric.js'), [answerJson], serverDir);
  if (status !== 0) return { ok: false, at: 'rubric', detail: 'rejected or failed — see generated/rejected/' };
  if (!existsSync(rubricJson)) return { ok: false, at: 'rubric', detail: `${base}.rubric.json was not written` };

  // 3 & 4. HTML for the exam paper and for the model answer. No PDF.
  status = run(join(serverDir, 'scripts', 'render-open-question-pdf.js'), [questionJson, sourceFile, '--html-only'], serverDir);
  if (status !== 0) return { ok: false, at: 'question html', detail: 'renderer failed' };

  status = run(join(serverDir, 'scripts', 'render-open-answer-pdf.js'), [answerJson, sourceFile, '--html-only'], serverDir);
  if (status !== 0) return { ok: false, at: 'answer html', detail: 'renderer failed' };

  // THE COMPLETENESS GATE. Nothing reaches the database unless all three parts
  // of the set exist: question, answer, and the rubric that marks them. The
  // stages above already stop on their own failures, but the invariant is
  // restated here as one check because it is the one that matters — a question
  // row without a rubric is a task a student can sit and nobody can grade, and
  // it is far easier to never write it than to find it later.
  const parts = [
    ['question', questionJson],
    ['answer', answerJson],
    ['rubric', rubricJson],
  ];
  const missing = parts.filter(([, p]) => !existsSync(p)).map(([name]) => name);
  if (missing.length) {
    return {
      ok: false,
      at: 'incomplete set',
      detail: `missing ${missing.join(', ')} — nothing was loaded to the database`,
    };
  }

  // 5. the row. The loader re-validates, attaches the quote bank, inherits the
  //    subject from the parent source row and skips anything already present.
  status = run(join(here, 'load_generated_questions.mjs'), [`${base}.answer.json`, '--commit']);
  if (status !== 0) return { ok: false, at: 'database', detail: 'load failed — the JSON and HTML are still on disk' };

  // 6. the rubric row, into open_question_rubrics — a separate table, not a
  //    column here, because open_questions is student-readable and RLS is
  //    row-level: a rubric beside the question would be one direct query away
  //    from being the answer key in a student's browser.
  //
  //    Loaded as a DRAFT, with no --approve. A draft grades nothing, which is
  //    the same promise the rest of this runner makes: generated content reaches
  //    a student only after a human has read it.
  //
  //    This is the one stage that can leave the database half-written: the
  //    rubric row is looked up by the question row, so the question has to be
  //    inserted first and the two cannot go in as one transaction. A failure
  //    here is reported as PARTIAL rather than as a plain failure, because the
  //    fix is different — the question is already in the table and only the
  //    rubric has to be loaded, not the whole set regenerated.
  status = run(join(here, 'load_rubric.mjs'), [`${base}.rubric.json`, '--commit']);
  if (status !== 0) {
    return {
      ok: false,
      partial: true,
      at: 'database',
      detail:
        'rubric load failed — the QUESTION ROW IS IN THE TABLE and its rubric is not. ' +
        `Load it with: node scripts/ingestion/open_questions/load_rubric.mjs ${base}.rubric.json --commit`,
    };
  }

  return { ok: true, base };
}

// ------------------------------------------------------------------ main

/** The count: argument if given, otherwise asked for at the terminal. */
async function howMany() {
  const [arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const raw = arg ?? (await ask('How many question sets should I generate? '));
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`"${String(raw).trim()}" is not a whole number of sets.`);
    process.exit(2);
  }
  return n;
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

const sources = rotation();
if (!sources.length) {
  console.error(`no usable bundles under ${relative(appRoot, pagesDir)}`);
  process.exit(2);
}

const count = await howMany();
const steps = plan(count, sources);

console.log(`\n${sources.length} source paper(s) available, newest first:`);
for (const s of sources) console.log(`  ${s.id.padEnd(12)} ${s.folder}`);

console.log(`\nplan — ${count} set(s):`);
for (const s of steps) console.log(`  ${String(s.n).padStart(3)}. ${s.source.id}-${s.angle}`);
console.log(
  `\nEach set is two Opus calls. Nothing is skippable once started; ` +
  `stop with Ctrl-C between sets.\n`
);

const loaded = [];   // question row AND rubric row both in the database
const partial = [];  // question row in, rubric not — needs a hand
const failed = [];   // nothing loaded

for (const step of steps) {
  const started = Date.now();
  console.log('═'.repeat(72));
  console.log(`SET ${step.n}/${count} — ${step.source.id}-${step.angle}   (elapsed ${mmss(Date.now() - RUN_STARTED)})`);
  console.log('═'.repeat(72));

  const result = generateSet(step);
  const took = mmss(Date.now() - started);
  const record = { ...step, took, ...result };

  if (result.ok) {
    loaded.push(record);
    console.log(`\n✓ set ${step.n} loaded in ${took} — ${result.base}: question row + rubric row (draft)\n`);
  } else if (result.partial) {
    partial.push(record);
    console.error(`\n! set ${step.n} PARTIAL after ${took}: ${result.detail}\n`);
  } else {
    failed.push(record);
    console.error(`\n✗ set ${step.n} failed at ${result.at} after ${took} — nothing loaded: ${result.detail}\n`);
  }
}

// ---------------------------------------------------------------- summary

const label = (s) => `${s.source.id}-${s.angle}`.padEnd(14);
const lines = [
  ...loaded.map((s) => `  loaded   ${label(s)} ${s.took}`),
  ...partial.map((s) => `  PARTIAL  ${label(s)} ${s.took}  ${s.detail}`),
  ...failed.map((s) => `  FAILED   ${label(s)} ${s.took}  at ${s.at}: ${s.detail}`),
];
const headline = `${loaded.length} out of ${count} set(s) loaded to the database`;

console.log('═'.repeat(72));
console.log(`RUN COMPLETE — ${headline}, total ${mmss(Date.now() - RUN_STARTED)}`);
console.log('═'.repeat(72));
for (const line of lines) console.log(line);

if (loaded.length) {
  console.log(`\nFiles are in ${relative(appRoot, generatedDir)}. Every row is a draft — review before any of it reaches a student.`);
}
if (partial.length) {
  console.log(
    `\nNEEDS A HAND: ${partial.length} set(s) put a question in the table without its rubric. ` +
      `Until the rubric is loaded those questions cannot be graded — run the command printed above for each.`
  );
}
if (failed.length) {
  console.log(`\nRejected output for inspection: ${relative(appRoot, join(generatedDir, 'rejected'))}`);
}

// The written report. The console scrolls away and a run is twenty minutes of
// work; this is the record of what actually reached the database.
const finishedAt = new Date();
const report = [
  'LawPass — open question set generation',
  `finished    : ${finishedAt.toISOString()}`,
  `duration    : ${mmss(Date.now() - RUN_STARTED)}`,
  `requested   : ${count} set(s)`,
  '',
  headline.toUpperCase(),
  `  loaded  ${loaded.length}   partial ${partial.length}   failed ${failed.length}`,
  '',
  ...lines,
  '',
  'Every row loaded is a draft. A draft rubric grades nothing until someone reads it',
  'and re-runs load_rubric.mjs with --approve.',
  '',
].join('\n');

mkdirSync(logsDir, { recursive: true });
const reportPath = join(logsDir, `run-${finishedAt.toISOString().replace(/[:.]/g, '-')}.txt`);
writeFileSync(reportPath, report, 'utf8');
console.log(`\nreport: ${relative(appRoot, reportPath)}`);

// Non-zero if anything did not land whole, so a scheduled run fails loudly.
if (partial.length || failed.length) process.exitCode = 1;
