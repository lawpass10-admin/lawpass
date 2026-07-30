/**
 * SERVER-SIDE client for the Express API. Used by Server Components
 * (e.g. the dashboard's _lib/queries.ts) that read through the API rather
 * than the in-app DB helpers. This module is server-only — it imports the
 * SSR Supabase client, which pulls the user's session from cookies to
 * mint the Authorization: Bearer header the API's `authenticate`
 * middleware expects.
 *
 * Same env gate as the browser client: enabled only when
 * NEXT_PUBLIC_API_BASE_URL is set, so production (var unset) transparently
 * uses the in-app helpers until the server is deployed.
 */

import { createClient } from "@/lib/supabase/server";

export function apiBaseUrlServer(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export function apiEnabledServer(): boolean {
  return apiBaseUrlServer().length > 0;
}

type JsonRecord = Record<string, unknown>;

/**
 * GET `${base}${path}` with the caller's Supabase access token. Throws on
 * network/parse failure so callers can fall back to the in-app helper.
 * `cache: "no-store"` keeps Next from caching per-user analytics reads.
 */
export async function apiGetJsonServer(path: string): Promise<JsonRecord> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${apiBaseUrlServer()}${path}`, {
    headers,
    cache: "no-store",
  });
  return (await res.json()) as JsonRecord;
}
