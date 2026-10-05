"use strict";

// Run one campaign: read the config, read the list, send, record.
//
// ── The sent log is the point of this file ─────────────────────────────────
// Every outcome is appended to logs/<campaignId>.jsonl the moment it happens,
// and the next run skips every number already logged as sent. That is what
// makes the script safe to re-run — and it WILL be re-run: a laptop sleeps,
// a connection drops, a terminal gets closed at 300 of 500. Without the log,
// the recovery for "it stopped halfway" is either messaging 300 people twice
// or hand-editing a CSV, and both of those are how a campaign ends up on the
// wrong side of the Anti-Spam Law.
//
// Appended line by line rather than written at the end, because the run that
// needs the log most is the one that was killed before it could finish.
//
// ── Why the concurrency is small ───────────────────────────────────────────
// Four at a time is roughly 500 messages a minute, which is fast enough that
// nobody waits and slow enough that a gateway with an undocumented rate limit
// does not start rejecting mid-campaign. Raising it buys seconds and risks
// the whole run.

const fs = require("node:fs");
const path = require("node:path");

const { loadRecipients } = require("./recipients");
const { mask } = require("./phone");
const {
  segmentsFor,
  sendOne,
  activeDriver,
  activeProvider,
  isDryProvider,
  resolveSender,
} = require("./provider");

const SMS_DIR = __dirname;
const LOGS_DIR = path.join(SMS_DIR, "logs");
const DEFAULT_CONFIG_PATH = path.join(SMS_DIR, "campaign.json");

const DEFAULTS = {
  campaignId: "default",
  sender: "LawPass",
  message: "",
  recipientsFile: "recipients.csv",
  maxPerRun: 500,
  concurrency: 4,
  pauseMs: 250,
};

/* -------------------------------------------------------------- the config */

/**
 * Read campaign.json and fail loudly on anything that would produce a bad
 * send. The checks are here rather than at the call site because a campaign
 * is not interactive once it starts: by the time an empty message would be
 * noticed, 500 people have received it.
 */
