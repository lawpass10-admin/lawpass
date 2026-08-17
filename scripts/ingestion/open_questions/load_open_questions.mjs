// load_open_questions.mjs — load the question/answer bundles into open_questions.
//
// Reads every folder under answers/pages/ that holds a matched pair of
// question.json + answer.json and writes one row per pair:
//
//   question         the whole question bundle (text, pages, quotes, subject)
//   answers          the whole answer bundle   (text, pages, source pdf)
//   subject          copied from question.subject, so it is queryable as a column
//   type             'source' — these came off real exam papers, not the model
//   generation_meta  left NULL; it describes model output, and none of this is
//
// SAFE BY DEFAULT: without --commit this connects, validates, reports exactly
// what it would write, and rolls back. Nothing reaches the table until you pass
// --commit deliberately.
//
// Usage:
//   node scripts/ingestion/open_questions/load_open_questions.mjs            # dry run
//   node scripts/ingestion/open_questions/load_open_questions.mjs --commit   # write
//
// Connection: same strategy as scripts/apply-sql.mjs — DIRECT_URL first, then
// DATABASE_URL (the Supavisor pooler) if the direct host is DNS-unreachable.

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const pagesDir = join(here, 'answers', 'pages');

// Env is loaded relative to the app root rather than the shell's cwd, so the
// script works from any directory.
dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const commit = process.argv.includes('--commit');

// --------------------------------------------------------------- collect

/**
 * One row per folder holding BOTH files. The rubric folder has only an
 * answer.json (it is a grading scheme, not a question) and is skipped.
 */
function collectRows() {
  const rows = [];
  const skipped = [];

  for (const folder of readdirSync(pagesDir, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const dir = join(pagesDir, folder.name);
    const qPath = join(dir, 'question.json');
    const aPath = join(dir, 'answer.json');

    if (!existsSync(qPath) || !existsSync(aPath)) {
      skipped.push(`${folder.name}: ${!existsSync(qPath) ? 'no question.json' : 'no answer.json'}`);
      continue;
    }

    const question = JSON.parse(readFileSync(qPath, 'utf8'));
    const answer = JSON.parse(readFileSync(aPath, 'utf8'));
    rows.push({ folder: folder.name, question, answer });
  }

  return { rows, skipped };
}

/**
 * Blocking problems return a reason; cosmetic ones go to `warnings`. A row that
 * fails validation is not written even under --commit.
 */
function validate(row, warnings) {
  const { folder, question, answer } = row;

  if (!question.external_id) return 'question has no external_id';
  if (!answer.external_id) return 'answer has no external_id';

  // The pairing check. IDs matching is not enough on its own, but a mismatch
  // here means a question was bundled next to the wrong answer.
  if (question.answer_external_id !== answer.external_id) {
    return `pairing mismatch: question points at ${question.answer_external_id}, answer is ${answer.external_id}`;
  }

  if (!question.text?.trim()) return 'question text is empty';
  if (!answer.text?.trim()) return 'answer text is empty';
  if (!question.subject) return 'question has no subject';

  const quotes = question.quotes ?? [];
  if (!quotes.length) {
    // buildBank() in lawpass_server/lib/ai/quote-bank.js throws on an empty
    // bank, so such a row could never drive generation.
    return 'question has no quotes — the quote bank would be empty';
  }

  const empty = quotes.filter((q) => !q.text?.trim()).map((q) => q.id);
  if (empty.length) {
    warnings.push(`${folder}: quote(s) ${empty.join(', ')} have no text — {{${empty[0]}.text}} renders empty`);
  }
  const inferred = quotes.filter((q) => q.placement === 'inferred-from-neighbour').map((q) => q.id);
  if (inferred.length) {
    warnings.push(`${folder}: quote(s) ${inferred.join(', ')} were placed by inference, not verified`);
  }
  if (question.needs_review || answer.needs_review) {
    warnings.push(`${folder}: still flagged needs_review — the Hebrew carries bidi damage from extraction`);
  }

  return null;
}

// ------------------------------------------------------------ connection

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
      // Only a dead host is worth falling through on. An auth failure means the
      // credentials are wrong and the fallback would fail identically.
      if (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN') throw err;
    }
  }
  throw new Error('no reachable database host');
}

// ------------------------------------------------------------------ main

const { rows, skipped } = collectRows();
const warnings = [];
const invalid = [];
const valid = [];

for (const row of rows) {
  const reason = validate(row, warnings);
  if (reason) invalid.push(`${row.folder}: ${reason}`);
  else valid.push(row);
}

console.log(`${rows.length} folder(s) with a question/answer pair, ${valid.length} valid\n`);

const client = await connect();
let inserted = 0;
let existing = 0;

try {
  await client.query('BEGIN');

  for (const row of valid) {
    const externalId = row.question.external_id;

    // The table has no unique constraint on the external id, so re-running is
    // made safe by looking first. That is a check-then-insert and would race
    // against a concurrent loader; for a one-off CLI it is enough. A unique
    // index on (question->>'external_id') would make it airtight.
    const found = await client.query(
      `SELECT open_question_id FROM public.open_questions WHERE question->>'external_id' = $1`,
      [externalId]
    );
    if (found.rowCount > 0) {
      console.log(`  skip    ${externalId.padEnd(12)} already present (${found.rows[0].open_question_id})`);
      existing++;
      continue;
    }

    const res = await client.query(
      `INSERT INTO public.open_questions (question, answers, subject, type)
       VALUES ($1::jsonb, $2::jsonb, $3, 'source')
       RETURNING open_question_id`,
      [JSON.stringify(row.question), JSON.stringify(row.answer), row.question.subject]
    );
    console.log(
      `  ${commit ? 'insert' : 'would  '} ${externalId.padEnd(12)} ` +
      `subject=${String(row.question.subject).slice(0, 40)}`
    );
    inserted++;
    void res;
  }

  if (commit) {
    await client.query('COMMIT');
    console.log(`\nCOMMITTED — ${inserted} row(s) inserted, ${existing} already present.`);
  } else {
    await client.query('ROLLBACK');
    console.log(`\nDRY RUN — rolled back. ${inserted} row(s) would be inserted, ${existing} already present.`);
    console.log('Pass --commit to write them.');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`\nFAILED — rolled back, nothing written.\n${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}

if (skipped.length) {
  console.log('\nskipped (no pair):');
  for (const s of skipped) console.log(`  - ${s}`);
}
if (invalid.length) {
  console.log('\nNOT loaded (failed validation):');
  for (const s of invalid) console.log(`  - ${s}`);
}
if (warnings.length) {
  console.log('\nwarnings (loaded anyway — review before students see this):');
  for (const s of warnings) console.log(`  - ${s}`);
}
