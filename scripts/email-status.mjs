// email-status.mjs — what actually happened to the mail we sent.
//
//   node scripts/email-status.mjs                 the last 20 sends
//   node scripts/email-status.mjs --to=a@b.com    only that recipient
//   node scripts/email-status.mjs <resend-id>     one message, in full
//
// WHY THIS EXISTS. `sendEmail` returning `{ok: true}` means Resend ACCEPTED the
// message, not that anyone received it. The two come apart in practice: on
// 2026-10-04 three messages to idoelad73@gmail.com were accepted and sat at
// `last_event: "sent"` forever, while messages to lawpass10@gmail.com in the
// same minute reached the inbox. Nothing in our logs could tell those apart,
// because from this side both are a 200 with an id.
//
// The events, in the order they happen:
//   sent        Resend handed it to the receiving server. NOT delivery.
//   delivered   the receiving server accepted it. This is the one that counts.
//   bounced     permanently refused — bad address, blocked sender.
//   complained  the recipient pressed "report spam".
//   delivery_delayed  temporarily refused; it may still arrive.
//
// A message stuck on `sent` long after it was accepted was dropped silently by
// the receiving provider. There is no fix on our side for that one address;
// send to one that delivers, and check the domain's reputation.

import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("RESEND_API_KEY is not set (it lives in .env.local)");
  process.exit(2);
}

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const id = argv.find((a) => !a.startsWith("--")) ?? null;
const onlyTo = flagOf("to");
const limit = Number(flagOf("limit") ?? 20);

const get = async (path) => {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    console.error(`Resend returned ${response.status} for ${path}`);
    process.exit(1);
  }
  return response.json();
};

if (id) {
  const email = await get(`/emails/${id}`);
  console.log(`\n  id         ${email.id}`);
  console.log(`  to         ${(email.to ?? []).join(", ")}`);
  console.log(`  from       ${email.from}`);
  console.log(`  subject    ${email.subject}`);
  console.log(`  created    ${email.created_at}`);
  console.log(`  last_event ${email.last_event}`);
  console.log(`  message_id ${email.message_id ?? "—"}\n`);
  if (email.last_event === "sent") {
    console.log("  Accepted but not confirmed delivered. If this is more than a few");
    console.log("  minutes old, the receiving provider took it and dropped it.\n");
  }
  process.exit(0);
}

const list = await get(`/emails?limit=${limit}`);
const rows = (list.data ?? []).filter(
  (row) => !onlyTo || (row.to ?? []).some((address) => address === onlyTo)
);

console.log(`\n  ${rows.length} message(s)${onlyTo ? ` to ${onlyTo}` : ""}\n`);
for (const row of rows) {
  const event = row.last_event ?? "?";
  // The whole point of the report is spotting the ones that never landed.
  const mark = event === "delivered" ? "ok  " : event === "sent" ? "STUCK" : "!!  ";
  console.log(
    `  ${mark} ${String(event).padEnd(16)} ${row.created_at?.slice(0, 16)}  ` +
      `${(row.to ?? ["?"])[0].padEnd(24)} ${(row.subject ?? "").slice(0, 38)}`
  );
}

const stuck = rows.filter((row) => row.last_event === "sent");
const byRecipient = new Map();
for (const row of rows) {
  const to = (row.to ?? ["?"])[0];
  const seen = byRecipient.get(to) ?? { delivered: 0, stuck: 0 };
  if (row.last_event === "delivered") seen.delivered += 1;
  if (row.last_event === "sent") seen.stuck += 1;
  byRecipient.set(to, seen);
}

console.log("\n  by recipient:\n");
for (const [to, seen] of byRecipient) {
  console.log(`    ${to.padEnd(26)} ${seen.delivered} delivered, ${seen.stuck} stuck on "sent"`);
}

if (stuck.length > 0) {
  console.log(
    `\n  ${stuck.length} message(s) accepted but never confirmed delivered.\n` +
      "  An address that is all-stuck while another delivers is being dropped by\n" +
      "  the receiving provider — send the alarm somewhere that delivers.\n"
  );
} else {
  console.log();
}
