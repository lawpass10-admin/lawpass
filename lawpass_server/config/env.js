"use strict";

// Loads and validates environment. SECRETS LIVE ONLY IN A .env FILE —
// never hardcoded here. Fails fast on missing required vars so the process
// never boots half-configured.
//
// The env path is resolved so production can keep the file OUTSIDE the
// server directory. Priority:
//   1. LAWPASS_ENV_PATH      — explicit path. Point this at the env file
//                              outside the server dir in production.
//   2. <server>/../.env.local — the CONSOLIDATED single source of truth,
//                              shared with the Next.js app (app/.env.local).
//                              This is the file both servers read in dev.
//   3. <server>/../.env       — fallback (legacy).
//   4. <server>/.env          — fallback (legacy server-local).
// The first file that exists wins.

const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const SERVER_ROOT = path.resolve(__dirname, "..");

const candidates = [
  process.env.LAWPASS_ENV_PATH
    ? path.resolve(process.env.LAWPASS_ENV_PATH)
    : null,
  // Consolidated single source of truth, shared with the Next.js app
  // (app/.env.local). This is the file both servers read in local dev.
  path.resolve(SERVER_ROOT, "..", ".env.local"),
  // Fallbacks (legacy split-env layout — kept only for resilience).
  path.resolve(SERVER_ROOT, "..", ".env"),
  path.join(SERVER_ROOT, ".env"),
].filter(Boolean);

const envFile = candidates.find((p) => fs.existsSync(p)) || null;
if (envFile) {
  dotenv.config({ path: envFile });
} else {
  // No .env found — fall back to whatever is already in the environment
  // (e.g. real process env in a container, or vars exported by the shell).
  dotenv.config();
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] missing required environment variable: ${name}` +
        (envFile ? ` (loaded ${envFile})` : " (no .env file found)")
    );
  }
  return value;
}

/**
 * A tuning knob that must be a whole number of at least 1.
 *
 * Anything else — a typo, an empty string, a decimal, a zero — falls back to
 * the default with a warning rather than taking effect. A quota that reads as
 * NaN and compares false against every count is a quota that silently does not
 * exist, and the way you find out is the bill.
 */
function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    console.warn(
      `[env] ${name}="${raw}" is not a whole number >= 1 — using ${fallback} instead.`
    );
    return fallback;
  }
  return value;
}

const env = {
  // Absolute path of the .env that was loaded (null if none) — logged at
  // startup for transparency. Never contains a secret value.
  envFile,

  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Supabase — same values the Next.js app uses. Sourced from the .env file.
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: required("SUPABASE_SECRET_KEY"),

  // Absolute site URL of the Next.js frontend — the single source of truth
  // for links baked into emails (e.g. the admin-initiated password-reset
  // redirectTo). Non-secret; optional (empty string when unset, matching
  // the Next.js `process.env.NEXT_PUBLIC_SITE_URL ?? ""` fallback).
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",

  // Cloudinary — where handwritten answer pages are stored.
  //
  // NOT `required()`, unlike Supabase: the server has to boot without it. Every
  // other feature works with no Cloudinary account at all, and refusing to start
  // would turn a missing optional credential into a total outage. The upload
  // endpoint checks isConfigured() and answers with a clear message instead.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    // Root folder for uploads; per-user/per-question subfolders hang off it.
    folder: process.env.CLOUDINARY_FOLDER || "lawpass/handwriting",
  },

  // Writing tasks (מטלת כתיבה).
  openQuestions: {
    // How many COMPLETED markings one student may have on one task. Each one
    // is a model call we pay for, and nothing else bounds how many times the
    // same task can be submitted.
    //
    // Here rather than in the database on purpose: this is the number most
    // likely to be tuned once there is real usage, and it should be tunable by
    // editing .env.local and restarting — not by writing a migration.
    //
    // Only a grading that WROTE A SCORE counts, so a failed marking stays
    // retryable and never consumes the allowance. See
    // supabase/migrations/20261005000001_open_question_grades_counts.sql.
    maxGradesPerQuestion: positiveInt("OPEN_QUESTION_MAX_GRADES", 1),
  },

  // SMS — the outbound campaign gateway (lib/sms).
  //
  // NOT `required()`, for the same reason as Cloudinary: the API has no SMS
  // endpoint, so a missing credential must not keep the server from booting.
  // The provider defaults to "mock", which prints instead of sending — a
  // half-configured environment reaches nobody rather than quietly messaging
  // hundreds of real people. `sms4free` is opted into explicitly.
  sms: {
    provider: process.env.SMS_PROVIDER || "mock",
    // Fallback only. The campaign's own sender lives in
    // lib/sms/campaign.json, next to the message text it belongs with.
    sender: process.env.SMS_SENDER || "",
    sms4free: {
      key: process.env.SMS4FREE_KEY || "",
      user: process.env.SMS4FREE_USER || "",
      password: process.env.SMS4FREE_PASSWORD || "",
    },
  },

  // Comma-separated allowed CORS origins (the Next.js frontend).
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

module.exports = { env };
