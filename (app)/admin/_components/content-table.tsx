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

// Slice 7 polish (a): map flag tones to --color-status-* tokens
// instead of raw amber/rose palettes. "alert" reads as a stronger
// status-weak shade than "warn" via tone-specific copy + bg pairing.
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
          "bg-[var(--color-status-weak-bg)] text-[var(--color-status-weak)]",
        tone === "alert" &&
          "border border-[var(--color-status-weak)] bg-[var(--color-status-weak-bg)] text-[var(--color-status-weak)]"
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
      <div className="rounded-md border border-[var(--color-line)] bg-card p-6 text-sm text-muted-foreground">
        אין פרקים שתואמים את הסינון.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-line)] bg-card">
      <table className="w-full text-sm">
        {/* Slice 7 polish (c, g): token-color border + drop uppercase
            from Hebrew table headers + tone the label colour. */}
        <thead className="bg-muted/50 text-right text-xs tracking-wide text-[var(--color-ink-dim)]">
          <tr>
            <th className="px-3 py-2 font-medium">פרק</th>
            <th className="px-3 py-2 font-medium">מסלול</th>
            <th className="px-3 py-2 text-center font-medium">שאלות מקור</th>
            <th className="px-3 py-2 text-center font-medium">שאלות זווית</th>
            <th className="px-3 py-2 font-medium">בעיות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {rows.map((row) => (
            <tr
              key={row.chapterId}
              // Slice 7 polish (f): gold-tint hover.
              className="transition-colors hover:bg-[var(--color-gold-tint)]"
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
