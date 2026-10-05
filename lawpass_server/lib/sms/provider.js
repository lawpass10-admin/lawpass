"use strict";

// The SMS gateway. One send, one number.
//
// ── Why there is no bulk call ──────────────────────────────────────────────
// SMS4Free's v2 SendSMS takes a single `recipient`. Their own docs do not
// state that a comma-separated list works, so the campaign loops instead of
// guessing: 500 small requests that each report their own outcome, rather
// than one request that either worked or did not and cannot say for whom.
// At the concurrency in campaign.js that is well under a minute, which is
// nothing against the cost of not knowing who was actually reached.
//
// ── The two things a driver must get right ─────────────────────────────────
// 1. Hebrew is UCS-2, so a segment is 70 characters, not 160. A message that
//    looks short in English is three segments in Hebrew and costs three times
//    what was budgeted. `segmentsFor` is exported so the preview can price a
//    campaign BEFORE any of it is paid for.
// 2. A number only ever arrives here in E.164. `lib/sms/phone.js` is the one
//    normaliser; this file converts to the gateway's local format and nothing
//    more.

const { env } = require("../../config/env");
const { toLocal } = require("./phone");

/** Anything outside this set forces UCS-2, which halves the segment size. */
const GSM7 =
  /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

/**
 * How many messages one body actually costs.
 *
 * A Hebrew body of 71 characters is two messages, not one — the single most
 * common way an SMS budget doubles without anyone noticing.
 */
function segmentsFor(body) {
  const text = String(body ?? "");
  const unicode = !GSM7.test(text);
  const single = unicode ? 70 : 160;
  const multipart = unicode ? 67 : 153;
  if (text.length <= single) return { segments: 1, unicode, limit: single };
  return { segments: Math.ceil(text.length / multipart), unicode, limit: multipart };
}

/* ------------------------------------------------------------- the drivers */

/**
 * Sends nothing. Prints everything.
 *
 * The default on purpose. A half-configured environment should reach nobody
 * rather than quietly message 500 real people, so a driver is opted into by
 * setting SMS_PROVIDER and is never inferred from credentials happening to
 * be present.
 */
const mock = {
  name: "mock",
  isConfigured: () => true,
  async send() {
    return { ref: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  },
};

/**
 * SMS4Free — an Israeli gateway. Messages arrive from an Israeli number
 * rather than a foreign one, and the per-message price is a fraction of what
 * an international gateway charges for Israel.
 *
 * Credentials come from the account dashboard: key / user / password.
 */
const sms4free = {
  name: "sms4free",
  isConfigured: () => {
    const c = env.sms.sms4free;
    return Boolean(c.key && c.user && c.password);
  },
  async send({ to, body, sender }) {
    const c = env.sms.sms4free;
    const res = await fetch("https://api.sms4free.co.il/ApiSMS/v2/SendSMS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: c.key,
        user: c.user,
        pass: c.password,
        sender,
        recipient: toLocal(to),
        msg: body,
      }),
    });
    return parseSms4freeResponse(res.ok, await res.text(), sender);
  },
};

/**
 * Read an SMS4Free response.
 *
 * The gateway answers in two shapes — a bare number, and a JSON object with
 * `status` and `message` — and both mean the same thing: positive is the
 * number of messages sent, zero or negative is an error code.
 *
 * Exported so both shapes can be tested without spending a message. That seam
 * is worth having: a reader that only understands the bare number parses
 * {"status":1,"message":"Succeeded"} as a failure, and the retry that follows
 * sends the whole campaign twice.
 */
function parseSms4freeResponse(httpOk, text, sender) {
  let status;
  let message;

  try {
    const parsed = JSON.parse(text);
    // JSON.parse("3") succeeds and returns the number 3, so "is it JSON" is
    // not the question — "is it an object" is. Reading .status off a number
    // yields undefined, which is how a bare success reads as a failure.
    if (parsed && typeof parsed === "object") {
      status = Number(parsed.status);
      message = String(parsed.message ?? "").trim();
    } else {
      status = Number(parsed);
      message = String(text).trim();
    }
  } catch {
    status = Number(text);
    message = String(text).trim();
  }

  if (httpOk && Number.isFinite(status) && status > 0) {
    return { ref: `sms4free-${status}` };
  }

  // -2 is the usual first failure and the gateway's own wording ("Massage
  // sender name or number is incorrect") does not say why. The real reason is
  // almost always the sender NAME: an alphanumeric sender such as "LawPass"
  // needs a paid package and, in Israel, carrier pre-registration of the name,
  // which takes days. Until that clears, the sender must be the number the
  // account was registered with — which is why the message body says LawPass
  // in its first word rather than relying on the header alone.
  if (status === -2) {
    throw new Error(
      `הספק דחה את שם השולח "${sender}". שם שולח באותיות (כמו LawPass) דורש חבילה בתשלום ` +
        "ורישום מראש מול המפעילים. עד שזה מאושר — הגדירו sender למספר שאיתו נרשמתם ב-SMS4Free."
    );
  }

  throw new Error(
    `שליחת ההודעה נכשלה (${Number.isFinite(status) ? status : "?"}: ${message || "ללא פירוט"}).`
  );
}

const DRIVERS = { mock, sms4free };

/** The driver named by SMS_PROVIDER. Throws if it is unknown or unconfigured. */
function activeDriver() {
  const chosen = DRIVERS[env.sms.provider];
  if (!chosen) {
    throw new Error(
      `ספק SMS לא מוכר: "${env.sms.provider}". ערכים אפשריים: ${Object.keys(DRIVERS).join(", ")}.`
    );
  }
  if (!chosen.isConfigured()) {
    throw new Error(
      `ספק ה-SMS (${chosen.name}) אינו מוגדר במלואו — חסרים SMS4FREE_KEY / SMS4FREE_USER / ` +
        "SMS4FREE_PASSWORD ב-app/.env.local."
    );
  }
  return chosen;
}

/** Which driver is active, for a preview that wants to say so. */
const activeProvider = () => env.sms.provider;

/** True when nothing actually leaves the machine. */
const isDryProvider = () => env.sms.provider === "mock";

/**
 * The name the SMS appears to come from.
 *
 * campaign.json's `sender` wins, because it is the campaign's own identity
 * and belongs with the message text. SMS_SENDER stays as a fallback for an
 * environment that has to override it without editing a committed file.
 */
function resolveSender(configured) {
  return String(configured || env.sms.sender || "").trim();
}

/**
 * Send one message.
 *
 * Resolves to `{ provider, ref }` and throws otherwise, so the campaign
 * records both outcomes against the same number in the same place.
 */
async function sendOne({ to, body, sender }) {
  if (!to) throw new Error("מספר נייד חסר.");
  if (!String(body || "").trim()) throw new Error("גוף ההודעה ריק.");

  const from = resolveSender(sender);
  if (!from) {
    throw new Error(
      'לא הוגדר שם שולח. הגדירו "sender" ב-lib/sms/campaign.json (למשל "LawPass") ' +
        "או SMS_SENDER ב-app/.env.local."
    );
  }

  const driver = activeDriver();
  const { ref } = await driver.send({ to, body, sender: from });
  return { provider: driver.name, ref };
}

module.exports = {
  segmentsFor,
  sendOne,
  activeDriver,
  activeProvider,
  isDryProvider,
  resolveSender,
  parseSms4freeResponse,
};
