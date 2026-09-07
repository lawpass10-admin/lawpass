/**
 * The re-engagement cron: email candidates who have gone quiet for 24 hours.
 *
 * Triggered by Vercel Cron (see vercel.json), which calls this with
 * `Authorization: Bearer $CRON_SECRET`. Not reachable without that header —
 * the endpoint sends real email to real people, so an open URL would be a
 * button anyone on the internet could press.
 *
 * ── The schedule is DAILY, and must stay that way on the Hobby plan ────────
 * vercel.json runs this at 06:00 UTC (09:00 Israel). It was hourly for one
 * commit, which the Hobby plan does not allow — and the failure mode is
 * peculiar: the deployment is never created, so there is no failed build in
 * the dashboard, just an old version that will not update. If you ever see
 * Vercel silently stop deploying, check the cron frequency here first.
 *
 * A daily run does not change the 24-hour rule. It changes latency: someone
 * who goes quiet at noon is picked up the following morning rather than at
 * the top of the next hour. Going hourly needs a Pro plan.
 *
 * ── Why the batch is small ─────────────────────────────────────────────────
 * A serverless function has a wall-clock limit, and Resend rate-limits
 * requests per second. Sending "everyone who qualifies" in one invocation
 * would hit both. So each run takes a bounded batch, oldest-inactive first,
 * and the schedule catches up over subsequent runs. A backlog drains; a
 * timeout halfway through a send loop leaves no record of what was sent.
 */

import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { buildReengagementEmail, type Gender } from "@/lib/email/templates/reengagement";
import { unsubscribeUrl } from "@/lib/email/unsubscribe-token";
import { fetchReengagementCandidates, recordNudge } from "@/lib/db/reengagement";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Ample for a batch of this size; well under the platform ceiling. */
export const maxDuration = 60;

/**
 * Resend's default rate limit is a couple of requests a second. Pacing the
 * loop is cheaper than relying on the client's 429 retry, which would spend
 * the function's time budget backing off.
 */
const SEND_INTERVAL_MS = 400;

/**
 * Reads a tuning value from the environment.
 *
 * Read at REQUEST time, not module load, so changing the value in Vercel takes
 * effect on the next cron run rather than the next cold start.
 *
 * Anything that is not a positive whole number falls back to the default and
 * says so. A typo like `24h` or an accidentally blank value would otherwise
 * become NaN, and NaN reaches Postgres as a broken interval — either an error
 * or, worse, a threshold nobody intended. The fallback keeps the job running
 * on sane numbers while the log says what was ignored.
 */
function tuning(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.warn(`[reengagement] ${name}=${JSON.stringify(raw)} is not a positive whole number — using ${fallback}`);
    return fallback;
  }
  return value;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // No secret configured means the endpoint is closed, not open. Failing open
  // here would expose a send button on every preview deployment.
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    // Every link in the email is absolute. Without this the CTA would point at
    // "undefined/login", so refuse rather than send a broken email to hundreds
    // of people.
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is not set" }, { status: 500 });
  }

  const admin = createAdminClient();

  // All four thresholds are environment-tunable, so changing how aggressive
  // the nudge is takes a Vercel setting and a redeploy — not a code change.
  const settings = {
    /** Silence before a nudge is due. The headline number. */
    inactiveHours: tuning("REENGAGEMENT_INACTIVE_HOURS", 24),
    /** Minimum gap between two nudges to one person. Default 7 days. */
    cooldownHours: tuning("REENGAGEMENT_COOLDOWN_HOURS", 168),
    /** Nudges one person will ever get before we stop asking. */
    maxNudges: tuning("REENGAGEMENT_MAX_NUDGES", 3),
    /** 25 × 400ms ≈ 10s of sending — comfortable inside maxDuration. */
    batchLimit: tuning("REENGAGEMENT_BATCH_LIMIT", 25),
  };

  let candidates;
  try {
    candidates = await fetchReengagementCandidates(admin, settings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[reengagement]", reason);
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  const results = { considered: candidates.length, sent: 0, failed: 0 };

  for (const [index, candidate] of candidates.entries()) {
    if (index > 0) await sleep(SEND_INTERVAL_MS);

    const optOutUrl = unsubscribeUrl(siteUrl, candidate.user_id);
    const { subject, html } = buildReengagementEmail({
      fullName: candidate.full_name,
      gender: candidate.gender as Gender | null,
      loginUrl: `${siteUrl.replace(/\/+$/, "")}/login`,
      unsubscribeUrl: optOutUrl,
    });

    const result = await sendEmail({
      to: candidate.user_email,
      subject,
      html,
      tags: { type: "reengagement" },
      headers: {
        "List-Unsubscribe": `<${optOutUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      // Stable, and scoped to the day: if this route is somehow invoked twice
      // in one day — a retried cron, a manual curl — Resend collapses the
      // duplicate instead of sending the same person two copies.
      idempotencyKey: `reengagement:${candidate.user_id}:${new Date().toISOString().slice(0, 10)}`,
    });

    if (result.ok) results.sent++;
    else {
      results.failed++;
      console.error("[reengagement] send failed", candidate.user_id, result.error);
    }

    await recordNudge(admin, {
      userId: candidate.user_id,
      providerId: result.ok ? result.id : null,
      delivered: result.ok,
    });
  }

  console.info(
    `[reengagement] considered=${results.considered} sent=${results.sent} ` +
      `failed=${results.failed} inactiveHours=${settings.inactiveHours}`
  );
  // The thresholds come back with the counts, so a dry run tells you which
  // settings produced that list — otherwise "considered: 0" is ambiguous
  // between "nobody is idle" and "the env var did not take effect".
  return NextResponse.json({ ...results, settings });
}
