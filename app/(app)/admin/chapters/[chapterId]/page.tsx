import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getChapterDrillDown,
  type ChapterTrack,
} from "@/lib/db/admin";

import QuestionsList from "./_components/questions-list";

export const dynamic = "force-dynamic";

function parseTrack(v: string | undefined): ChapterTrack | null {
  return v === "procedural" || v === "substantive" ? v : null;
}

function parseYear(v: string | undefined): string | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
}

/**
 * /admin/chapters/[chapterId] — read-only per-chapter source-question
 * list. Inherits the year filter via searchParams so drilling in from
 * a filtered table view stays consistent (the year filter narrows the
 * rows; the track filter is ignored here because the chapter itself
 * already pins the track).
 */
export default async function ChapterDrillDownPage({
  params,
  searchParams,
}: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<{
    year?: string | string[];
    track?: string | string[];
  }>;
}) {
  const supabase = await createClient();
  const { chapterId } = await params;
  const sp = await searchParams;
  const year = parseYear(typeof sp.year === "string" ? sp.year : undefined);
  // Carried through so the "back" link reconstructs the user's view.
  const track = parseTrack(typeof sp.track === "string" ? sp.track : undefined);

  const { chapter, rows } = await getChapterDrillDown(
    supabase,
    chapterId,
    // Drill-down honours `year` only — the chapter's track is fixed.
    { year, track: null }
  );

  if (!chapter) notFound();

  const backParams = new URLSearchParams();
  if (year !== null) backParams.set("year", year);
  if (track !== null) backParams.set("track", track);
  const backHref = backParams.toString()
    ? `/admin?${backParams.toString()}`
    : "/admin";

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heebo text-xl font-semibold">{chapter.title}</h2>
          <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {chapter.code}
          </div>
        </div>
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← חזרה לטבלת הפרקים
        </Link>
      </div>

      <QuestionsList chapterTrack={chapter.track} rows={rows} />
    </div>
  );
}
