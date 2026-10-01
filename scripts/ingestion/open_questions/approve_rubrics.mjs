// approve_rubrics.mjs — review the pending rubrics and approve them in bulk.
//
//   node scripts/ingestion/open_questions/approve_rubrics.mjs            # review only
//   node scripts/ingestion/open_questions/approve_rubrics.mjs --commit   # approve the clean ones
//   node scripts/ingestion/open_questions/approve_rubrics.mjs --commit --include-failing
//   node scripts/ingestion/open_questions/approve_rubrics.mjs --id=1cb3dd5e-... --commit
//
// WHY THIS EXISTS RATHER THAN --approve ON THE GENERATOR. Approval is the one
// human gate in this pipeline, and it is there because of something that
// already happened: a question with only a draft rubric was offered to
// students, answered, and could not be marked (migration 20260915000001).
// Auto-approving at generation would not fix that — it would mean nobody ever
// reads the marking scheme a candidate is graded against, which is a worse
// failure and a quieter one.
//
// What makes approval slow is not the judgement, it is doing it one at a time.
// So this separates the two: the MECHANICAL defects are found automatically and
// reported per rubric, and the human decision is made once over a list instead
// of thirty times over a form.
//
// WHAT IT CHECKS. Only things that are objectively wrong — points that do not
// add up, empty requirements, a rubric pointing at the wrong question. It does
// not and cannot judge whether a criterion is FAIR, which is the part that
// needs a person and is the reason --commit is not the default.
//
// SUPERSEDED DRAFTS ARE SKIPPED. A question that already has an approved rubric
// is not offered: its draft is an older version that was replaced, and
// approving it would both be wrong and violate the one-approved-per-question
// constraint. That case is real — 51d5bd87 carries an approved v2 and a stale
// draft v1.

import dotenv from 'dotenv';
import pg from 'pg';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const includeFailing = argv.includes('--include-failing');
const onlyId = argv.find((a) => a.startsWith('--id='))?.slice('--id='.length);
const approverFlag = argv.find((a) => a.startsWith('--approved-by='))?.slice('--approved-by='.length);

/**
 * The mechanical checks.
 *
 * Each returns a problem string or null. They are deliberately narrow: a check
 * that guesses at quality would produce warnings nobody reads, and the whole
 * point is that a warning here means something is actually wrong.
 */
