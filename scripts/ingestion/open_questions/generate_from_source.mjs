// generate_from_source.mjs — one source bundle in, a new question AND its model
// answer out. Drives the two existing generators end to end so a run is a
// single command instead of three steps with hand-copied paths.
//
//   1. adapt   question.json (bundle shape)  ->  sources/<id>.source.json
//              (generator shape: { document, questions[], quotes[] })
//   2. write   generate-open-question.js  ->  generated/<id>-<angle>.generated.json
//   3. answer  generate-open-answer.js    ->  generated/<id>-<angle>.answer.json
//
// The adapter in step 1 exists because the two formats differ: the bundles hold
// the question as page text plus a `question_fields` object, while the
// generators expect the extractor's own layout, reading fact_pattern,
// task_instructions, title, legal_topics, client_role, deliverable, answer_limit
// and timeline straight off `questions[N]`, and filtering `quotes[]` by
// question_external_id to build the locked bank.
//
// The adapted file is written into sources/ and KEPT, for two reasons: the
// generators locate the workspace by walking up for llm-params.json, so a file
// outside the tree would send output to the wrong place and hide the answers/
// exemplars; and `generated_from.source_file` names it, so deleting it would
// break the provenance trail on every row it produces.
//
// Configuration is untouched: llm-params.json governs the question and
// llm-params-answers.json the answer, both read by the generators themselves.
// Anything passed here as --effort/--model/--max-tokens/--no-cache is forwarded.
//
// Usage:
//   node scripts/ingestion/open_questions/generate_from_source.mjs
//   node scripts/ingestion/open_questions/generate_from_source.mjs --folder=q1-answer --angle=B
//   node scripts/ingestion/open_questions/generate_from_source.mjs --dry-run
//
// Costs real API tokens and takes minutes per stage. --dry-run does everything
// except the two model calls.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const pagesDir = join(here, 'answers', 'pages');
const sourcesDir = join(here, 'sources');
const generatedDir = join(here, 'generated');

const argv = process.argv.slice(2);
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const dryRun = argv.includes('--dry-run');
// Adapt the bundle and stop. Unlike --dry-run this WRITES sources/<id>.source.json
// and then runs neither generator — which is what a batched run needs, because it
// drives the question and answer stages itself, one batch at a time, rather than
// letting this script run them back to back for a single set.
const adaptOnly = argv.includes('--adapt-only');
const angle = flag('angle') || 'A';

// Flags the generators understand, forwarded verbatim.
const passthrough = argv.filter((a) =>
  /^--(effort|model|max-tokens|params)=/.test(a) || a === '--no-cache'
);

// ------------------------------------------------------ pick the source

/** Folders holding a question.json, in name order. */
function sourceFolders() {
  return readdirSync(pagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(pagesDir, d.name, 'question.json')))
    .map((d) => d.name)
    .sort();
}

const folders = sourceFolders();
if (!folders.length) {
  console.error(`no question.json found under ${pagesDir}`);
  process.exit(2);
}

const folder = flag('folder') || folders[0];
if (!folders.includes(folder)) {
  console.error(`unknown folder "${folder}". Available:\n  ${folders.join('\n  ')}`);
  process.exit(2);
}

const bundle = JSON.parse(readFileSync(join(pagesDir, folder, 'question.json'), 'utf8'));
const sourceId = bundle.external_id;

// ------------------------------------------------------------- validate

const problems = [];
if (!bundle.question_fields) {
  problems.push('bundle has no question_fields — re-run build_question_bundles.mjs');
} else {
  if (!bundle.question_fields.fact_pattern?.trim()) problems.push('fact_pattern is empty');
  if (!bundle.question_fields.task_instructions?.trim()) problems.push('task_instructions is empty');
}
// buildBank() throws on an empty bank, and a quote with no text renders as an
// empty string wherever {{ID.text}} appears in the generated question.
const quotes = bundle.quotes ?? [];
if (!quotes.length) problems.push('no quotes — the locked bank would be empty');
const textless = quotes.filter((q) => !q.text?.trim()).map((q) => q.id);

if (problems.length) {
  console.error(`${folder} cannot drive generation:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// ----------------------------------------------- 1. adapt to source shape

const adapted = {
  document: {
    source_file: bundle.source?.pdf ?? null,
    exam: bundle.exam,
    page_count: bundle.pages?.length ?? 0,
    global_instructions: bundle.global_instructions ?? '',
    extraction: bundle.extraction ?? null,
    adapted_from: `answers/pages/${folder}/question.json`,
  },
  questions: [bundle.question_fields],
  quotes,
};

mkdirSync(sourcesDir, { recursive: true });
const sourcePath = join(sourcesDir, `${sourceId}.source.json`);
if (!dryRun) writeFileSync(sourcePath, JSON.stringify(adapted, null, 2) + '\n', 'utf8');

console.log(`source  : ${folder} -> ${sourceId}`);
console.log(`subject : ${bundle.subject ?? '(none)'}`);
console.log(`quotes  : ${quotes.map((q) => q.id).join(', ')}`);
if (textless.length) {
  console.log(`WARNING : ${textless.join(', ')} have no text — {{${textless[0]}.text}} will render empty`);
}
if (bundle.needs_review) {
  console.log('WARNING : bundle is flagged needs_review — the Hebrew still carries bidi damage');
}
console.log(`adapted : ${relative(appRoot, sourcePath)}${dryRun ? '  (not written — dry run)' : ''}`);
console.log(`angle   : ${angle}\n`);

// ------------------------------------------------------------- 2 & 3. run

/** Run a generator, streaming its output so long stages show progress. */
function run(label, script, args) {
  console.log(`── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
  const res = spawnSync('node', [join(serverDir, 'scripts', script), ...args, ...passthrough], {
    cwd: serverDir,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.error(`\n${label} failed (exit ${res.status}). Nothing further was run.`);
    if (script === 'generate-open-question.js') {
      console.error(`If the quote lock failed, the output is in ${relative(appRoot, join(generatedDir, 'rejected'))}.`);
    }
    process.exit(res.status ?? 1);
  }
}

if (adaptOnly) {
  console.log(`adapt only — ${relative(appRoot, sourcePath)} written, no model call made.`);
  process.exit(0);
}

if (dryRun) {
  console.log('DRY RUN — would now run:');
  console.log(`  node scripts/generate-open-question.js ${relative(serverDir, sourcePath)} ${sourceId} ${angle}`);
  console.log(`  node scripts/generate-open-answer.js   generated/${sourceId}-${angle}.generated.json <source>`);
  console.log('\nNo model calls made, nothing written.');
  process.exit(0);
}

run('writing the question', 'generate-open-question.js', [sourcePath, sourceId, angle]);

const questionOut = join(generatedDir, `${sourceId}-${angle}.generated.json`);
if (!existsSync(questionOut)) {
  console.error(`expected ${questionOut} but it was not written — stopping before the answer stage.`);
  process.exit(1);
}

run('writing the answer', 'generate-open-answer.js', [questionOut, sourcePath]);

// ------------------------------------------------------------- 4. report

const answerOut = join(generatedDir, `${sourceId}-${angle}.answer.json`);
console.log('\n' + '═'.repeat(64));
console.log(`question : ${relative(appRoot, questionOut)}`);
console.log(
  existsSync(answerOut)
    ? `answer   : ${relative(appRoot, answerOut)}`
    : 'answer   : written by generate-open-answer.js (see its output above for the path)'
);
console.log('\nBoth are drafts with status "draft". Nothing reaches a student before a human approves it.');
