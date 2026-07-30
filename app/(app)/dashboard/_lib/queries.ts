/**
 * Slice 4 Phase 5 — Request-scoped cached wrappers around the dashboard
 * helpers in `lib/db/dashboard.ts`.
 *
 * Why this exists: under Suspense streaming (page.tsx shell + 4 async
 * sub-components), `HeaderStripAsync` AND `MasteryCardAsync` both need
 * the mastery aggregate. Each lives behind its own `<Suspense>`, so
 * they can't share a value via parent props without collapsing the two
 * fallback boundaries into one (option B in the plan). React.cache
 * deduplicates the call at request scope so the second consumer of
 * mastery hits the in-flight (or resolved) promise rather than running
 * the aggregate twice.
 *
 * Dual-path (Express extraction): when NEXT_PUBLIC_API_BASE_URL is set,
 * each read is fetched from the standalone Express API
 * (GET /api/dashboard/*) using the caller's Supabase session token.
 * When it's unset (production, for now) — OR when the API call fails —
 * we fall back to the in-app `lib/db/dashboard` helper, so the dashboard
 * always renders. The React.cache wrappers still dedupe either path.
 */

import { cache } from "react";

import * as dashboardDb from "@/lib/db/dashboard";
import type { MasteryRow } from "@/lib/dashboard/types";
import { apiEnabledServer, apiGetJsonServer } from "@/lib/api/server";
import { createClient } from "@/lib/supabase/server";

const getSupabase = cache(() => createClient());

/**
 * Try the Express API first (when enabled); on any failure or non-ok
 * envelope, fall back to the in-app helper. `field` is the key the server
 * nests the payload under (e.g. `{ ok, kpi }`).
 */
async function apiOr<T>(
  path: string,
  field: string,
  fallback: () => Promise<T>
): Promise<T> {
  if (apiEnabledServer()) {
    try {
      const data = await apiGetJsonServer(path);
      if (data.ok === true) return data[field] as T;
    } catch {
      // fall through to the in-app helper
    }
  }
  return fallback();
}

export const getKpiData = cache(async (userId: string) => {
  return apiOr("/api/dashboard/kpi", "kpi", async () => {
    const supabase = await getSupabase();
    return dashboardDb.getKpiData(supabase, userId);
  });
});

export const getMasteryByChapter = cache(async (userId: string) => {
  return apiOr("/api/dashboard/mastery", "mastery", async () => {
    const supabase = await getSupabase();
    return dashboardDb.getMasteryByChapter(supabase, userId);
  });
});

export const getStatusContext = cache(
  async (userId: string, mastery: MasteryRow[]) => {
    // The API's /status endpoint recomputes mastery server-side, so the
    // passed `mastery` is only used by the in-app fallback.
    return apiOr("/api/dashboard/status", "status", async () => {
      const supabase = await getSupabase();
      return dashboardDb.getStatusContext(supabase, userId, mastery);
    });
  }
);

export const getTrendData = cache(async (userId: string) => {
  return apiOr("/api/dashboard/trend", "trend", async () => {
    const supabase = await getSupabase();
    return dashboardDb.getTrendData(supabase, userId);
  });
});

export const getHeroLastSession = cache(async (userId: string) => {
  return apiOr("/api/dashboard/hero", "hero", async () => {
    const supabase = await getSupabase();
    return dashboardDb.getHeroLastSession(supabase, userId);
  });
});
