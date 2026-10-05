"use strict";

// CLI: send one SMS campaign to the list in lib/sms/recipients.csv.
//
//   node scripts/send-sms-campaign.js                      # preview, sends nothing
//   node scripts/send-sms-campaign.js --to 0541234567 --send   # one live test
//   node scripts/send-sms-campaign.js --send               # the real campaign
//
// Flags:
//   --send              actually send (without it, nothing leaves the machine)
//   --to <phone>        send to this number only, ignoring the file
//   --file <path>       a different recipient file for this run
//   --config <path>     a different campaign.json for this run
//   --sender <name>     override campaign.json's sender for this run
//   --limit <n>         cap this run below campaign.json's maxPerRun
//   --resend            ignore the sent log and message everyone again
//   --yes               skip the confirmation entirely (for an unattended run)
//
// PREVIEW IS THE DEFAULT, and that is the whole safety model. Without --send
// the script parses the file, builds the exact body, prices it in segments and
// prints who would be messaged — then stops. Every number is masked on screen,
// so a preview can be pasted into a chat without pasting the list with it.

const path = require("node:path");
const { createInterface } = require("node:readline/promises");

const {
  loadConfig,
  planCampaign,
  preflight,
  runCampaign,
  DEFAULT_CONFIG_PATH,
  SMS_DIR,
} = require("../lib/sms/campaign");
const { normalizeIsraeliMobile } = require("../lib/sms/phone");

/* ------------------------------------------------------------------- flags */

