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

function StatusBadge({ status }: { status: ChapterDrillRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "active" && "bg-emerald-100 text-emerald-900",
        status === "draft" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        status === "archived" && "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function QuestionsList({
  chapterTrack,
  rows,
}: {
  chapterTrack: ChapterTrack;
  rows: ChapterDrillRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        אין שאלות שתואמות את הסינון.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-right text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">מזהה</th>
            <th className="px-3 py-2 font-medium">השאלה</th>
            <th className="px-3 py-2 font-medium">תת-נושא</th>
            <th className="px-3 py-2 text-center font-medium">שנה</th>
            <th className="px-3 py-2 text-center font-medium">מסלול</th>
            <th className="px-3 py-2 text-center font-medium">זוויות</th>
            <th className="px-3 py-2 text-center font-medium">קושי</th>
            <th className="px-3 py-2 font-medium">סטטוס</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.sourceId}
              className="transition-colors hover:bg-muted/40"
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
                  row.angleCount !== 4 && "font-semibold text-amber-700"
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
