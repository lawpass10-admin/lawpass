// load_rubric.mjs — attach a generated rubric (מחוון) to its question.
//
// The third loader in this folder. load_open_questions.mjs loads the real exam
// papers, load_generated_questions.mjs loads what the model wrote from them, and
// this one loads the marking scheme those generated questions are graded against
// — into open_question_rubrics, one row per version.
//
// A rubric arrives as generated/<id>.rubric.json with "status": "draft". A draft
// loads as a draft and grades nothing. To make it the scheme students are marked
// against, either set "status": "approved" in the file after reading it, or pass
// --approve here; either way the row records who approved it.
//
// REVISIONS ARE NEW ROWS. Loading an approved rubric for a question that already
// has one retires the old row and inserts a new version rather than updating in
// place, so a grade written last month can always be traced to the exact text
// that produced it. Pass --force to allow that; without it, a question that
// already has an approved rubric is skipped.
//
// SAFE BY DEFAULT: without --commit this connects, validates, reports exactly
// what it would write, and rolls back.
//
// Usage:
//   node scripts/ingestion/open_questions/load_rubric.mjs 2026-S-Q1-A.rubric.json
//   node scripts/ingestion/open_questions/load_rubric.mjs 2026-S-Q1-A.rubric.json --approve --commit
//   node scripts/ingestion/open_questions/load_rubric.mjs --force --commit   (all rubrics in generated/)
//
// TARGETING ONE EXACT ROW. By default the question is found by its external id —
// convenient, but it is a name, and two rows could carry it after a re-import.
// When it matters which row is being wired up — setting up a specific question
// for a UI test, say — pass the uuid instead:
//
//   ... load_rubric.mjs 2026-S-Q2-A.rubric.json --question-id=36bb524f-... --approve --commit
//
// The external id in the file is then checked AGAINST that row and a mismatch is
// refused, so naming both is a belt-and-braces assertion that the rubric grades
// the question you think it does. One file at a time in that mode, for obvious
// reasons.

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const generatedDir = join(here, 'generated');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

// The scale is the exam board's. Re-checked here and not only in the generator:
// this file is hand-edited between the two steps — that is the point of the
// review — and a slipped decimal in ממד התוכן is invisible until it has marked
// somebody. Kept as a literal rather than imported from lawpass_server because
// that is a separate CommonJS package with its own dependency tree.
const CONTENT_MAX = 12;
const TOTAL_POINTS = 20;

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const approve = argv.includes('--approve');
const force = argv.includes('--force');
const approverFlag = argv.find((a) => a.startsWith('--approved-by='))?.slice('--approved-by='.length);
const questionIdFlag = argv.find((a) => a.startsWith('--question-id='))?.slice('--question-id='.length);
const files = argv.filter((a) => !a.startsWith('--'));

if (questionIdFlag && files.length !== 1) {
  console.error('--question-id targets one row, so name exactly one rubric file with it.');
  process.exit(2);
}

// --------------------------------------------------------------- collect

function resolveFile(name) {
  if (isAbsolute(name)) return name;
  const asGiven = resolve(process.cwd(), name);
  if (existsSync(asGiven)) return asGiven;
  return join(generatedDir, name);
}

/** With no arguments, every *.rubric.json in generated/ (never rejected/). */
function defaultFiles() {
  if (!existsSync(generatedDir)) return [];
  return readdirSync(generatedDir)
    .filter((f) => f.endsWith('.rubric.json'))
    .map((f) => join(generatedDir, f));
}

function collectRows() {
  const rows = [];
  const missing = [];

  const paths = files.length ? files.map(resolveFile) : defaultFiles();
  for (const path of paths) {
    if (!existsSync(path)) {
      missing.push(basename(path));
      continue;
    }
    rows.push({ file: basename(path), path, doc: JSON.parse(readFileSync(path, 'utf8')) });
  }
  return { rows, missing };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Blocking problems return a reason; cosmetic ones go to `warnings`. A rubric
 * that fails validation is not written even under --commit.
 */
function validate(row, warnings) {
  const { file, doc } = row;

  if (!doc.question_external_id) return 'no question_external_id — cannot tell which question this grades';
  if (!doc.dimensions) return 'no dimensions block — is this a .rubric.json?';

  const status = doc.status ?? 'draft';
  if (!['draft', 'approved'].includes(status)) {
    return `status is "${status}" — load it as draft or approved, nothing else`;
  }

  const content = doc.dimensions.content ?? {};
  const items = content.items ?? [];
  if (!items.length) return 'ממד התוכן has no items — nothing to mark against';

  const sum = round2(items.reduce((acc, i) => acc + Number(i.points || 0), 0));
  if (sum !== CONTENT_MAX) {
    return `content items sum to ${sum}, must be exactly ${CONTENT_MAX} (${items.map((i) => `${i.id}=${i.points}`).join(', ')})`;
  }

  const ids = items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) return `duplicate content item ids: ${ids.join(', ')}`;
  // The ids are what a second attempt is compared through. Renumbering them
  // between versions silently breaks that comparison, so they are checked here
  // as well as in the generator — this file gets hand-edited in between.
  const misnumbered = ids.filter((id, idx) => id !== `C${idx + 1}`);
  if (misnumbered.length) return `content item ids must run C1 upward in order — found ${misnumbered.join(', ')}`;

  for (const key of ['language', 'organization']) {
    const bands = doc.dimensions[key]?.bands ?? [];
    if (bands.length !== 3) return `dimensions.${key} has ${bands.length} bands — expected 3 (חלש / בינוני / גבוה)`;
  }
  const declaredTotal = Number(doc.total_points ?? TOTAL_POINTS);
  if (declaredTotal !== TOTAL_POINTS) {
    return `total_points is ${declaredTotal} — the exam's scale is ${TOTAL_POINTS}`;
  }

  const missingRequirement = items.filter((i) => !String(i.requirement || '').trim());
  if (missingRequirement.length) {
    return `items with no requirement text: ${missingRequirement.map((i) => i.id).join(', ')} — the student is shown this sentence`;
  }

  const noPartial = items.filter((i) => !String(i.partial_credit || '').trim());
  if (noPartial.length) {
    warnings.push(`${file}: ${noPartial.map((i) => i.id).join(', ')} have no partial-credit rule — marked all-or-nothing`);
  }
  const ungrounded = items.filter((i) => !String(i.model_answer_section || '').trim());
  if (ungrounded.length === items.length) {
    warnings.push(`${file}: no item names a model answer section — the feedback screen has nothing to quote`);
  }
  if (status === 'draft' && !approve) {
    warnings.push(`${file}: loading as DRAFT — it will not grade anything until approved`);
  }

  row.doc = doc;
  row.status = approve ? 'approved' : status;
  row.itemCount = items.length;
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
      if (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN') throw err;
    }
  }
  throw new Error('no reachable database host');
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

