// load_generated_questions.mjs — load GENERATED bundles into open_questions.
//
// The sibling of load_open_questions.mjs. That one loads the real exam papers
// (type='source'); this one loads what the model wrote from them, one row per
// merged generated/<id>-<angle>.answer.json bundle:
//
//   question         questions[0] — the generated question, plus the quote bank
//                    (see "why the quotes travel with the row" below)
//   answers          answers[0] — the generated model answer
//   subject          inherited from the PARENT source row, so both types of row
//                    filter on the same string; override with --subject=
//   type             'new' — a model wrote it
//   generation_meta  the bundle's generated_from block: model, prompt_version,
//                    effort, the authoring snapshot and the token usage. This is
//                    what 20260816000002_open_questions_generation_meta.sql asks
//                    for, and it is a snapshot because llm-params*.json are live
//                    files that keep no history.
//
// WHY THE QUOTES TRAVEL WITH THE ROW. The generated question refers to its
// sources only through placeholders — {{L1-Q1}}, {{V2-Q1.text}} — and carries
// nothing but quote_ids. A row holding placeholders and no bank cannot be
// rendered by anything downstream, so the bank is read from the source file
// named in generated_from.source_file and attached as question.quotes, exactly
// as the source rows carry theirs. Pass --no-quotes to store the bundle
// untouched instead.
//
// SAFE BY DEFAULT: without --commit this connects, validates, reports exactly
// what it would write, and rolls back. Nothing reaches the table until you pass
// --commit deliberately.
//
// Usage:
//   node scripts/ingestion/open_questions/load_generated_questions.mjs
//   node scripts/ingestion/open_questions/load_generated_questions.mjs --commit
//   node scripts/ingestion/open_questions/load_generated_questions.mjs 2026-S-Q1-A.answer.json --commit
//   node scripts/ingestion/open_questions/load_generated_questions.mjs --subject='תקנות סדר הדין האזרחי, תשע"ט-2018'
//
// With no file arguments it loads the two most recent bundles named in
// DEFAULT_BUNDLES. Arguments may be bare filenames (resolved inside generated/)
// or paths.
//
// Connection: same strategy as load_open_questions.mjs — DIRECT_URL first, then
// DATABASE_URL (the Supavisor pooler) if the direct host is DNS-unreachable.

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const generatedDir = join(here, 'generated');
const sourcesDir = join(here, 'sources');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

// The two bundles this was written for. Naming them beats globbing the folder:
// generated/ also holds rejected output, older angles and the .generated.json
// halves, and a loader that picks up whatever is lying there is how a draft
// nobody reviewed reaches the table.
const DEFAULT_BUNDLES = ['2021-W-Q1-A.answer.json', '2026-S-Q1-A.answer.json'];

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const keepPlaceholders = argv.includes('--no-quotes');
const subjectFlag = argv.find((a) => a.startsWith('--subject='))?.slice('--subject='.length);
const files = argv.filter((a) => !a.startsWith('--'));

// --------------------------------------------------------------- collect

/** A bare filename means generated/; anything else is taken as given. */
function resolveBundle(name) {
  if (isAbsolute(name)) return name;
  const asGiven = resolve(process.cwd(), name);
  if (existsSync(asGiven)) return asGiven;
  return join(generatedDir, name);
}

function collectRows() {
  const rows = [];
  const missing = [];

  for (const name of files.length ? files : DEFAULT_BUNDLES) {
    const path = resolveBundle(name);
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    rows.push({ file: basename(path), path, bundle: JSON.parse(readFileSync(path, 'utf8')) });
  }

  return { rows, missing };
}

/**
 * The bank the generator locked this question to, read back out of the source
 * file it names. Same filter as buildBank() in lawpass_server/lib/ai/quote-bank.js:
 * one source file may hold several questions, each with its own quotes.
 */
function loadBank(meta) {
  const path = join(sourcesDir, meta.source_file || '');
  if (!meta.source_file || !existsSync(path)) return null;
  const source = JSON.parse(readFileSync(path, 'utf8'));
  return (source.quotes ?? []).filter((q) => q.question_external_id === meta.source_external_id);
}

/**
 * Blocking problems return a reason; cosmetic ones go to `warnings`. A row that
 * fails validation is not written even under --commit.
 */
