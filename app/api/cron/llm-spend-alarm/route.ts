/**
 * The spend alarm: email when the estimated Claude balance falls past a
 * threshold, so a run is never refused mid-paper for want of credit.
 *
 * Triggered by Vercel Cron (see vercel.json) with `Authorization: Bearer
 * $CRON_SECRET`, following app/api/cron/reengagement/route.ts — same guard,
 * same reason: an open URL is a button anyone can press, and this one sends
 * mail.
 *
 * ── WHAT IT CAN AND CANNOT KNOW ───────────────────────────────────────────
 *
 * Anthropic exposes no credit-balance API, and the Cost API needs an Admin key
 * on an organization account. So this does not read a balance. It adds up the
 * usage our own generators recorded and subtracts it from an anchor figure a
 * human read in the console:
 *
 *     remaining ≈ LLM_BALANCE_ANCHOR_USD − spend recorded after
 *                 LLM_BALANCE_ANCHOR_AT
 *
 * Every gap in that sum reads LOW — calls made outside this repo, retried
 * calls, papers generated before usage recording existed — so the real balance
 * is at most this and probably less. For an alarm that is the safe direction
 * in only one sense: it fires LATE rather than never. Set the threshold with
 * room, and re-anchor from the console every few weeks.
 *
 * ── WHY IT WILL NOT SPAM ──────────────────────────────────────────────────
 *
 * Once below the threshold, every daily run is below it. The guard is Resend's
 * idempotency key, keyed to the threshold and the DAY: one mail per threshold
 * per day, no state table needed. Crossing a second, lower threshold sends
 * again, which is the point — $20 left is a different message from $50.
 */

import { NextResponse } from "next/server";

import { estimateBalance, getLlmSpend } from "@/lib/billing/llm-spend";
import { money } from "@/lib/billing/llm-rates";
import { sendEmail, renderEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Where to send it, and when to care.
 *
 * Read at REQUEST time rather than module load, so a change in Vercel takes
 * effect on the next run instead of the next cold start — the reengagement
 * cron's reasoning, and the same trap avoided.
 */
function config() {
  const thresholds = (process.env.LLM_ALARM_THRESHOLDS_USD ?? "25,10")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);

  return {
    // Comma-separated, because one address is a single point of failure and we
    // have already hit it: on 2026-10-04 every message to idoelad73@gmail.com
    // was accepted by Resend and never delivered, while lawpass10@gmail.com in
    // the same minute arrived. An alarm nobody receives is worse than none, so
    // it goes to more than one mailbox. `scripts/email-status.mjs` is how you
    // tell which of them are actually landing.
    to: (process.env.LLM_ALARM_EMAIL ?? "")
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean),
    anchorUsd: Number(process.env.LLM_BALANCE_ANCHOR_USD ?? ""),
    anchorAt: process.env.LLM_BALANCE_ANCHOR_AT ?? "",
    thresholds,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { to, anchorUsd, anchorAt, thresholds } = config();

  // Misconfiguration is reported as a 200 with a reason rather than an error:
  // a cron that goes red every morning because an env var is missing gets
  // muted, and a muted alarm is worse than none.
  if (to.length === 0 || !Number.isFinite(anchorUsd) || anchorUsd <= 0 || !anchorAt) {
    return NextResponse.json({
      ok: false,
      skipped:
        "set LLM_ALARM_EMAIL, LLM_BALANCE_ANCHOR_USD and LLM_BALANCE_ANCHOR_AT — read the last two from the Anthropic console",
    });
  }

  const spend = await getLlmSpend(anchorAt, 5);
  const balance = estimateBalance(anchorUsd, anchorAt, spend);

  // The lowest threshold already crossed, so a balance under both 25 and 10
  // sends the 10 — the more urgent message, not two mails.
  const crossed = thresholds.find((threshold) => balance.remaining <= threshold) ?? null;

  if (crossed === null) {
    return NextResponse.json({
      ok: true,
      remaining: balance.remaining,
      spentSince: balance.spentSince,
      nextThreshold: thresholds[0] ?? null,
      alerted: false,
    });
  }

  const unmeasured =
    spend.papersMissingUsage > 0
      ? `${spend.papersMissingUsage} ×  מבחנים שנוצרו לפני שהתחלנו לתעד שימוש אינם נספרים — ההוצאה בפועל גבוהה יותר.`
      : null;

  const result = await sendEmail({
    to,
    subject: `LawPass — יתרת Claude מוערכת ב-${money(balance.remaining)}`,
    html: renderEmail({
      heading: `יתרת Claude ירדה מתחת ל-${money(crossed)}`,
      preheader: `נותרו כ-${money(balance.remaining)} לפי השימוש שתועד`,
      paragraphs: [
        `היתרה המוערכת היא ${money(balance.remaining)}, מתוך ${money(balance.anchorDollars)} שנרשמו ב-${anchorAt}.`,
        `מאז נרשמה הוצאה של ${money(balance.spentSince)}.`,
        ...(unmeasured ? [unmeasured] : []),
        "זהו אומדן המבוסס על צריכת הטוקנים שנשמרה אצלנו, לא על נתוני החיוב של Anthropic. הסכום בפועל נמוך יותר או שווה.",
      ],
      cta: {
        label: "פתיחת מסך החיוב ב-Anthropic",
        url: "https://console.anthropic.com/settings/billing",
      },
    }),
    tags: { type: "llm-spend-alarm" },
    // One mail per threshold per day. A daily cron under a crossed threshold
    // would otherwise send every morning until someone topped up.
    idempotencyKey: `llm-spend-alarm:${crossed}:${new Date().toISOString().slice(0, 10)}`,
  });

  if (!result.ok) console.error("[llm-spend-alarm]", result.error);

  return NextResponse.json({
    ok: result.ok,
    remaining: balance.remaining,
    spentSince: balance.spentSince,
    crossed,
    alerted: result.ok,
    // The Resend id, so "the cron says it sent but nothing arrived" is an
    // answerable question: GET https://api.resend.com/emails/<id> reports
    // whether it was delivered, bounced or is still queued. Without it the
    // only evidence was a boolean, which cannot distinguish "Resend accepted
    // it" from "it reached an inbox".
    //
    // `dryRun` is surfaced for the same reason: EMAIL_DRY_RUN=1 returns ok
    // with a fabricated id, and a silently dry-running alarm looks exactly
    // like a working one.
    emailId: result.ok ? result.id : null,
    dryRun: result.ok ? result.dryRun : null,
    error: result.ok ? null : result.error,
    papersMissingUsage: spend.papersMissingUsage,
  });
}
