/**
 * Signed one-click unsubscribe links.
 *
 * ── Why a signature and not just the user id ───────────────────────────────
 * The link has to work without logging in — a candidate who has stopped using
 * the product will not sign in to stop being emailed, and an unsubscribe that
 * demands a password is not an unsubscribe. That means the URL itself is the
 * authorisation, so `?u=<uuid>` alone would let anyone who guessed or scraped
 * an id silence someone else's mail. The HMAC makes the link unforgeable
 * without granting any other access: it proves we issued it, and it proves
 * nothing else.
 *
 * ── Why it never expires ───────────────────────────────────────────────────
 * People unsubscribe from the email they happen to find, which may be months
 * old. An expired opt-out link is a broken opt-out.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Any stable server-side secret works. It falls back to SUPABASE_SECRET_KEY so
 * the feature cannot silently ship with an empty key and produce signatures
 * that anyone can reproduce — but set EMAIL_UNSUBSCRIBE_SECRET properly, so
 * that rotating one secret does not invalidate the other's job.
 */
function secret(): string {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new Error(
      "unsubscribe links need EMAIL_UNSUBSCRIBE_SECRET (or SUPABASE_SECRET_KEY) to be set"
    );
  }
  return value;
}

/** The token for one user id. base64url so it is URL-safe without escaping. */
export function signUnsubscribe(userId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url");
}

/**
 * Constant-time check.
 *
 * `===` on a signature leaks, through timing, how many leading bytes were
 * correct — enough to reconstruct one byte at a time given enough attempts.
 * timingSafeEqual is the fix, and it throws on a length mismatch, hence the
 * explicit length guard first.
 */
export function verifyUnsubscribe(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(signUnsubscribe(userId));
  const given = Buffer.from(token);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/** The absolute URL that goes into an email footer. */
export function unsubscribeUrl(siteUrl: string, userId: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${signUnsubscribe(userId)}`;
}
