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
//   2. render-open-question-pdf.js --html-only -> generated/<id>-<angle>.generated.html
//   3. render-open-answer-pdf.js   --html-only -> generated/<id>-<angle>.answer.html
//   4. load_generated_questions.mjs --commit   -> one row in open_questions,
//                                                 type='new', with its quote bank,
//                                                 inherited subject and generation_meta
//
// JSON and HTML only — no PDF is produced, which is also why the runner does not
// need a browser on the machine.
//
// COSTS REAL MONEY AND REAL TIME. Each set is two Opus calls; reckon on four to
// six minutes and roughly 60-70k tokens per set. Sets run one at a time, on
// purpose: the quote-lock validators reject work often enough that a failed set
// should not be competing for the API with nine others.
//
// A FAILED SET DOES NOT STOP THE RUN. Generation can be rejected by the quote
// lock, and that verdict is correct behaviour, not a crash. The runner records
// the failure, moves to the next set, and prints a summary at the end; the
// rejected output stays in generated/rejected/ for inspection. Exit code is 1 if
// any set failed.
//
// NOTHING REACHES A STUDENT. Every row lands with status "draft" on both the
// question and the answer, exactly as the single-set path does.

import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const pagesDir = join(here, 'answers', 'pages');
const sourcesDir = join(here, 'sources');
const generatedDir = join(here, 'generated');

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

  // 1. adapt + question + answer. generate_from_source.mjs writes the adapted
  //    source file the two renderers and the loader then read.
  let status = run(join(here, 'generate_from_source.mjs'), [`--folder=${source.folder}`, `--angle=${angle}`]);
  if (status !== 0) return { ok: false, at: 'generation', detail: 'rejected or failed — see generated/rejected/' };
  if (!existsSync(questionJson)) return { ok: false, at: 'generation', detail: `${base}.generated.json was not written` };
  if (!existsSync(answerJson)) return { ok: false, at: 'generation', detail: `${base}.answer.json was not written` };

  // 2 & 3. HTML for the exam paper and for the model answer. No PDF.
  status = run(join(serverDir, 'scripts', 'render-open-question-pdf.js'), [questionJson, sourceFile, '--html-only'], serverDir);
  if (status !== 0) return { ok: false, at: 'question html', detail: 'renderer failed' };

  status = run(join(serverDir, 'scripts', 'render-open-answer-pdf.js'), [answerJson, sourceFile, '--html-only'], serverDir);
  if (status !== 0) return { ok: false, at: 'answer html', detail: 'renderer failed' };

  // 4. the row. The loader re-validates, attaches the quote bank, inherits the
  //    subject from the parent source row and skips anything already present.
  status = run(join(here, 'load_generated_questions.mjs'), [`${base}.answer.json`, '--commit']);
  if (status !== 0) return { ok: false, at: 'database', detail: 'load failed — the JSON and HTML are still on disk' };

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

const done = [];
const failed = [];

for (const step of steps) {
  const started = Date.now();
  console.log('═'.repeat(72));
  console.log(`SET ${step.n}/${count} — ${step.source.id}-${step.angle}   (elapsed ${mmss(Date.now() - RUN_STARTED)})`);
  console.log('═'.repeat(72));

  const result = generateSet(step);
  const took = mmss(Date.now() - started);

  if (result.ok) {
    done.push({ ...step, took });
    console.log(`\n✓ set ${step.n} done in ${took} — ${result.base}.generated.json/.html, ${result.base}.answer.json/.html, row written\n`);
  } else {
    failed.push({ ...step, took, ...result });
    console.error(`\n✗ set ${step.n} failed at ${result.at} after ${took}: ${result.detail}\n`);
  }
}

// ---------------------------------------------------------------- summary

console.log('═'.repeat(72));
console.log(`RUN COMPLETE — ${done.length}/${count} set(s) written, ${failed.length} failed, total ${mmss(Date.now() - RUN_STARTED)}`);
console.log('═'.repeat(72));

for (const s of done) console.log(`  ok      ${`${s.source.id}-${s.angle}`.padEnd(14)} ${s.took}`);
for (const s of failed) console.log(`  FAILED  ${`${s.source.id}-${s.angle}`.padEnd(14)} ${s.took}  at ${s.at}: ${s.detail}`);

if (done.length) {
  console.log(`\nFiles are in ${relative(appRoot, generatedDir)}. Every row is a draft — review before any of it reaches a student.`);
}
if (failed.length) {
  console.log(`\nRejected output for inspection: ${relative(appRoot, join(generatedDir, 'rejected'))}`);
  process.exitCode = 1;
}
