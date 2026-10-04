/**
 * Resend transport — the one place LawPass hands an email to a provider.
 *
 * ── Why this lives in the Next app, not lawpass_server ─────────────────────
 * Long term it belongs with the rest of the backend. Today it cannot: the
 * Express server is not deployed (`.env.example`: "leave this UNSET until the
 * Express server is deployed"), so an email module over there would send
 * nothing in production. This file therefore imports NOTHING from Next — no
 * `next/*`, no React, no Supabase — and reads only `process.env` and global
 * `fetch`. Moving it to `lawpass_server/lib/email/` later is a file move plus
 * a change of module syntax, not a rewrite.
 *
 * ── Why no `resend` npm package ────────────────────────────────────────────
 * Sending is one authenticated POST of a JSON body. The SDK's value is in the
 * parts we do not use (React email rendering, audiences, broadcasts). This
 * follows the same call the server already makes for Cloudinary — see
 * lawpass_server/lib/cloudinary.js, which reasons through the identical trade
 * — and keeps a dependency out of package.json, which after the lockfile
 * incident of 2026-09-06 is worth something on its own.
 *
 * ── What this adds over a bare `resend.emails.send` ────────────────────────
 * A one-line wrapper is what TradeLink has (`server/utils/mailer.js`). It is
 * fine until the first time a Vercel function retries a request, or Resend
 * rate-limits, or the network hangs. This adds the four things that turn a
 * send into infrastructure: a timeout, bounded retries, an idempotency key so
 * those retries cannot double-send, and a result object instead of a throw so
 * a failed notification never takes down the action that triggered it.
 */

/** Resend's send endpoint. */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Per-attempt ceiling. A hung provider must not hold a request open. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Total attempts, including the first. Retries are backed off below. */
const MAX_ATTEMPTS = 3;

/** Backoff before attempt 2 and attempt 3. */
const RETRY_DELAYS_MS = [250, 1_000];

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  /** The HTML body. Use renderEmail() from ./layout to build it. */
  html: string;
  /**
   * Plain-text alternative. Derived from `html` when omitted.
   *
   * Not optional in spirit: a message with no text part looks like bulk mail
   * to spam filters and is unreadable in a text-only client.
   */
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  /** Resend tags, for filtering in their dashboard. Values must be ASCII. */
  tags?: Record<string, string>;
  /**
   * Extra MIME headers.
   *
   * The ones that matter are `List-Unsubscribe` and
   * `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Together they put the
   * native "Unsubscribe" control next to the sender name in Gmail, and their
   * presence is one of the signals Gmail uses to decide inbox versus spam for
   * lifecycle mail. Send them on anything a candidate did not personally ask
   * for; leave them off genuinely transactional mail.
   */
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer | string }[];
  /**
   * Overrides the generated idempotency key.
   *
   * Pass a STABLE key derived from the thing being notified about — say
   * `welcome:${userId}` — when the same logical email might be triggered by
   * two different code paths. Leave unset and each call gets a fresh UUID,
   * which still protects that call's own retries.
   */
  idempotencyKey?: string;
};

/** What Resend answers with: `id` on success, `message`/`name` on rejection. */
type ResendResponse = { id?: string; message?: string; name?: string };

export type SendEmailResult =
  | { ok: true; id: string; dryRun: boolean }
  | { ok: false; error: string; status?: number; retryable: boolean };

export type EmailConfig = {
  apiKey: string;
  from: string;
  replyTo: string;
  dryRun: boolean;
};

/**
 * Reads configuration at CALL time rather than module load.
 *
 * Module-load reads bake whatever the environment held when the bundle was
 * first imported, which in a serverless runtime is not reliably after the
 * platform has injected env vars — and it makes the module untestable without
 * re-import tricks.
 */
export function readEmailConfig(): EmailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.RESEND_FROM_EMAIL ?? "",
    replyTo: process.env.RESEND_REPLY_TO ?? "",
    // Explicit opt-in only. A dry run that switched itself on by guessing the
    // environment would eventually swallow real production mail.
    dryRun: process.env.EMAIL_DRY_RUN === "1",
  };
}

/**
 * True when a real send is possible.
 *
 * Deliberately requires BOTH the key and the from-address. Resend rejects a
 * send from an unverified domain, so a key with no configured sender is not
 * "partly working" — it fails on every message, at send time, in production.
 */
export function isEmailConfigured(config: EmailConfig = readEmailConfig()): boolean {
  return Boolean(config.apiKey && config.from);
}

/** Never let a key reach a log. */
function redact(apiKey: string): string {
  if (!apiKey) return "(unset)";
  return `${apiKey.slice(0, 8)}…(${apiKey.length} chars)`;
}

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/**
 * The cheapest check that catches the mistakes that actually happen: an empty
 * string, a name with no address, a stray "undefined" from a template.
 * Full RFC 5322 validation is not the goal — Resend rejects a bad address and
 * says so, and this only exists to fail before the network call.
 */
function looksLikeAddress(value: string): boolean {
  const bare = value.includes("<") ? (value.split("<")[1] ?? "").replace(">", "") : value;
  const trimmed = bare.trim();
  return trimmed.length > 2 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(trimmed);
}

