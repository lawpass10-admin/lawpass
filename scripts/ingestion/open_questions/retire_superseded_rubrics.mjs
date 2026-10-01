// retire_superseded_rubrics.mjs — take a replaced question out of circulation.
//
//   node scripts/ingestion/open_questions/retire_superseded_rubrics.mjs            # plan only
//   node scripts/ingestion/open_questions/retire_superseded_rubrics.mjs --commit
//   node scripts/ingestion/open_questions/retire_superseded_rubrics.mjs --report=logs/regenerate-....json
//
// WHY NOT DELETE THE OLD ROW. Because candidates have answered it.
// open_question_answers.open_question_id is ON DELETE RESTRICT, so a DELETE on a
// question that has been sat does not quietly cascade — it fails. Forcing it
// through means deleting the answers first, which destroys graded submissions,
// including some from non-admin accounts. The answers are the record of work
// real people did; the superseded question is only the prompt they did it from.
//
// WHAT RETIRING ACHIEVES INSTEAD. Picker visibility and gradability both come
// from a question having an APPROVED rubric (see lawpass_server/db/
// open-questions.js — "ids of the questions the grader can mark"). Moving the
// old rubric from 'approved' to 'retired' therefore takes the old version out of
// circulation while the question text, every answer and every grade stay exactly
// where they are. 'retired' is already an allowed status:
//
//   CHECK (status = ANY (ARRAY['draft', 'approved', 'retired']))
//
// and it is reversible — setting it back to 'approved' restores the question.
//
// THE ONE INVARIANT: NEVER RETIRE BEFORE THE REPLACEMENT IS GRADABLE. For each
// old row this checks that its replacement exists AND that the replacement's own
// rubric is 'approved'. A replacement sitting as a draft grades nothing, so
// retiring the old one then would leave that paper's angle with no usable
// question at all. Sets that failed are skipped for the same reason: their old
// row is all there is.
//
// WHAT IT COSTS. Ungraded answers on a retired question can no longer be marked:
// grading looks for an approved rubric and reports [no_rubric] without one. This
// reports those per question before doing anything, so a pending answer is a
// decision rather than a surprise.
//
// WHERE THE PAIRING COMES FROM. The regenerate report JSON, which is the only
// record of which new row replaced which old one — the rows themselves do not
// reference each other. Newest report by default.

import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const logsDir = join(here, 'logs');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const reportFlag = argv.find((a) => a.startsWith('--report='))?.slice('--report='.length);

// A PENDING ANSWER BLOCKS THE RETIREMENT, and only --strand-pending overrides it.
//
// 'pending' means a candidate submitted an answer and it has never been marked.
// Retiring the rubric removes the only thing that can mark it, so that person
// never gets a grade for work they did — and nothing in the UI would say why.
// That is different in kind from 'failed', where grading ran and errored: a
// failed answer is already in a broken state someone has to look at, and a
// retirement does not change that, so those stay warnings.
const strandPending = argv.includes('--strand-pending');

