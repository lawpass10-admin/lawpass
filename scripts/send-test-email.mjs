// send-test-email.mjs — is Resend configured, and does a real send work?
//
//   npm run email:check                    report configuration, send nothing
//   npm run email:check -- you@gmail.com   report, then send one real email
//
// The report runs against no network and costs nothing. Only --to sends, and
// only one message.
//
// It imports lib/email/client.ts DIRECTLY — Node strips the types — so what it
// exercises is the code that runs in production, not a copy of it. A test
// harness that reimplements the thing it is testing can pass while the real
// path is broken.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const require = createRequire(import.meta.url);

const dotenv = require("dotenv");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const { readEmailConfig, isEmailConfigured, sendEmail } = await import("../lib/email/client.ts");
const { renderEmail } = await import("../lib/email/layout.ts");

// The recipient is accepted THREE ways, because npm mangles the obvious one.
//
//   npm run email:check -- --to you@example.com
//
// looks right and does not work: npm's own argument parser treats `--to` as a
// config option, swallows it, and forwards only the bare value — so the script
// sees ["you@example.com"] and, checking for a `--to` flag, concludes nothing
// was asked for. It then prints "no --to given" directly underneath a command
// that plainly contained one, which is a maddening thing to debug.
//
// So: take the value after an explicit --to when it survives, else npm's
// npm_config_to, else the first argument that looks like an address.
const args = process.argv.slice(2);
const toIndex = args.indexOf("--to");
const recipient =
  (toIndex >= 0 ? args[toIndex + 1] : null) ??
  process.env.npm_config_to ??
  args.find((a) => a.includes("@")) ??
  null;

const config = readEmailConfig();
const tick = (ok) => (ok ? "yes" : "NO");

console.log("");
console.log("LawPass — email configuration");
console.log("─────────────────────────────");
console.log(`  RESEND_API_KEY      ${tick(Boolean(config.apiKey))}`, config.apiKey ? `(${config.apiKey.slice(0, 8)}…, ${config.apiKey.length} chars)` : "");
console.log(`  RESEND_FROM_EMAIL   ${tick(Boolean(config.from))}`, config.from ? `→ ${config.from}` : "");
console.log(`  RESEND_REPLY_TO     ${config.replyTo || "(unset — optional)"}`);
console.log(`  EMAIL_DRY_RUN       ${config.dryRun ? "1 — NOTHING WILL BE SENT" : "off"}`);
console.log("");

if (!isEmailConfigured(config)) {
  console.log("  Not configured. Both RESEND_API_KEY and RESEND_FROM_EMAIL are needed.");
  console.log("  Add them to .env.local — see .env.example for the exact lines.");
  console.log("");
  process.exit(1);
}

console.log("  Configured. A send will be attempted when you pass a recipient address.");

// The API key format is worth a word: a send key starts "re_". A key copied
// from the wrong panel fails at send time with an opaque 401, and that is an
// annoying thing to debug against a live provider.
if (!config.apiKey.startsWith("re_")) {
  console.log('  WARNING: the key does not start with "re_" — check it is a Resend API key.');
}
// The sender must be a verified domain, or Resend's own sandbox address. A
// plain gmail.com sender is the single most common setup mistake.
if (/@(gmail|outlook|hotmail|yahoo)\./i.test(config.from)) {
  console.log("  WARNING: RESEND_FROM_EMAIL is a consumer mailbox. Resend only sends from a");
  console.log("           domain you have verified, or from onboarding@resend.dev in testing.");
}
console.log("");

if (!recipient) {
  console.log("  No recipient given, so nothing was sent. To send one real email:");
  console.log("      npm run email:check -- you@example.com");
  console.log("");
  process.exit(0);
}

console.log(`  Sending one test email to ${recipient} …`);

const result = await sendEmail({
  to: recipient,
  subject: "בדיקת שליחת דוא״ל — LawPass",
  html: renderEmail({
    heading: "בדיקת שליחת דוא״ל",
    preheader: "אם ההודעה הגיעה, שירות הדוא״ל מוגדר כראוי",
    paragraphs: [
      "הודעה זו נשלחה מסקריפט הבדיקה של LawPass.",
      "אם היא הגיעה לתיבה שלך, החיבור ל-Resend, הדומיין המאומת וכתובת השולח מוגדרים כראוי.",
      `נשלח בתאריך ${new Date().toLocaleString("he-IL")}.`,
    ],
    footerNote: "הודעת בדיקה — אין צורך להשיב.",
  }),
  tags: { type: "config-check" },
});

console.log("");
if (result.ok) {
  console.log(`  SENT. Resend id: ${result.id}${result.dryRun ? "  (dry run — not actually delivered)" : ""}`);
  console.log("  Check the inbox, and the spam folder — a brand-new sending domain");
  console.log("  often lands in spam for the first few messages.");
  console.log("");
  process.exit(0);
}

console.log(`  FAILED: ${result.error}${result.status ? `  (HTTP ${result.status})` : ""}`);
console.log("");
if (result.status === 401 || result.status === 403) {
  console.log("  401/403 — the API key is wrong, revoked, or lacks send permission.");
} else if (result.status === 422) {
  console.log("  422 — Resend rejected the message. Almost always the from-address:");
  console.log("        its domain must be verified in Resend before you can send from it.");
} else if (result.retryable) {
  console.log("  The failure was retryable (rate limit, timeout, or a provider error);");
  console.log("  three attempts were made. Trying again shortly is reasonable.");
}
console.log("");
process.exit(1);