function parseArgs(argv) {
  const out = { send: false, resend: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--send") { out.send = true; continue; }
    if (arg === "--resend") { out.resend = true; continue; }
    if (arg === "--yes" || arg === "-y") { out.yes = true; continue; }
    if (!arg.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) continue;
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

/* ----------------------------------------------------------------- output */

const line = (label, value) => console.log(`${label.padEnd(14)}${value}`);

/**
 * Short name for a file inside lib/sms, full path for one outside it.
 *
 * A bare relative path is clearer for the usual case, but once --file points
 * somewhere else it degenerates into a row of `..\..\..`, which is exactly
 * when you most want to see which file is about to be messaged.
 */
function displayPath(file) {
  const relative = path.relative(SMS_DIR, file);
  return !relative || relative.startsWith("..") ? file : relative;
}

function printPlan(plan, config) {
  const { parsed, cost } = plan;

  console.log("");
  line("campaign", `${config.campaignId}   (${path.basename(config.configPath)})`);
  line("provider", `${plan.provider}${plan.dry ? "   ← mock: nothing leaves this machine" : ""}`);
  line("sender", plan.sender || "(not set)");
  line("file", displayPath(parsed.file));
  console.log("");

  line("rows read", String(parsed.rows) + (parsed.headerSkipped ? "   (first row looked like a header)" : ""));
  line("valid", String(parsed.recipients.length));
  if (parsed.duplicates.length) line("duplicates", `${parsed.duplicates.length}   (kept once)`);
  if (parsed.invalid.length) line("unreadable", `${parsed.invalid.length}   ← listed below`);
  if (plan.skipped.length) line("already sent", `${plan.skipped.length}   (from the sent log — skipped)`);
  line("this run", String(plan.targets.length));
  if (plan.deferred) line("waiting", `${plan.deferred}   (over maxPerRun — run again to continue)`);
  console.log("");

  line("segments", `${cost.segments} per recipient${cost.unicode ? "   (Hebrew → 70 chars per segment, not 160)" : ""}`);
  line("total cost", `${plan.messageCount} messages`);
  console.log(`\n${plan.body.split("\n").map((l) => `  | ${l}`).join("\n")}\n`);

  if (parsed.invalid.length) {
    console.log(`  ${parsed.invalid.length} row(s) could not be read as an Israeli mobile:`);
    for (const row of parsed.invalid.slice(0, 10)) {
      console.log(`    line ${String(row.row).padStart(4)}  ${row.value}`);
    }
    if (parsed.invalid.length > 10) console.log(`    … and ${parsed.invalid.length - 10} more`);
    console.log("");
  }
}

/* -------------------------------------------------------------------- main */

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/**
 * Up to this many recipients, a keystroke is enough.
 *
 * Five is "me and a couple of colleagues" — a run you can verify by reading
 * the masked numbers on screen, and one where a mistake reaches people you
 * can phone and apologise to.
 */
const KEYSTROKE_LIMIT = 5;

/**
 * Ask before sending, with friction proportional to the blast radius.
 *
 * A y/N prompt is the right question for a test send and the wrong one for a
 * campaign: by the third test you stop reading it, and that reflex is still
 * there on the run that reaches 500 people. So above KEYSTROKE_LIMIT the
 * prompt asks for something a reflex cannot produce — the recipient count,
 * typed. If you meant to message 1 and the screen says 437, typing "1" fails
 * and nothing goes out, which is exactly the mistake worth catching.
 *
 * Returns true to proceed.
 */
async function confirmSend(plan) {
  const count = plan.targets.length;
  const headline = `שליחה ל-${count} נמענים (${plan.messageCount} הודעות בפועל).`;

  if (count <= KEYSTROKE_LIMIT) {
    const answer = await confirm(`${headline}\nלהמשך [y/N]: `);
    return /^y(es)?$/i.test(answer);
  }

  const answer = await confirm(
    `${headline}\nלהמשך הקלידו את מספר הנמענים (${count}), או Enter לביטול: `
  );
  return answer === String(count);
}

async function main() {
  const config = loadConfig(args.config ? path.resolve(args.config) : DEFAULT_CONFIG_PATH);

  // Which sender the account will accept is something only the gateway can
  // answer, and the answer changes the day an alphanumeric name is approved.
  // A flag makes finding out one command instead of an edit-run-edit-back
  // loop on a file that the real campaign also reads.
  if (args.sender) config.sender = args.sender;

  // --to builds a one-row list in memory. It exists so the pipeline can be
  // proven against a real handset — sender name, Hebrew rendering, the link —
  // without touching the campaign file or the sent log.
  let plan;
  if (args.to) {
    const phone = normalizeIsraeliMobile(args.to);
    if (!phone) throw new Error(`"${args.to}" אינו מספר נייד ישראלי תקין.`);
    plan = planCampaign(config, { only: [phone] });
  } else {
    plan = planCampaign(config, {
      file: args.file ? path.resolve(args.file) : undefined,
      limit: args.limit,
      resend: args.resend,
    });
  }

  printPlan(plan, config);

  if (!plan.targets.length) {
    console.log("אין למי לשלוח בהרצה הזו.\n");
    return;
  }

  if (!args.send) {
    console.log("תצוגה מקדימה בלבד. להרצה אמיתית הוסיפו --send\n");
    return;
  }

  if (plan.dry) {
    console.log("SMS_PROVIDER=mock — גם עם --send שום הודעה לא תצא.");
    console.log("לשליחה אמיתית, ב-app/.env.local:");
    console.log("  SMS_PROVIDER=sms4free");
    console.log("  SMS4FREE_KEY= / SMS4FREE_USER= / SMS4FREE_PASSWORD=\n");
  }

  // Before the prompt, not after: nobody should be asked to confirm a run
  // that a missing credential was always going to refuse.
  preflight(plan);

  if (!plan.dry && !args.yes && !(await confirmSend(plan))) {
    console.log("בוטל. שום הודעה לא נשלחה.\n");
    return;
  }

  const total = plan.targets.length;
  const summary = await runCampaign(config, plan, {
    onResult: (entry, running) => {
      const done = running.sent + running.failed;
      const status = entry.status === "sent" ? "✓" : "✗";
      const detail = entry.status === "sent" ? entry.ref : entry.error;
      console.log(`  ${String(done).padStart(4)}/${total}  ${status} ${entry.masked}  ${detail}`);
    },
  });

  console.log("");
  line("sent", String(summary.sent));
  line("failed", String(summary.failed));
  line("log", summary.logFile);
  if (summary.failed) {
    console.log("\nכשלונות נרשמו ביומן ולא ייחשבו כנשלחו — הרצה חוזרת תנסה אותם שוב.");
  }
  if (plan.deferred) {
    console.log(`\nנותרו ${plan.deferred} נמענים מעל maxPerRun. הריצו שוב כדי להמשיך.`);
  }
  console.log("");
}

main().catch((error) => {
  console.error(`\nנכשל: ${error.message}\n`);
  process.exitCode = 1;
});
