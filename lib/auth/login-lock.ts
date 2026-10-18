import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The admins-only lockdown, read from the database.
 *
 * `app_settings.login_locked` is flipped with a SQL UPDATE — no deploy, no
 * build. See supabase/migrations/20261018000001_app_settings_login_lock.sql
 * for the two statements that lock and unlock.
 *
 * The decision is made by the `login_gate()` function rather than here: it
 * reads the flag and the caller's `is_admin` in one round trip, and returns
 * `allowed` already evaluated so the rule lives in one place.
 */

export type LoginGate = {
  locked: boolean;
  isAdmin: boolean;
  /** False only when the app is locked AND the caller is not an admin. */
  allowed: boolean;
};

/** What a caller gets when the gate cannot be read. See `readLoginGate`. */
const OPEN: LoginGate = { locked: false, isAdmin: false, allowed: true };

/**
 * How long a gate reading is reused, in milliseconds.
 *
 * This is called from the middleware, so without a cache every page load,
 * image and route handler would carry a database round trip. Ten seconds is
 * short enough that unlocking feels immediate — nobody is still staring at
 * the maintenance page ten seconds later — and long enough that a burst of
 * requests from one page load costs a single query.
 */
const TTL_MS = 10_000;

let cached: { at: number; gate: LoginGate } | null = null;

/**
 * Read the gate for the current caller.
 *
 * ── FAILS OPEN, deliberately ──────────────────────────────────────────────
 * A database hiccup returns `allowed: true`. The alternative is an outage in
 * Postgres turning into a total lockout of every user including the admins
 * who would have to fix it — a failure in the component that is already
 * broken taking the whole product with it. The lock is an operational
 * convenience, not a security boundary: RLS is what protects data, and it is
 * unaffected by this.
 *
 * ── The cache is keyed by nothing, on purpose ─────────────────────────────
 * `allowed` depends on who is asking, so a shared cache would be wrong — and
 * it is not shared: the admin flag only matters while `locked` is true, and
 * the entry is only reused when it says `locked: false`, which is the same
 * answer for everyone. The moment the app is locked, every request reads the
 * gate for itself.
 */
export async function readLoginGate(
  supabase: SupabaseClient
): Promise<LoginGate> {
  if (cached && Date.now() - cached.at < TTL_MS && !cached.gate.locked) {
    return cached.gate;
  }

  try {
    const { data, error } = await supabase.rpc("login_gate");
    if (error) return OPEN;

    // The function returns a single row; PostgREST hands back an array.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return OPEN;

    const gate: LoginGate = {
      locked: Boolean(row.locked),
      isAdmin: Boolean(row.is_admin),
      allowed: Boolean(row.allowed),
    };

    // Only an UNLOCKED reading is cacheable — see the note above.
    if (!gate.locked) cached = { at: Date.now(), gate };
    return gate;
  } catch {
    return OPEN;
  }
}

/** Drop the cached reading. Used by tests; harmless anywhere else. */
export function resetLoginGateCache(): void {
  cached = null;
}
