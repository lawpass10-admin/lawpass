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
