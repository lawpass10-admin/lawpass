import { requireAdmin } from "@/lib/auth/admin-gate";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminStats,
  getAvailableExamYears,
  getChapterContentRows,
  type ChapterTrack,
} from "@/lib/db/admin";

import ContentTable from "./_components/content-table";
import FiltersBar from "./_components/filters-bar";
import StatsRow from "./_components/stats-row";

export const dynamic = "force-dynamic";

function parseTrackParam(v: string | undefined): ChapterTrack | null {
  return v === "procedural" || v === "substantive" ? v : null;
}

function parseYearParam(
  v: string | undefined,
  available: number[]
): string | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (!available.includes(n)) return null;
  return String(n);
}

/**
 * /admin home — stats row at the top, then the filter bar, then the
 * per-chapter content table. Filters are URL searchParams so they
 * survive deep-linking and the drill-down preserves them.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string | string[];
    track?: string | string[];
  }>;
}) {
  // Every other page under /admin re-runs the gate rather than leaning on the
  // layout: Next's Router Cache can replay a layout segment across same-group
  // navigations, and the page and layout render concurrently, so the layout's
  // redirect is not what keeps this page's admin queries from running. This
  // one was the only page missing the call.
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const yearRaw = typeof params.year === "string" ? params.year : undefined;
  const trackRaw = typeof params.track === "string" ? params.track : undefined;

  // We need the available-years list before we can resolve the year
  // param (only accept years that actually exist in the dataset).
  const [availableYears, stats] = await Promise.all([
    getAvailableExamYears(supabase),
    getAdminStats(supabase),
  ]);

  const year = parseYearParam(yearRaw, availableYears);
  const track = parseTrackParam(trackRaw);
  const filters = { year, track };

  const rows = await getChapterContentRows(supabase, filters);

  return (
    <div className="space-y-6">
      <StatsRow stats={stats} />
      <section className="space-y-3">
        <h2 className="font-heebo text-lg font-semibold text-[var(--color-navy-ink)]">
          תוכן לפי פרק
        </h2>
        <FiltersBar
          availableYears={availableYears}
          currentYear={year}
          currentTrack={track}
        />
        <ContentTable rows={rows} filters={filters} />
      </section>
    </div>
  );
}