/** The newest regenerate report, or the one named on the command line. */
function reportPath() {
  if (reportFlag) return join(appRoot, reportFlag);
  const candidates = readdirSync(logsDir)
    .filter((f) => /^regenerate-.*\.json$/.test(f))
    .sort()
    .reverse();
  if (!candidates.length) {
    console.error(`no regenerate-*.json in ${relative(appRoot, logsDir)} — pass --report=<path>`);
    process.exit(2);
  }
  return join(logsDir, candidates[0]);
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

const path = reportPath();
const report = JSON.parse(readFileSync(path, 'utf8'));
console.log(`report : ${relative(appRoot, path)}`);
console.log(`ran at : ${report.ran_at}   mode: ${report.mode ?? 'unknown'}`);

// EVERY PAIRING IN THE REPORT IS CHECKED AGAINST THE DATABASE, including the
// ones the report calls failures. The report records what happened during the
// run; it is not the state of the table afterwards. A set that failed at the
// rubric stage can be finished later — recovered with generate-rubric.js
// --recover, or loaded by hand — and its replacement is then in the table while
// the report still says it failed. Trusting the flag would leave those old rows
// in the picker forever.
//
// Nothing is weakened by this: the blockers below require the replacement row to
// exist AND to carry an approved rubric, which is the real precondition. The
// report's own verdict is printed for context and decides nothing.
const candidates = report.results ?? [];
const reportedOk = candidates.filter((r) => r.ok).length;

console.log(
  `\n${candidates.length} pairing(s) in the report — ${reportedOk} recorded as loaded, ` +
    `${candidates.length - reportedOk} as failed. All of them are checked against the table.`
);

if (!candidates.length) {
  console.log('\nNothing to retire.');
  process.exit(0);
}

const db = await connect();
const plan = [];
try {
  for (const r of candidates) {
    // The replacement, found the only way available: by the source paper and the
    // angle letter recorded in its generation_meta.
    const { rows: replacement } = await db.query(
      `SELECT q.open_question_id,
              (SELECT count(*) FROM public.open_question_rubrics x
                WHERE x.open_question_id = q.open_question_id AND x.status = 'approved')::int AS approved
         FROM public.open_questions q
        WHERE q.type = 'new'
          AND q.generation_meta->>'source_external_id' = $1
          AND q.generation_meta->>'angle_letter' = $2`,
      [r.source_external_id, r.new_angle]
    );

    // The old row's approved rubric — the thing that keeps it in the picker.
    const { rows: oldRubrics } = await db.query(
      `SELECT rubric_id, version FROM public.open_question_rubrics
        WHERE open_question_id = $1 AND status = 'approved'`,
      [r.replaced_open_question_id]
    );

    // Ungraded answers that retiring would strand.
    const { rows: ungraded } = await db.query(
      `SELECT grading_status, count(*)::int AS n
         FROM public.open_question_answers
        WHERE open_question_id = $1 AND grading_status <> 'graded'
        GROUP BY grading_status ORDER BY grading_status`,
      [r.replaced_open_question_id]
    );

    const { rows: answerCount } = await db.query(
      `SELECT count(*)::int AS n FROM public.open_question_answers WHERE open_question_id = $1`,
      [r.replaced_open_question_id]
    );

    const label = `${r.source_external_id}-${r.new_angle}`;
    const blockers = [];
    if (replacement.length === 0) {
      blockers.push(
        r.ok
          ? 'replacement row not found (the report says it loaded — has it been deleted?)'
          : `replacement never loaded (${r.at}: ${r.detail})`
      );
    }
    if (replacement.length > 1) blockers.push(`${replacement.length} rows match that source+angle`);
    if (replacement[0] && replacement[0].approved === 0) {
      blockers.push('replacement rubric is not approved yet — approve it first');
    }
    if (oldRubrics.length === 0) blockers.push('old row has no approved rubric (already retired?)');

    const pending = ungraded.find((u) => u.grading_status === 'pending');
    if (pending && !strandPending) {
      blockers.push(
        `${pending.n} answer(s) are waiting to be marked — retiring now means they never can be. ` +
          `Grade them first, or pass --strand-pending to accept that.`
      );
    }

    plan.push({
      label,
      oldId: r.replaced_open_question_id,
      newId: replacement[0]?.open_question_id ?? null,
      rubricIds: oldRubrics.map((x) => x.rubric_id),
      versions: oldRubrics.map((x) => x.version),
      answers: answerCount[0].n,
      ungraded,
      blockers,
    });
  }
} finally {
  await db.end();
}

console.log('\nplan:');
for (const p of plan) {
  const mark = p.blockers.length ? 'SKIP' : 'ok  ';
  console.log(
    `  ${mark} ${p.label.padEnd(14)} retire ${String(p.oldId).slice(0, 8)} v${p.versions.join(',') || '-'}` +
      `  ->  keeps ${String(p.newId ?? '?').slice(0, 8)}   ${p.answers} answer(s) preserved`
  );
  for (const b of p.blockers) console.log(`        - ${b}`);
  for (const u of p.ungraded) {
    console.log(`        ! ${u.n} answer(s) are '${u.grading_status}' — retiring means they can no longer be marked`);
  }
}

const doable = plan.filter((p) => p.blockers.length === 0);
console.log(`\nretirable: ${doable.length}   skipped: ${plan.length - doable.length}`);

if (!commit) {
  console.log('\nREVIEW ONLY — nothing changed. The statement --commit would run, per row:\n');
  console.log("  UPDATE public.open_question_rubrics SET status = 'retired'");
  console.log('   WHERE rubric_id = $1 AND status = \'approved\';\n');
  console.log('No question row, answer row or grade is touched. Reverse it by setting');
  console.log("status back to 'approved' on the same rubric_id.");
  process.exit(0);
}

if (!doable.length) {
  console.log('\nNothing to do.');
  process.exit(0);
}

const writer = await connect();
let retired = 0;
try {
  for (const p of doable) {
    for (const rubricId of p.rubricIds) {
      try {
        const res = await writer.query(
          `UPDATE public.open_question_rubrics SET status = 'retired'
            WHERE rubric_id = $1 AND status = 'approved'`,
          [rubricId]
        );
        if (res.rowCount === 1) {
          retired += 1;
          console.log(`retired ${String(p.oldId).slice(0, 8)} rubric ${String(rubricId).slice(0, 8)}`);
        } else {
          console.log(`no change ${String(rubricId).slice(0, 8)} — it was not 'approved' any more`);
        }
      } catch (error) {
        console.error(`FAILED ${String(rubricId).slice(0, 8)} — ${error.message}`);
      }
    }
  }
} finally {
  await writer.end();
}

console.log(`\n${retired} rubric(s) retired. Those questions are out of the picker and no longer gradable.`);
console.log('Their text, answers and grades are untouched.');
