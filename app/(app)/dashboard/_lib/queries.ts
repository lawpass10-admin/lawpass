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
import type { SubjectStat } from "@/lib/dashboard/subject-stat";
import type { TopicStatsBySubject } from "@/lib/dashboard/topic-stat";
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
  // [VERIFY-EXPRESS] TEMPORARY — in-app fallback DISABLED (see the banner in
  // lib/api/auth.ts). The dashboard now reads EXCLUSIVELY through Express.
  // Note this one was a SILENT fallback (it degraded to the Next.js DB
  // helpers on ANY error), so it would have masked a broken API — it now
  // THROWS instead, making "the dashboard renders" mean "Express served it".
  // To REVERT: restore the commented-out original below.
  const data = await apiGetJsonServer(path);
  if (data.ok === true) return data[field] as T;
  throw new Error(`[VERIFY-EXPRESS] dashboard API failed for ${path}`);

  // if (apiEnabledServer()) {
  //   try {
  //     const data = await apiGetJsonServer(path);
  //     if (data.ok === true) return data[field] as T;
  //   } catch {
  //     // fall through to the in-app helper
  //   }
  // }
  // return fallback();
}

/**
 * The three subject squares: questions answered, average, lowest and highest
 * for דין מהותי, דין דיוני and מטלת כתיבה.
 *
 * API-ONLY, and unlike its neighbours the fallback is not merely disabled —
 * there is nothing to fall back TO. The aggregation lives in
 * lawpass_server/db/subject-stats.js because it spans three unrelated answer
 * tables, and it has no in-app twin; a second copy in `lib/db` would be the
 * one place these numbers could start disagreeing with themselves. The
 * fallback below therefore says so rather than pretending.
 */
export const getSubjectStats = cache(async () => {
  return apiOr<SubjectStat[]>("/api/dashboard/subject-stats", "subjects", async () => {
    throw new Error(
      "subject stats are served only by lawpass_server — there is no in-app fallback"
    );
  });
});

/**
 * Per-law distribution and average score for each subject — the two charts
 * under each dashboard tab. API-only for the same reason as `getSubjectStats`:
 * the aggregation spans three unrelated answer tables and has no in-app twin.
 */
export const getTopicStats = cache(async () => {
  return apiOr<TopicStatsBySubject>("/api/dashboard/topic-stats", "topics", async () => {
    throw new Error(
      "topic stats are served only by lawpass_server — there is no in-app fallback"
    );
  });
});

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