function validate(row, warnings) {
  const { file, bundle } = row;
  const question = bundle.questions?.[0];
  const answer = bundle.answers?.[0];
  const meta = bundle.generated_from;

  if (!question) return 'bundle has no questions[0] — is this a .generated.json rather than a .answer.json?';
  if (!answer) return 'bundle has no answers[0] — the answer stage has not run for this angle';
  if (bundle.questions.length !== 1 || bundle.answers.length !== 1) {
    return `expected one question and one answer, found ${bundle.questions.length}/${bundle.answers.length}`;
  }
  if (!meta) return 'bundle has no generated_from block — nothing to record in generation_meta';

  if (!question.external_id) return 'question has no external_id';
  if (!question.parent_question_id) return 'question has no parent_question_id — subject cannot be inherited';
  if (answer.question_external_id !== question.external_id) {
    return `pairing mismatch: answer points at ${answer.question_external_id}, question is ${question.external_id}`;
  }

  if (!question.fact_pattern?.trim()) return 'question has no fact_pattern';
  if (!question.task_instructions?.trim()) return 'question has no task_instructions';
  if (!answer.sections?.length) return 'answer has no sections';

  // An unrendered placeholder in rendered_preview means the row would display
  // {{L1-Q1}} to a student. This was a live bug until the id pattern in
  // quote-bank.js was widened to accept hyphens, and the four bundles written
  // before that fix all carried it — so it is worth checking at the door.
  const stray = [...new Set(JSON.stringify(bundle.rendered_preview ?? '').match(/\{\{[^}]*\}\}/g) ?? [])];
  if (stray.length) {
    return `rendered_preview still holds ${stray.join(', ')} — re-render the bundle before loading it`;
  }

  if (question.status && question.status !== 'draft') {
    warnings.push(`${file}: question status is "${question.status}" — expected draft`);
  }
  if (answer.status && answer.status !== 'draft') {
    warnings.push(`${file}: answer status is "${answer.status}" — expected draft`);
  }

  if (!keepPlaceholders) {
    const bank = loadBank(meta);
    if (bank === null) {
      return `source file ${meta.source_file ?? '(none named)'} not found in sources/ — cannot attach the quote bank`;
    }
    if (!bank.length) {
      return `no quotes in ${meta.source_file} for ${meta.source_external_id} — the bank would be empty`;
    }
    const declared = question.quote_ids ?? [];
    const held = new Set(bank.map((q) => q.id));
    const absent = declared.filter((id) => !held.has(id));
    if (absent.length) {
      return `question declares quote_ids ${absent.join(', ')} that the source file does not hold`;
    }
    row.bank = bank;
  }

  row.question = question;
  row.answer = answer;
  row.meta = meta;
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

/**
 * The subject of the exam paper this angle was generated from. Inherited rather
 * than invented: a generated question tests the same sources as its parent, and
 * a subject typed fresh here would not match the parent's string exactly, which
 * is what any "all questions on this subject" query joins on.
 */
async function subjectFor(client, row, warnings) {
  if (subjectFlag) return subjectFlag;

  const parent = await client.query(
    `SELECT subject FROM public.open_questions WHERE question->>'external_id' = $1 AND type = 'source'`,
    [row.question.parent_question_id]
  );
  if (parent.rowCount === 0) {
    throw new Error(
      `parent ${row.question.parent_question_id} is not in open_questions — ` +
      `load the source rows first, or pass --subject=`
    );
  }
  const subject = parent.rows[0].subject;
  if (!subject) {
    throw new Error(`parent ${row.question.parent_question_id} has no subject — pass --subject=`);
  }
  // The extracted subjects carry the PDF's bidi damage on some papers
  // (התשע"ט:2018 for התשע"ט-2018). Inheriting copies it, which keeps the two
  // rows joinable — but it is worth seeing.
  if (/[:)][\d]|,\s*הת/.test(subject)) {
    warnings.push(`${row.file}: inherited subject looks bidi-damaged — "${subject}"`);
  }
  return subject;
}

// ------------------------------------------------------------------ main

const { rows, missing } = collectRows();
const warnings = [];
const invalid = [];
const valid = [];

for (const row of rows) {
  const reason = validate(row, warnings);
  if (reason) invalid.push(`${row.file}: ${reason}`);
  else valid.push(row);
}

console.log(`${rows.length} bundle(s) read, ${valid.length} valid\n`);

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
      console.log(`  skip    ${externalId.padEnd(14)} already present (${found.rows[0].open_question_id})`);
      existing++;
      continue;
    }

    const subject = await subjectFor(client, row, warnings);
    const question = row.bank ? { ...row.question, subject, quotes: row.bank } : row.question;

    await client.query(
      `INSERT INTO public.open_questions (question, answers, subject, type, generation_meta)
       VALUES ($1::jsonb, $2::jsonb, $3, 'new', $4::jsonb)`,
      [JSON.stringify(question), JSON.stringify(row.answer), subject, JSON.stringify(row.meta)]
    );

    console.log(
      `  ${commit ? 'insert' : 'would  '} ${externalId.padEnd(14)} ` +
      `type=new  quotes=${row.bank ? row.bank.length : 'not attached'}  ` +
      `model=${row.meta.model ?? '?'}  subject=${String(subject).slice(0, 40)}`
    );
    inserted++;
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

if (missing.length) {
  console.log('\nnot found:');
  for (const s of missing) console.log(`  - ${s}`);
  process.exitCode = 1;
}
if (invalid.length) {
  console.log('\nNOT loaded (failed validation):');
  for (const s of invalid) console.log(`  - ${s}`);
}
if (warnings.length) {
  console.log('\nwarnings (loaded anyway — review before students see this):');
  for (const s of warnings) console.log(`  - ${s}`);
}