function inspect(rubric, question) {
  const problems = [];

  // TWO WAYS A DIMENSION IS SCORED, and the check has to know both. `content`
  // carries itemised criteria that each hold points; `language` and
  // `organization` are scored by BANDS — descriptors of weak/adequate/strong —
  // and their items array is empty by design. An earlier version of this check
  // summed only item points against total_points and flagged all nine existing
  // rubrics, which is exactly the kind of warning that teaches people to
  // approve past it without reading.
  const dimensions = Object.entries(rubric.dimensions ?? {});
  if (dimensions.length === 0) problems.push('no dimensions at all');

  const items = dimensions.flatMap(([, d]) => d.items ?? []);
  const total = Number(rubric.total_points) || 0;

  // The dimensions are what must add up to the total — that is the mark a
  // candidate is out of.
  const dimSum = dimensions.reduce((n, [, d]) => n + (Number(d.max_points) || 0), 0);
  if (total > 0 && dimSum !== total) {
    problems.push(`dimensions sum to ${dimSum} but total_points is ${total}`);
  }

  for (const [name, dim] of dimensions) {
    const max = Number(dim.max_points) || 0;
    const scored = (dim.items ?? []).length > 0;
    const banded = (dim.bands ?? []).length > 0;

    // A dimension scored by neither cannot be marked at all.
    if (!scored && !banded) problems.push(`${name}: no criteria and no bands`);

    // Within an itemised dimension the criteria must reach its own maximum,
    // or part of the dimension is unreachable.
    if (scored) {
      const sum = dim.items.reduce((n, i) => n + (Number(i.points) || 0), 0);
      if (max > 0 && sum !== max) {
        problems.push(`${name}: criteria sum to ${sum} but its max_points is ${max}`);
      }
    }
  }

  // A criterion with no requirement is one the grader cannot apply.
  const empty = items.filter((i) => !String(i.requirement ?? '').trim()).map((i) => i.id);
  if (empty.length) problems.push(`empty requirement: ${empty.join(', ')}`);

  const untitled = items.filter((i) => !String(i.title ?? '').trim()).map((i) => i.id);
  if (untitled.length) problems.push(`no title: ${untitled.join(', ')}`);

  // Deductions need a fault to deduct for.
  const badDeductions = (rubric.deductions ?? [])
    .filter((d) => !String(d.fault ?? '').trim())
    .map((d) => d.id ?? '?');
  if (badDeductions.length) problems.push(`deduction with no fault: ${badDeductions.join(', ')}`);

  // A rubric carrying another question's external_id would mark the wrong
  // paper. Checked against the question row, not against the file name.
  const qExternal = question?.question?.external_id ?? null;
  if (qExternal && rubric.question_external_id && rubric.question_external_id !== qExternal) {
    problems.push(`points at ${rubric.question_external_id} but the question is ${qExternal}`);
  }

  return { items: items.length, sum: dimSum, total, problems };
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

// ------------------------------------------------------------------ main

const db = await connect();

let pending;
let approver = approverFlag ?? null;
try {
  // Drafts for questions that have NO approved rubric. The NOT EXISTS is what
  // keeps superseded drafts out — see the header.
  const { rows } = await db.query(
    `SELECT r.rubric_id, r.open_question_id, r.version, r.rubric, r.created_at,
            q.subject, q.question
       FROM public.open_question_rubrics r
       JOIN public.open_questions q USING (open_question_id)
      WHERE r.status = 'draft'
        AND NOT EXISTS (
          SELECT 1 FROM public.open_question_rubrics a
           WHERE a.open_question_id = r.open_question_id
             AND a.status = 'approved'
        )
        ${onlyId ? 'AND r.open_question_id = $1' : ''}
      ORDER BY r.created_at`,
    onlyId ? [onlyId] : []
  );
  pending = rows;

  if (!approver) {
    // Recorded against a real admin rather than NULL: "who approved this" is
    // the question an approval record exists to answer.
    const { rows: admins } = await db.query(
      'SELECT id FROM public.profiles WHERE is_admin = true ORDER BY created_at LIMIT 1'
    );
    approver = admins[0]?.id ?? null;
  }
} finally {
  await db.end();
}

if (!pending.length) {
  console.log('No rubrics are waiting for approval.');
  process.exit(0);
}

console.log(`${pending.length} rubric(s) awaiting approval\n`);

const reviewed = pending.map((row) => ({ row, report: inspect(row.rubric, row) }));
const clean = reviewed.filter((r) => r.report.problems.length === 0);
const flagged = reviewed.filter((r) => r.report.problems.length > 0);

for (const { row, report } of reviewed) {
  const mark = report.problems.length ? 'CHECK' : 'ok   ';
  console.log(
    `${mark} ${String(row.open_question_id).slice(0, 8)}  v${row.version}  ` +
      `${report.items} criteria, ${report.sum}/${report.total} pts  ${row.subject ?? ''}`
  );
  for (const p of report.problems) console.log(`        - ${p}`);
}

console.log(`\nclean: ${clean.length}   needs a look: ${flagged.length}`);

const toApprove = includeFailing ? reviewed : clean;

if (!commit) {
  console.log(
    `\nREVIEW ONLY — nothing approved. --commit would approve ${toApprove.length}` +
      (flagged.length && !includeFailing
        ? `, leaving ${flagged.length} flagged (add --include-failing to approve those too).`
        : '.')
  );
  console.log(
    '\nThe checks above are mechanical. They do not tell you whether a criterion is\n' +
      'fair — read the rubrics before approving a batch that students will be graded on.'
  );
  process.exit(0);
}

if (!toApprove.length) {
  console.log('\nNothing to approve.');
  process.exit(0);
}

const writer = await connect();
let approved = 0;
try {
  for (const { row } of toApprove) {
    // One statement each rather than one bulk UPDATE: the unique index allows
    // a single approved rubric per question, so a bad row should fail alone
    // rather than roll back the whole batch.
    try {
      await writer.query(
        `UPDATE public.open_question_rubrics
            SET status = 'approved', approved_at = now(), approved_by = $2
          WHERE rubric_id = $1 AND status = 'draft'`,
        [row.rubric_id, approver]
      );
      approved += 1;
      console.log(`approved ${String(row.open_question_id).slice(0, 8)} v${row.version}`);
    } catch (error) {
      console.error(`FAILED   ${String(row.open_question_id).slice(0, 8)} — ${error.message}`);
    }
  }
} finally {
  await writer.end();
}

console.log(`\n${approved} of ${toApprove.length} approved${approver ? `, recorded against ${approver}` : ''}.`);
console.log('Those questions are now gradable and will appear in the student picker.');
