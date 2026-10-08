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
import type { MasteryRow, StatusContext } from "@/lib/dashboard/types";
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
 * Mastery, status, subject stats and topic stats — ONE request for all four.
 *
 * These four used to be four endpoints, and usage showed them with identical
 * hit counts because the dashboard always needs all of them: one render was
 * four round trips and four token verifications. Two of them also overlapped,
 * since /status recomputed the mastery aggregate for itself — so every load
 * ran that query twice. /overview runs it once and derives status from it.
 *
 * WRAPPED IN cache(), which is what makes this a drop-in. The four readers
 * below each await this same promise, so whichever Suspense boundary resolves
 * first triggers the fetch and the other three join it. Every call site is
 * unchanged.
 *
 * THE TRADE, stated plainly: the four boundaries no longer paint
 * independently. Before, the subject squares could appear while the topic
 * charts were still loading; now all four wait for the slowest query in the
 * set. That is the cost of one round trip instead of four, and it is worth it
 * here because the four queries are of similar weight and the page is read as
 * one screen. If one of them ever becomes much slower than the rest, split
 * that one back out — the single-surface endpoints are still mounted.
 */
type DashboardOverview = {
  mastery: MasteryRow[];
  status: StatusContext;
  subjects: SubjectStat[];
  topics: TopicStatsBySubject;
};

const getOverview = cache(async (): Promise<DashboardOverview> => {
  const data = await apiGetJsonServer("/api/dashboard/overview");
  if (data.ok !== true) {
    throw new Error("[VERIFY-EXPRESS] dashboard API failed for /api/dashboard/overview");
  }
  return {
    mastery: data.mastery as MasteryRow[],
    status: data.status as StatusContext,
    subjects: data.subjects as SubjectStat[],
    topics: data.topics as TopicStatsBySubject,
  };
});

/**
 * The three subject squares: questions answered, average, lowest and highest
 * for דין מהותי, דין דיוני and מטלת כתיבה.
 *
 * Served only by lawpass_server — there is no in-app fallback and never was.
 * The aggregation spans three unrelated answer tables and has no twin in
 * `lib/db`; a second copy would be the one place these numbers could start
 * disagreeing with themselves.
 */
export const getSubjectStats = cache(async (): Promise<SubjectStat[]> => {
  return (await getOverview()).subjects;
});

/**
 * Per-law distribution and average score for each subject — the two charts
 * under each dashboard tab. API-only for the same reason as `getSubjectStats`.
 */
export const getTopicStats = cache(async (): Promise<TopicStatsBySubject> => {
  return (await getOverview()).topics;
});

export const getKpiData = cache(async (userId: string) => {
  return apiOr("/api/dashboard/kpi", "kpi", async () => {
    const supabase = await getSupabase();
    return dashboardDb.getKpiData(supabase, userId);
  });
});

// NO ARGUMENTS, where both of these used to take some.
//
// `userId` is gone because /overview reads the caller from the session token,
// the way every other endpoint does — a user id passed in by the caller was
// always something the server had to ignore or distrust.
//
// `mastery` is gone from getStatusContext because that argument existed to
// avoid computing the aggregate twice on the in-app path. /overview computes
// it once and derives status from that same array server-side, so there is
// nothing left to hand in.
export const getMasteryByChapter = cache(async (): Promise<MasteryRow[]> => {
  return (await getOverview()).mastery;
});

export const getStatusContext = cache(async (): Promise<StatusContext> => {
  return (await getOverview()).status;
});

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
