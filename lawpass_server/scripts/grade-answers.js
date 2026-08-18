"use strict";

// CLI: mark student submissions to the writing task.
//
//   from app/lawpass_server/
//     node scripts/grade-answers.js --answer=<uuid>     mark one submission
//     node scripts/grade-answers.js --pending           drain the queue (oldest first)
//     node scripts/grade-answers.js --pending --limit=5
//     node scripts/grade-answers.js --requeue-stale     release rows a dead worker left claimed
//
//   from app/
//     node lawpass_server/scripts/grade-answers.js --pending
//
// This is the worker until the API runs grading itself. It is also the retry
// path: a submission that failed goes back in the queue with --requeue=<uuid>.
//
// COSTS REAL MONEY. One Opus call per submission, around a minute. The question,
// rubric and model answer are cached for an hour, so a batch of answers to the
// same task after the first is substantially cheaper than the first.

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const SERVER_ROOT = path.resolve(__dirname, "..");
const envFile = [
  process.env.LAWPASS_ENV_PATH ? path.resolve(process.env.LAWPASS_ENV_PATH) : null,
  path.resolve(SERVER_ROOT, "..", ".env.local"),
  path.resolve(SERVER_ROOT, "..", ".env"),
  path.join(SERVER_ROOT, ".env"),
]
  .filter(Boolean)
  .find((p) => fs.existsSync(p));
if (envFile) dotenv.config({ path: envFile });

const { adminClient } = require("../config/supabase");
const { startTimer, mmss } = require("../lib/progress");
const dbGrading = require("../db/grading");
const { gradeOne } = require("../lib/grading/run-grading");

const RUN_STARTED = Date.now();

const args = process.argv.slice(2);
const flag = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const has = (name) => args.includes(`--${name}`);

function printScore(score) {
  const d = score.dimensions;
  console.log("─".repeat(72));
  console.log(`ציון כולל: ${score.total} / ${score.max}`);
  console.log(
    `  תוכן ${d.content.awarded}/${d.content.max}` +
      ` (פריטים ${d.content.items_total}, הורדות ${d.content.deductions_total})` +
      `   לשון ${d.language.awarded}/${d.language.max} (${d.language.band})` +
      `   ארגון ${d.organization.awarded}/${d.organization.max} (${d.organization.band})`
  );
  console.log("─".repeat(72));
  for (const item of d.content.items) {
    const mark = item.verdict === "full" ? "✓" : item.verdict === "partial" ? "~" : "✗";
    console.log(`${mark} ${item.id.padEnd(4)} ${String(item.points_awarded)}/${item.points_max}  ${item.title}`);
    if (item.comment) console.log(`       ${item.comment}`);
    if (item.evidence) {
      console.log(`       ציטוט${item.evidence_verified ? "" : " (לא נמצא כלשונו!)"}: "${item.evidence.slice(0, 110)}"`);
    }
  }
  for (const ded of d.content.deductions_applied) {
    console.log(`− ${ded.id}   -${ded.points_off}  ${ded.reason || ded.fault}`);
  }
  console.log("─".repeat(72));
  console.log(`לשון (${d.language.band}): ${d.language.comment}`);
  console.log(`ארגון (${d.organization.band}): ${d.organization.comment}`);
  console.log(`\nסיכום: ${score.summary}`);
  console.log("─".repeat(72));
}

async function gradeAndReport(admin, answerId, { verbose }) {
  console.log(`\ngrading ${answerId} — this can take about a minute...`);
  const stop = startTimer("grading");
  const result = await gradeOne(admin, answerId);
  const seconds = stop();

  if (!result.ok) {
    console.error(`  ${result.status.toUpperCase()}: ${result.detail}`);
    return false;
  }

  const u = result.usage || {};
  console.log(
    `  done in ${mmss(seconds * 1000)} — in ${u.input_tokens ?? "?"} | ` +
      `cache read ${u.cache_read_input_tokens ?? 0} | out ${u.output_tokens ?? "?"} tokens`
  );
  for (const w of result.warnings ?? []) console.log(`  warning: ${w}`);
  if (verbose) printScore(result.score);
  else console.log(`  ציון ${result.score.total}/${result.score.max}`);
  return true;
}

async function main() {
  const admin = adminClient();

  if (has("requeue-stale")) {
    const minutes = Number(flag("older-than") ?? 15);
    const stale = await dbGrading.listStaleClaims(admin, minutes);
    if (!stale.length) {
      console.log(`no rows stuck in "grading" for more than ${minutes} minutes.`);
      return;
    }
    for (const row of stale) {
      await dbGrading.releaseClaim(admin, row.answer_id);
      console.log(`  requeued ${row.answer_id}`);
    }
    console.log(`\n${stale.length} row(s) released back to pending.`);
    return;
  }

  const requeue = flag("requeue");
  if (requeue) {
    await dbGrading.releaseClaim(admin, requeue);
    const { error } = await admin
      .from("open_question_answers")
      .update({ grading_status: "pending", grading_error: null })
      .eq("answer_id", requeue)
      .eq("grading_status", "failed");
    if (error) throw error;
    console.log(`${requeue} is back in the queue.`);
    return;
  }

  const one = flag("answer");
  if (one) {
    const ok = await gradeAndReport(admin, one, { verbose: !has("quiet") });
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (has("pending")) {
    const limit = Number(flag("limit") ?? 20);
    const queue = await dbGrading.listPendingAnswers(admin, limit);
    if (!queue.length) {
      console.log("nothing pending.");
      return;
    }
    console.log(`${queue.length} submission(s) pending (oldest first)`);

    let ok = 0;
    // One at a time: the answers in a queue are usually for the SAME task, so
    // the second call reads the cache the first one wrote. Run them in parallel
    // and they all miss it and all pay the write.
    for (const row of queue) {
      const done = await gradeAndReport(admin, row.answer_id, { verbose: has("verbose") });
      if (done) ok++;
    }
    console.log(`\n${ok}/${queue.length} graded. total time ${mmss(Date.now() - RUN_STARTED)}`);
    process.exitCode = ok === queue.length ? 0 : 1;
    return;
  }

  console.error(
    "usage: node scripts/grade-answers.js --answer=<uuid>\n" +
      "       node scripts/grade-answers.js --pending [--limit=N] [--verbose]\n" +
      "       node scripts/grade-answers.js --requeue=<uuid>\n" +
      "       node scripts/grade-answers.js --requeue-stale [--older-than=15]"
  );
  process.exit(2);
}

main().catch((err) => {
  console.error(err.message || err);
  console.error(`total time: ${mmss(Date.now() - RUN_STARTED)}`);
  process.exit(1);
});