/** Strips tags for the plain-text alternative when the caller supplies none. */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Retryable: the provider or the network might succeed on a second look. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Send one email.
 *
 * NEVER THROWS on a delivery problem — it returns `{ ok: false }`. Email is
 * almost always a side effect of something more important (an account was
 * created, an exam was marked), and a provider outage must not roll that back
 * or surface as a 500. Callers decide whether a failure is worth surfacing;
 * the reason is always in the result.
 *
 * It DOES throw on a programming error — a missing subject, a malformed
 * address — because those are bugs to fix, not conditions to handle.
 *
 * @param fetchImpl injectable for tests; defaults to global fetch.
 */
export async function sendEmail(
  input: SendEmailInput,
  fetchImpl: typeof fetch = fetch
): Promise<SendEmailResult> {
  // The API key must never be bundled into client JavaScript. If this module
  // is ever imported from a Client Component, fail loudly here rather than
  // shipping the key to every visitor.
  if (typeof window !== "undefined") {
    throw new Error("lib/email is server-only — it must not be imported from a Client Component");
  }

  const to = asArray(input.to);
  if (to.length === 0) throw new Error("sendEmail: `to` is required");
  for (const address of to) {
    if (!looksLikeAddress(address)) {
      throw new Error(`sendEmail: '${address}' is not a usable email address`);
    }
  }
  if (!input.subject?.trim()) throw new Error("sendEmail: `subject` is required");
  if (!input.html?.trim()) throw new Error("sendEmail: `html` is required");

  const config = readEmailConfig();

  if (!isEmailConfigured(config)) {
    // Matches how Cloudinary is treated: a missing optional credential is
    // reported, never a boot failure and never a silent success.
    const missing = [
      !config.apiKey ? "RESEND_API_KEY" : null,
      !config.from ? "RESEND_FROM_EMAIL" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    return {
      ok: false,
      error: `email is not configured (${missing} unset)`,
      retryable: false,
    };
  }

  const idempotencyKey = input.idempotencyKey ?? globalThis.crypto.randomUUID();

  const payload: Record<string, unknown> = {
    from: config.from,
    to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? htmlToText(input.html),
  };
  const replyTo = input.replyTo ?? config.replyTo;
  if (replyTo) payload.reply_to = replyTo;
  if (asArray(input.cc).length) payload.cc = asArray(input.cc);
  if (asArray(input.bcc).length) payload.bcc = asArray(input.bcc);
  if (input.tags) {
    payload.tags = Object.entries(input.tags).map(([name, value]) => ({ name, value }));
  }
  if (input.headers && Object.keys(input.headers).length) {
    payload.headers = input.headers;
  }
  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      // The REST API takes base64, unlike the SDK which accepts a Buffer.
      content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content,
    }));
  }

  if (config.dryRun) {
    // Logged, not sent. The recipient and subject are here so a developer can
    // see the message was composed; the body is not, because it routinely
    // contains a candidate's name or a sign-in link.
    console.info(
      `[email] DRY RUN — not sent. to=${to.join(", ")} subject=${JSON.stringify(input.subject)} ` +
        `from=${config.from} key=${redact(config.apiKey)}`
    );
    return { ok: true, id: `dry-run-${idempotencyKey}`, dryRun: true };
  }

  let lastError = "email send failed";
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // A fresh signal per attempt: an aborted one stays aborted.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          // Makes the retries above safe. If Resend ever stops honouring this
          // header the send still works — it just loses the duplicate
          // protection, which is why retries are capped at three.
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let body: ResendResponse | null = null;
      try {
        body = (await response.json()) as ResendResponse;
      } catch {
        // A non-JSON body (an HTML error page from a proxy, an empty 502).
        // The status still tells us whether to retry.
        body = null;
      }

      if (response.ok && body?.id) {
        // ACCEPTED IS NOT DELIVERED, AND THE DIFFERENCE IS WHY THIS LOG EXISTS.
        //
        // Resend answers 200 with an id the moment it takes the message. What
        // happens next — queued, delivered, bounced, or silently discarded by
        // the receiving provider — is a separate event this process never
        // sees. On 2026-10-04 three messages to one Gmail address sat at
        // `last_event: "sent"` and never reached the inbox, while messages to
        // a different Gmail address delivered normally; the only evidence was
        // `{ok: true}` in a cron response, which could not tell the two apart.
        //
        // The id is what turns that into an answerable question:
        //   curl -H "Authorization: Bearer $RESEND_API_KEY" \
        //        https://api.resend.com/emails/<id>
        //
        // Address and subject are logged, body is not: it routinely carries a
        // candidate's name or a sign-in link.
        console.info(
          `[email] accepted by Resend id=${body.id} to=${to.join(", ")} ` +
            `subject=${JSON.stringify(input.subject)} attempt=${attempt}`
        );
        return { ok: true, id: body.id, dryRun: false };
      }

      lastStatus = response.status;
      lastError = body?.message ?? body?.name ?? `Resend returned status ${response.status}`;

      if (!isRetryableStatus(response.status)) {
        // 401 (bad key), 403 (unverified domain), 422 (bad payload) — retrying
        // changes nothing and only delays the caller.
        console.error(
          `[email] REJECTED status=${response.status} to=${to.join(", ")} ` +
            `subject=${JSON.stringify(input.subject)} reason=${JSON.stringify(lastError)}`
        );
        return { ok: false, error: lastError, status: response.status, retryable: false };
      }
    } catch (error) {
      // Network failure or the timeout above firing. Both are worth retrying.
      lastError =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Resend did not respond within ${REQUEST_TIMEOUT_MS}ms`
            : error.message
          : String(error);
    } finally {
      clearTimeout(timer);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 1_000);
  }

  return { ok: false, error: lastError, status: lastStatus, retryable: true };
}