function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`קובץ ההגדרות לא נמצא: ${configPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^﻿/, ""));
  } catch (error) {
    throw new Error(`קובץ ההגדרות אינו JSON תקין (${configPath}): ${error.message}`);
  }

  const config = { ...DEFAULTS, ...parsed };

  if (!String(config.message || "").trim()) {
    throw new Error(`"message" ריק ב-${configPath}. אין מה לשלוח.`);
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(String(config.campaignId))) {
    // The id becomes a filename. Anything else is a path traversal waiting to
    // happen and an unreadable log directory in the meantime.
    throw new Error(`"campaignId" חייב להיות אותיות/ספרות/מקף בלבד (קיבלנו: ${config.campaignId}).`);
  }

  config.maxPerRun = clampPositive(config.maxPerRun, DEFAULTS.maxPerRun);
  config.concurrency = Math.min(clampPositive(config.concurrency, DEFAULTS.concurrency), 10);
  config.pauseMs = Number.isFinite(Number(config.pauseMs)) ? Math.max(0, Number(config.pauseMs)) : DEFAULTS.pauseMs;
  config.configPath = configPath;
  config.recipientsPath = path.isAbsolute(config.recipientsFile)
    ? config.recipientsFile
    : path.join(SMS_DIR, config.recipientsFile);

  return config;
}

function clampPositive(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * The exact text that goes out.
 *
 * `message` is the whole body. The opt-out line is appended separately so it
 * cannot be edited away by accident — an Israeli marketing SMS without a way
 * to refuse is a דבר פרסומת sent unlawfully, and the statutory damages are
 * per message, so 500 of them is the expensive kind of mistake.
 */
function buildBody(config) {
  const message = String(config.message).trim();
  const optOut = String(config.optOutLine ?? 'להסרה השיבו "הסר".').trim();
  if (!optOut) return message;
  return message.includes(optOut) ? message : `${message}\n${optOut}`;
}

/* ------------------------------------------------------------- the sent log */

function logPath(campaignId) {
  return path.join(LOGS_DIR, `${campaignId}.jsonl`);
}

/**
 * Numbers this campaign has already reached, as a Set of E.164 strings.
 *
 * Only `sent` counts. A failure is deliberately retryable: a number that the
 * gateway rejected once because of a transient error should get another
 * chance on the next run, which is the whole reason the status is recorded
 * rather than just the fact of an attempt.
 */
function readSentNumbers(campaignId) {
  const file = logPath(campaignId);
  if (!fs.existsSync(file)) return new Set();

  const sent = new Set();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.status === "sent" && entry.phone) sent.add(entry.phone);
    } catch {
      // A truncated last line is what a killed process leaves behind. Skipping
      // it is right: the alternative is refusing to run until a human edits a
      // log file by hand.
    }
  }
  return sent;
}

function appendLog(campaignId, entry) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.appendFileSync(logPath(campaignId), `${JSON.stringify(entry)}\n`, "utf8");
}

/* ------------------------------------------------------------------ the run */

/** An empty parse result, for a run that never reads a file. */
function emptyParse(label) {
  return { file: label, rows: 0, recipients: [], duplicates: [], invalid: [], headerSkipped: false };
}

/**
 * Everything the preview needs to know, without sending anything.
 *
 * Returns the parsed file, the resolved body, its real cost in segments, and
 * the split between who is pending and who the log says was already reached.
 *
 * `only` replaces the file with an explicit list of E.164 numbers — that is
 * the single-number test path, and it deliberately does not read the sent log
 * or the recipient file, so proving the pipeline never depends on a campaign
 * being set up and never marks a real recipient as done.
 */
function planCampaign(config, { file, limit, resend, only } = {}) {
  const body = buildBody(config);

  if (only) {
    const cost = segmentsFor(body);
    const targets = only.map((phone, index) => ({ phone, masked: mask(phone), row: index + 1 }));
    return {
      parsed: emptyParse("(--to)"),
      body,
      cost,
      sender: resolveSender(config.sender),
      provider: activeProvider(),
      dry: isDryProvider(),
      skipped: [],
      pending: targets,
      targets,
      deferred: 0,
      messageCount: targets.length * cost.segments,
      adHoc: true,
    };
  }

  const parsed = loadRecipients(file || config.recipientsPath);
  const cost = segmentsFor(body);
  const alreadySent = resend ? new Set() : readSentNumbers(config.campaignId);
  const skipped = parsed.recipients.filter((r) => alreadySent.has(r.phone));
  const pending = parsed.recipients.filter((r) => !alreadySent.has(r.phone));
  const max = clampPositive(limit, config.maxPerRun);
  const targets = pending.slice(0, max);

  return {
    parsed,
    body,
    cost,
    sender: resolveSender(config.sender),
    provider: activeProvider(),
    dry: isDryProvider(),
    skipped,
    pending,
    targets,
    deferred: Math.max(0, pending.length - targets.length),
    // What the run will actually be billed: a Hebrew body is rarely one
    // segment, so this is the number that matters when buying a package.
    messageCount: targets.length * cost.segments,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything that must be true before the FIRST send, checked once.
 *
 * A missing credential is not a per-recipient failure, and treating it as one
 * is how a single typo becomes 500 identical error lines, 500 log rows, and a
 * sent log that has to be cleaned up by hand. These conditions cannot change
 * mid-run, so they are answered before the run exists.
 */
function preflight(plan) {
  activeDriver();
  if (!plan.sender) {
    throw new Error(
      'לא הוגדר שם שולח. הגדירו "sender" ב-lib/sms/campaign.json (למשל "LawPass") ' +
        "או SMS_SENDER ב-app/.env.local."
    );
  }
}

/**
 * Send to everyone in `plan.targets`.
 *
 * Each outcome is logged before the next send starts, and `onResult` is
 * called so the caller can print progress. A single failure never stops the
 * run — one bad number out of 500 is normal, and aborting would leave the
 * rest unsent for no reason.
 */
async function runCampaign(config, plan, { onResult } = {}) {
  preflight(plan);

  const summary = { sent: 0, failed: 0, startedAt: new Date().toISOString() };
  const queue = [...plan.targets];

  // A --to test writes to its own log. Sharing the campaign's log would mark
  // a real recipient as already reached, and the person most likely to be in
  // both places is whoever is running the test.
  const logId = plan.adHoc ? `${config.campaignId}-test` : config.campaignId;

  async function worker() {
    while (queue.length) {
      const target = queue.shift();
      if (!target) break;

      const entry = {
        ts: new Date().toISOString(),
        campaignId: logId,
        phone: target.phone,
        masked: target.masked,
        row: target.row,
        provider: plan.provider,
        sender: plan.sender,
        segments: plan.cost.segments,
      };

      try {
        const { ref } = await sendOne({ to: target.phone, body: plan.body, sender: plan.sender });
        Object.assign(entry, { status: "sent", ref });
        summary.sent += 1;
      } catch (error) {
        Object.assign(entry, { status: "failed", error: error?.message || "unknown" });
        summary.failed += 1;
      }

      appendLog(logId, entry);
      if (onResult) onResult(entry, summary);
      if (config.pauseMs) await sleep(config.pauseMs);
    }
  }

  const lanes = Math.max(1, Math.min(config.concurrency, queue.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));

  summary.finishedAt = new Date().toISOString();
  summary.logFile = logPath(logId);
  return summary;
}

module.exports = {
  loadConfig,
  buildBody,
  planCampaign,
  preflight,
  runCampaign,
  readSentNumbers,
  logPath,
  DEFAULT_CONFIG_PATH,
  SMS_DIR,
};
