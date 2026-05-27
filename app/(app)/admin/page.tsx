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
        <h2 className="font-heebo text-lg font-semibold">תוכן לפי פרק</h2>
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
