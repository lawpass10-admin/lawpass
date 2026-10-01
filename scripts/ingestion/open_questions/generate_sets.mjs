// generate_sets.mjs — the production runner. One number in, N question/answer
// sets out: JSON, HTML, and a row each in public.open_questions.
//
//   node scripts/ingestion/open_questions/generate_sets.mjs
//   node scripts/ingestion/open_questions/generate_sets.mjs 5
//   node scripts/ingestion/open_questions/generate_sets.mjs 5 --sequential
//   node scripts/ingestion/open_questions/generate_sets.mjs 5 --seed=1738205
//   node scripts/ingestion/open_questions/generate_sets.mjs 10 --parallel=4
//
// TWO FLAGS THAT SOUND LIKE OPPOSITES AND ARE NOT. --sequential is about the
// ORDER sources are picked in (newest-first instead of shuffled). --parallel is
// about EXECUTION (several sets at once instead of one at a time). They are
// independent, and `--sequential --parallel=4` is a coherent request: walk the
// papers newest-first, and run four lanes while doing it.
//
// With no argument it asks at the terminal how many sets to generate. That is
// the only input it takes; everything else comes from the source bundles and
// from llm-params.json / llm-params-answers.json.
//
// WHICH SOURCE EACH SET COMES FROM. The bundles under answers/pages/ are
// shuffled, and the runner walks that shuffled list. Past the end it reshuffles
// and goes round again, so with ten bundles the eleventh set returns to some
// paper for a SECOND angle — not a repeat of the first: the angle letter
// advances to the next one free (A, then B, then C).
//
// Shuffling a pass rather than picking a paper at random per set is deliberate.
// Independent picks cluster: a run of ten could take the same sitting four
// times while never touching half the corpus. A shuffled pass keeps the even
// spread — every source used once before any is used twice — and randomises
// only the order within it.
//
//   node ... generate_sets.mjs 5                 random order, new seed
//   node ... generate_sets.mjs 5 --seed=1738205  repeat an earlier run's order
//   node ... generate_sets.mjs 5 --sequential    the old newest-first walk
//
// The seed is printed with the plan, so a run that produced something odd can
// be replayed exactly.
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
// to eleven minutes and roughly 90-100k tokens per set. Sets run one at a time by
// default; --parallel=N runs N lanes at once, which costs the same in tokens and
// less in wall clock. See set_lanes.mjs for why a lane is a SOURCE PAPER rather
// than just a set — two angles of one paper must not be written simultaneously,
// or neither knows what the other wrote. A run shorter than the number of source
// papers puts every set on its own paper, so there the grouping costs nothing.
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
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rotation, plan } from './set_plan.mjs';
import { generateSet } from './set_runner.mjs';
import { laneize, laneWorkers, estimateMinutes, runLanes } from './set_lanes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const pagesDir = join(here, 'answers', 'pages');
const generatedDir = join(here, 'generated');
const logsDir = join(here, 'logs');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const RUN_STARTED = Date.now();
const mmss = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

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

// --sequential restores the newest-first walk; the default is a shuffled
// order. --seed=N reproduces a previous run's order exactly (the seed used is
// printed below, so a run that went wrong can be replayed).
const sequential = process.argv.includes('--sequential');
const seedArg = process.argv.slice(2).find((a) => a.startsWith('--seed='));
const seed = seedArg ? Number(seedArg.split('=')[1]) : Date.now();

// --parallel / --parallel=N. Validated here rather than left to build a pool of
// NaN workers, which silently runs nothing at all.
const parallelArg = process.argv.slice(2).find((a) => a === '--parallel' || a.startsWith('--parallel='));
const parallel = Boolean(parallelArg);
let laneLimit = Infinity;
if (parallelArg?.startsWith('--parallel=')) {
  laneLimit = Number(parallelArg.split('=')[1]);
  if (!Number.isInteger(laneLimit) || laneLimit < 1) {
    console.error(`--parallel=${parallelArg.split('=')[1]} is not a whole number of lanes.`);
    process.exit(2);
  }
}

// --pick=independent draws a source at random for every set, so a paper can come
// up more than once in a run and others not at all. The default spreads instead:
// random order, even coverage. See plan() in set_plan.mjs.
const pickArg = process.argv.slice(2).find((a) => a.startsWith('--pick='));
const pick = pickArg ? pickArg.split('=')[1] : 'spread';
if (!['spread', 'independent', 'subject'].includes(pick)) {
  console.error(
    `--pick=${pick} is not a mode. Use --pick=spread, --pick=independent or --pick=subject.`
  );
  process.exit(2);
}

// --exclude-subject=<text>, repeatable. Substring match, because these subjects
// come off PDFs and their punctuation is not reliably identical — matching the
// whole string exactly would silently exclude nothing.
const excludeSubjects = process.argv
  .slice(2)
  .filter((a) => a.startsWith('--exclude-subject='))
  .map((a) => a.slice('--exclude-subject='.length))
  .filter((s) => s.trim() !== '');

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');

/** Minutes a set takes, for the estimate only. */
const MINUTES_PER_SET = 10;

const sources = rotation();
if (!sources.length) {
  console.error(`no usable bundles under ${relative(appRoot, pagesDir)}`);
  process.exit(2);
}

const count = await howMany();
let steps;
try {
  steps = plan(count, sources, { random: !sequential, seed, pick, excludeSubjects });
} catch (error) {
  // The usual cause is an --exclude-subject that matched everything, which is
  // worth naming rather than letting a stack trace explain it.
  console.error(`\n${error.message}`);
  process.exit(2);
}

