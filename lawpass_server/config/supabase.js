"use strict";

const { createClient } = require("@supabase/supabase-js");
const { env } = require("./env");

// Base options shared by every client — this is a stateless server, so we
// never persist or auto-refresh sessions.
const AUTH_OPTS = { autoRefreshToken: false, persistSession: false };

/**
 * Anonymous/public client — no user context. Rarely needed directly;
 * prefer `clientForToken` so RLS sees the authenticated user.
 */
function anonClient() {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: AUTH_OPTS,
  });
}

/**
 * RLS-scoped client bound to a user's Supabase access token. Every
 * PostgREST request carries the JWT in the Authorization header, so
 * `(SELECT auth.uid())` policies apply exactly as they do in the Next.js
 * SSR client. This is the DEFAULT client for all user-triggered
 * endpoints (Hardening Rule #2 — RLS-first).
 */
function clientForToken(accessToken) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: AUTH_OPTS,
  });
}

/**
 * Service-role client — BYPASSES RLS. Only for admin/webhook paths that
 * enforce their own authorization. Mirrors lib/supabase/admin.ts.
 */
function adminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: AUTH_OPTS,
  });
}

/**
 * Startup connectivity probe. supabase-js clients are lazy HTTP clients —
 * nothing hits the network until the first query — so this issues one
 * cheap round-trip (a head-only, zero-row count against `profiles`, via
 * the service-role client) to confirm the DB is actually reachable at
 * boot. Returns { ok, error } rather than throwing so app.js can log a
 * truthful "connected" line only when it genuinely succeeds.
 */
async function pingDatabase() {
  try {
    const { error } = await adminClient()
      .from("profiles")
      .select("id", { head: true, count: "exact" });
    return { ok: !error, error: error ? error.message : null };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = { anonClient, clientForToken, adminClient, pingDatabase };
