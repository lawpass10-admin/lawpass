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
 * The underlying helpers in `lib/db/dashboard.ts` still accept
 * `(supabase, userId)` — that's what the unit tests exercise. These
 * cached wrappers take only `(userId)` so the cache key is stable
 * across multiple Server-Component callers within a single request.
 * The supabase client is also memoized per request so the inner
 * helpers see the same instance.
 */

import { cache } from "react";

import * as dashboardDb from "@/lib/db/dashboard";
import type { MasteryRow } from "@/lib/dashboard/types";
import { createClient } from "@/lib/supabase/server";

const getSupabase = cache(() => createClient());

export const getKpiData = cache(async (userId: string) => {
  const supabase = await getSupabase();
  return dashboardDb.getKpiData(supabase, userId);
});

export const getMasteryByChapter = cache(async (userId: string) => {
  const supabase = await getSupabase();
  return dashboardDb.getMasteryByChapter(supabase, userId);
});

export const getStatusContext = cache(
  async (userId: string, mastery: MasteryRow[]) => {
    const supabase = await getSupabase();
    return dashboardDb.getStatusContext(supabase, userId, mastery);
  }
);

export const getTrendData = cache(async (userId: string) => {
  const supabase = await getSupabase();
  return dashboardDb.getTrendData(supabase, userId);
});

export const getHeroLastSession = cache(async (userId: string) => {
  const supabase = await getSupabase();
  return dashboardDb.getHeroLastSession(supabase, userId);
});