console.log(`\n${sources.length} source paper(s) available, newest first:`);
for (const s of sources) console.log(`  ${s.id.padEnd(12)} ${s.folder}`);

console.log(`\nplan — ${count} set(s):`);
for (const s of steps) console.log(`  ${String(s.n).padStart(3)}. ${s.source.id}-${s.angle}`);

// The seed, so a run that produced something odd can be replayed exactly with
// --seed=N. It was documented as printed and was not, which made the whole
// reproducibility story untrue in practice.
const distinctPapers = new Set(steps.map((s) => s.source.id)).size;
const MODE_LABEL = {
  spread: 'random order, every paper used evenly (--pick=spread)',
  independent: 'random, drawn independently per set (--pick=independent)',
  subject: 'random order, every SUBJECT used evenly (--pick=subject)',
};
console.log(`\norder : ${sequential ? 'newest-first (--sequential)' : MODE_LABEL[pick]}`);

if (excludeSubjects.length) {
  const dropped = sources.filter((s) =>
    excludeSubjects.some((x) => String(s.subject ?? '').includes(x))
  );
  console.log(`excl. : ${excludeSubjects.map((x) => `"${x}"`).join(', ')}`);
  console.log(
    `        ${dropped.length} paper(s) dropped: ${dropped.map((s) => s.id).join(', ') || '(none matched)'}`
  );
}

console.log(
  `papers: ${distinctPapers} of ${sources.length} used` +
    `${distinctPapers < sources.length ? `, ${sources.length - distinctPapers} untouched this run` : ''}`
);

// The subject tally, because this is the number that was out of balance and the
// one worth seeing before a run rather than after it.
const bySubject = new Map();
for (const s of steps) {
  const key = s.source.subject ?? '(no subject)';
  bySubject.set(key, (bySubject.get(key) ?? 0) + 1);
}
console.log(`subjects: ${bySubject.size} in this run`);
for (const [subject, n] of [...bySubject].sort((a, b) => b[1] - a[1])) {
  console.log(`        ${String(n).padStart(2)} × ${subject}`);
}
console.log(
  `seed  : ${seed}${sequential ? ' (unused — the order is not random)' : `   replay with --seed=${seed}`}`
);

const lanes = laneize(steps, (s) => s.source.id);
const workers = laneWorkers(lanes, laneLimit);
const estimateMin = parallel
  ? estimateMinutes({ lanes, workers, setCount: count, minutesPerSet: MINUTES_PER_SET })
  : count * MINUTES_PER_SET;

if (parallel) {
  console.log(`\nlanes — one per source paper, ${lanes.length} in all:`);
  for (const lane of lanes) {
    console.log(
      `  ${lane.source.padEnd(12)} ${lane.steps.length} set(s)   ` +
        lane.steps.map((s) => `${s.source.id}-${s.angle}`).join(' → ')
    );
  }
}

console.log(
  `\nmode  : ${
    parallel
      ? `PARALLEL execution, ${workers} lane(s) at a time` +
        `${laneLimit === Infinity ? '' : ` (--parallel=${laneLimit})`}`
      : 'one set at a time'
  }`
);
console.log(`est.  : ~${estimateMin} min — each set is three Opus calls, ~90-100k tokens\n`);

const loaded = [];   // question row AND rubric row both in the database
const partial = [];  // question row in, rubric not — needs a hand
const failed = [];   // nothing loaded

/** File one finished set into the right bucket. Shared by both drivers. */
function record(step, result, took) {
  const row = { ...step, took, ...result };
  if (result.ok) loaded.push(row);
  else if (result.partial) partial.push(row);
  else failed.push(row);
  return row;
}

if (parallel) {
  console.log(
    `${count} set(s) over ${lanes.length} lane(s), ${workers} running at a time.\n` +
      `Per-lane detail goes to logs/lane-<paper>-${RUN_STAMP}.log — the console shows stage changes only.\n`
  );

  const records = await runLanes({
    lanes,
    workers,
    logsDir,
    stamp: RUN_STAMP,
    startedAt: RUN_STARTED,
    labelOf: (step) => `${step.source.id}-${step.angle}`,
  });

  // Lanes finish out of order; put them back into plan order so the summary
  // below reads the same as a sequential run's.
  records.sort((a, b) => a.step.n - b.step.n);
  for (const r of records) record(r.step, r.outcome, r.took);
} else {
  for (const step of steps) {
    const started = Date.now();
    console.log('═'.repeat(72));
    console.log(`SET ${step.n}/${count} — ${step.source.id}-${step.angle}   (elapsed ${mmss(Date.now() - RUN_STARTED)})`);
    console.log('═'.repeat(72));

    const result = generateSet(step);
    const took = mmss(Date.now() - started);
    record(step, result, took);

    if (result.ok) {
      console.log(`\n✓ set ${step.n} loaded in ${took} — ${result.base}: question row + rubric row (draft)\n`);
    } else if (result.partial) {
      console.error(`\n! set ${step.n} PARTIAL after ${took}: ${result.detail}\n`);
    } else {
      console.error(`\n✗ set ${step.n} failed at ${result.at} after ${took} — nothing loaded: ${result.detail}\n`);
    }
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
  // Enough to reproduce this run exactly, which is the only reason the seed is
  // held rather than left to Math.random.
  `order       : ${
    sequential ? 'newest-first (--sequential)' : `random (--pick=${pick}), seed ${seed}`
  }`,
  `execution   : ${parallel ? `${workers} lane(s) in parallel` : 'one set at a time'}`,
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
