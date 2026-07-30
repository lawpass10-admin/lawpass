import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ChapterDrillRow, ChapterTrack } from "@/lib/db/admin";

const TRACK_LABEL: Record<ChapterTrack, string> = {
  procedural: "פרוצדורלי",
  substantive: "מהותי",
};

const STATUS_LABEL: Record<ChapterDrillRow["status"], string> = {
  draft: "טיוטה",
  active: "פעילה",
  archived: "בארכיון",
};

// Slice 7 polish (a): status badges use the project's --color-status-*
// tokens instead of raw amber/emerald palettes.
function StatusBadge({ status }: { status: ChapterDrillRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "active" &&
          "bg-[var(--color-status-strong-bg)] text-[var(--color-status-strong)]",
        status === "draft" &&
          "bg-[var(--color-status-weak-bg)] text-[var(--color-status-weak)]",
        status === "archived" && "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function QuestionsList({
  chapterId,
  chapterTrack,
  rows,
}: {
  chapterId: string;
  chapterTrack: ChapterTrack;
  rows: ChapterDrillRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-line)] bg-card p-6 text-sm text-muted-foreground">
        אין שאלות שתואמות את הסינון.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-line)] bg-card">
      <table className="w-full text-sm">
        {/* Slice 7 polish (g): drop uppercase (Hebrew has no case),
            shift colour to ink-dim. */}
        <thead className="bg-muted/50 text-right text-xs tracking-wide text-[var(--color-ink-dim)]">
          <tr>
            <th className="px-3 py-2 font-medium">מזהה</th>
            <th className="px-3 py-2 font-medium">השאלה</th>
            <th className="px-3 py-2 font-medium">תת-נושא</th>
            <th className="px-3 py-2 text-center font-medium">שנה</th>
            <th className="px-3 py-2 text-center font-medium">מסלול</th>
            <th className="px-3 py-2 text-center font-medium">זוויות</th>
            <th className="px-3 py-2 text-center font-medium">קושי</th>
            <th className="px-3 py-2 font-medium">סטטוס</th>
            <th className="px-3 py-2 font-medium" aria-label="פעולות" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {rows.map((row) => (
            <tr
              key={row.sourceId}
              // Slice 7 polish (f): gold-tint hover replaces bg-muted.
              className="transition-colors hover:bg-[var(--color-gold-tint)]"
            >
              <td className="px-3 py-2.5 align-top">
                <span dir="ltr" className="text-xs font-mono">
                  {row.externalId}
                </span>
              </td>
              <td className="max-w-md px-3 py-2.5 align-top">{row.snippet}</td>
              <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                {row.subtopicTitle}
              </td>
              <td className="px-3 py-2.5 text-center align-top tabular-nums">
                {row.examYear ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-center align-top text-xs text-muted-foreground">
                {TRACK_LABEL[chapterTrack]}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-center align-top tabular-nums",
                  // Slice 7 polish (a): status-weak token for the
                  // "wrong-angle-count" warning marker.
                  row.angleCount !== 4 &&
                    "font-semibold text-[var(--color-status-weak)]"
                )}
              >
                {row.angleCount}
              </td>
              <td className="px-3 py-2.5 text-center align-top tabular-nums">
                {row.difficultyLevel ?? "—"}
              </td>
              <td className="px-3 py-2.5 align-top">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2.5 align-top">
                <Link
                  href={`/admin/chapters/${chapterId}/questions/${row.sourceId}`}
                  className="text-sm font-medium text-[var(--color-gold-deep)] hover:underline"
                >
                  ערוך
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