console.log(`${rows.length} rubric file(s) read, ${valid.length} valid\n`);

const client = await connect();
let written = 0;
let skipped = 0;
let retired = 0;

try {
  await client.query('BEGIN');

  for (const row of valid) {
    const externalId = row.doc.question_external_id;

    // By uuid when one was given, by external id otherwise. The uuid path also
    // asserts the two agree: a rubric attached to the wrong row grades every
    // student against a question they never read, and nothing downstream would
    // notice — the join still resolves, the scores just mean nothing.
    const question = questionIdFlag
      ? await client.query(
          `SELECT open_question_id, question->>'external_id' AS external_id
             FROM public.open_questions WHERE open_question_id = $1`,
          [questionIdFlag]
        )
      : await client.query(
          `SELECT open_question_id, question->>'external_id' AS external_id
             FROM public.open_questions WHERE question->>'external_id' = $1`,
          [externalId]
        );

    if (question.rowCount === 0) {
      invalid.push(
        questionIdFlag
          ? `${row.file}: no question row with id ${questionIdFlag}`
          : `${row.file}: question ${externalId} is not in open_questions — load the question bundle first`
      );
      continue;
    }
    if (question.rowCount > 1) {
      invalid.push(`${row.file}: external id ${externalId} matches ${question.rowCount} rows — pass --question-id=<uuid> to say which`);
      continue;
    }

    const questionId = question.rows[0].open_question_id;
    const rowExternalId = question.rows[0].external_id;

    if (questionIdFlag && rowExternalId !== externalId) {
      invalid.push(
        `${row.file}: refusing to attach — the rubric is for ${externalId}, but row ` +
        `${questionIdFlag} holds ${rowExternalId}`
      );
      continue;
    }

    const approved = await client.query(
      `SELECT rubric_id, version FROM public.open_question_rubrics
        WHERE open_question_id = $1 AND status = 'approved'`,
      [questionId]
    );

    if (row.status === 'approved' && approved.rowCount > 0 && !force) {
      console.log(`  skip    ${externalId.padEnd(14)} already has an approved rubric (${approved.rows[0].rubric_id}) — pass --force to supersede it`);
      skipped++;
      continue;
    }

    // Next version number for this question, drafts included: versions count
    // rubrics written, not rubrics approved.
    const last = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS v FROM public.open_question_rubrics WHERE open_question_id = $1`,
      [questionId]
    );
    const version = Number(last.rows[0].v) + 1;

    if (row.status === 'approved' && approved.rowCount > 0) {
      await client.query(
        `UPDATE public.open_question_rubrics SET status = 'retired' WHERE rubric_id = $1`,
        [approved.rows[0].rubric_id]
      );
      console.log(`  retire  ${externalId.padEnd(14)} v${approved.rows[0].version} superseded`);
      retired++;
    }

    await client.query(
      `INSERT INTO public.open_question_rubrics
         (open_question_id, rubric, status, version, approved_at, approved_by)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)`,
      [
        questionId,
        JSON.stringify(row.doc),
        row.status,
        version,
        row.status === 'approved' ? new Date().toISOString() : null,
        approverFlag ?? null,
      ]
    );

    console.log(
      `  ${commit ? 'insert' : 'would  '} ${externalId.padEnd(14)} ` +
      `v${version}  status=${row.status}  items=${row.itemCount}  ` +
      `question=${questionId}`
    );
    written++;
  }

  if (commit) {
    await client.query('COMMIT');
    console.log(`\nCOMMITTED — ${written} rubric(s) written, ${retired} retired, ${skipped} skipped.`);
  } else {
    await client.query('ROLLBACK');
    console.log(`\nDRY RUN — rolled back. ${written} rubric(s) would be written, ${retired} retired, ${skipped} skipped.`);
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
  console.log('\nwarnings (loaded anyway — review before students are graded on this):');
  for (const s of warnings) console.log(`  - ${s}`);
}
