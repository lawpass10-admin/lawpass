import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ChapterContentRow, ContentFilters } from "@/lib/db/admin";

/**
 * Below this source-question count, a chapter is flagged as "thin"
 * (orange). Picked relative to the current dataset: 147 source / 16
 * chapters ≈ 9 average, so <5 reads as visibly under-supplied without
 * flagging the long tail.
 */
const THIN_THRESHOLD = 5;

const TRACK_LABEL: Record<"procedural" | "substantive", string> = {
  procedural: "פרוצדורלי",
  substantive: "מהותי",
};

/**
 * Append the active filter searchParams to a base href so a drill-down
 * link preserves the user's current view.
 */
function withFilters(href: string, filters: ContentFilters): string {
  const params = new URLSearchParams();
  if (filters.year !== null) params.set("year", filters.year);
  if (filters.track !== null) params.set("track", filters.track);
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "warn" | "alert";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "warn" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        tone === "alert" &&
          "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
      )}
    >
      {children}
    </span>
  );
}

function chapterFlags(row: ChapterContentRow): React.ReactNode {
  const badges: React.ReactNode[] = [];
  if (row.sourceQuestionCount === 0) {
    badges.push(
      <Badge key="empty" tone="alert">
        ריק
      </Badge>
    );
  } else if (row.sourceQuestionCount < THIN_THRESHOLD) {
    badges.push(
      <Badge key="thin" tone="warn">
        דליל
      </Badge>
    );
  }
  if (row.sourcesWithWrongAngleCount > 0) {
    badges.push(
      <Badge key="angles" tone="warn">
        {row.sourcesWithWrongAngleCount} ללא 4 זוויות
      </Badge>
    );
  }
  if (row.sourcesNotActive > 0) {
    badges.push(
      <Badge key="status" tone="warn">
        {row.sourcesNotActive} לא פעילות
      </Badge>
    );
  }
  if (badges.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

export default function ContentTable({
  rows,
  filters,
}: {
  rows: ChapterContentRow[];
  filters: ContentFilters;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        אין פרקים שתואמים את הסינון.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-right text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">פרק</th>
            <th className="px-3 py-2 font-medium">מסלול</th>
            <th className="px-3 py-2 text-center font-medium">שאלות מקור</th>
            <th className="px-3 py-2 text-center font-medium">שאלות זווית</th>
            <th className="px-3 py-2 font-medium">בעיות</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.chapterId}
              className="transition-colors hover:bg-muted/40"
            >
              <td className="px-3 py-2.5">
                <Link
                  href={withFilters(
                    `/admin/chapters/${row.chapterId}`,
                    filters
                  )}
                  className="font-medium hover:underline"
                >
                  {row.chapterTitle}
                </Link>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {row.chapterCode}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {TRACK_LABEL[row.track]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {row.sourceQuestionCount}
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {row.angleQuestionCount}
              </td>
              <td className="px-3 py-2.5">{chapterFlags(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
