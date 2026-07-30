import { Paperclip } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type {
  QaReportListRow,
  QaReportStatus,
  QaReportType,
} from "@/lib/db/qa-reports";

const TYPE_LABELS: Record<QaReportType, string> = {
  bug: "באג טכני",
  content: "טעות תוכן",
  design: "עיצוב/UX",
};

const STATUS_LABELS: Record<QaReportStatus, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  resolved: "טופל",
};

/**
 * Slice 15 — small visual hierarchy polish on the status pill, color
 * story unchanged:
 *   - in_progress: bumped sky saturation (sky-200 / sky-900) — active
 *     work should be the most visually present row.
 *   - open: unchanged (amber-100 / amber-800) — the warning yellow
 *     stays the queue's natural alert.
 *   - resolved: faded (emerald-50 / emerald-700/80) so closed rows
 *     recede into the history group.
 */
const STATUS_PILL_CLASSES: Record<QaReportStatus, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  in_progress:
    "bg-sky-200 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  resolved:
    "bg-emerald-50 text-emerald-700/80 dark:bg-emerald-950/30 dark:text-emerald-300/70",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Server Component — admin QA list table.
 *
 * Slice 15 layout (task-tracker / Monday-like):
 *   - Primary column = the report's TITLE (problem_text), truncated,
 *     with a small paperclip indicator when a screenshot is attached.
 *   - Screenshot thumbnail column removed (the detail page renders
 *     the full image at its own signed URL).
 *   - Whole row navigates to /admin/qa/{id} — every cell wraps its
 *     content in a <Link> to the same destination, EXCEPT the
 *     reporter cell which keeps its separate /admin/users/{id}
 *     drill-in (deliberately preserved side-affordance).
 *   - Switched to `table-fixed` with explicit column widths so the
 *     title gets the bulk of the horizontal real estate.
 *   - Slice 14 status grouping preserved (group header colSpan
 *     updated from 6 → 5).
 */
export default function QaListTable({
  rows,
}: {
  rows: Array<QaReportListRow>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-line)] bg-card p-8 text-center text-sm text-muted-foreground">
        אין דיווחים להצגה בסינון הנוכחי.
      </div>
    );
  }

  // Per-status counts for the group headers (Slice 14). Computed ONCE
  // before the row loop to avoid N² scans. Rows arrive triage-sorted
  // (in_progress → open → resolved) from listQaReports.
  const counts = rows.reduce(
    (m, r) => {
      m[r.status] = (m[r.status] ?? 0) + 1;
      return m;
    },
    {} as Record<QaReportStatus, number>
  );

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-line)] bg-card">
      <table className="w-full table-fixed text-sm">
        {/* Explicit column widths — title gets the remainder; the rest
            are sized to the longest expected content. RTL handles the
            visual flip; HTML source order is title → type → page →
            reporter → created → status. */}
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-40" />
          <col className="w-32" />
          <col className="w-36" />
          <col className="w-24" />
        </colgroup>
        <thead className="bg-muted/30 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-start">כותרת</th>
            <th scope="col" className="px-3 py-2 text-start">סוג</th>
            <th scope="col" className="px-3 py-2 text-start">דף</th>
            <th scope="col" className="px-3 py-2 text-start">מדווח</th>
            <th scope="col" className="px-3 py-2 text-start">נוצר</th>
            <th scope="col" className="px-3 py-2 text-start">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            // Emit a group header above the row when its status
            // differs from the previous row's (including before the
            // first row). When a single status is filtered the header
            // still renders once — self-consistent.
            const prevStatus = idx === 0 ? null : rows[idx - 1].status;
            const showGroupHeader = row.status !== prevStatus;
            const reportHref = `/admin/qa/${row.id}`;
            return (
              <Fragment key={row.id}>
                {showGroupHeader ? (
                  <tr
                    aria-hidden
                    className="border-b border-[var(--color-line)]"
                  >
                    <td
                      colSpan={5}
                      className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-foreground/80 px-3 py-2"
                    >
                      {STATUS_LABELS[row.status]} · {counts[row.status]}
                    </td>
                  </tr>
                ) : null}
                <tr
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    !isLast && "border-b border-[var(--color-line)]"
                  )}
                >
                  {/* Title cell — the row's primary affordance.
                      `min-w-0` on the <td> AND `truncate` on the
                      inner <span> together let table-fixed actually
                      truncate long Hebrew titles instead of blowing
                      the row height. The paperclip is a
                      presence-only indicator with both aria-label
                      (assistive tech) and a wrapper-level title
                      (hover tooltip). */}
                  <td className="min-w-0 px-3 py-2">
                    <Link
                      href={reportHref}
                      className="flex min-w-0 items-center gap-1.5"
                      title={
                        row.screenshotPath ? "יש צילום מסך" : undefined
                      }
                    >
                      <span
                        dir="auto"
                        className="truncate font-medium text-[var(--color-navy-ink)]"
                      >
                        {row.problemText}
                      </span>
                      {row.screenshotPath ? (
                        <Paperclip
                          className="size-3.5 shrink-0 text-muted-foreground/60"
                          aria-label="יש צילום מסך"
                        />
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={reportHref}
                      className="font-medium text-[var(--color-navy-ink)] hover:underline"
                    >
                      {TYPE_LABELS[row.reportType]}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={reportHref} className="block min-w-0">
                      <code
                        dir="ltr"
                        className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
                        title={row.pagePath}
                      >
                        {row.pagePath}
                      </code>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {/* Reporter cell — DIFFERENT destination. Drills
                        into the user, not the report. Deliberately
                        preserved as a side-affordance per Slice 15
                        spec; do not collapse into the row-level
                        report link. */}
                    <Link
                      href={`/admin/users/${row.reporterUserId}`}
                      className="block truncate text-sm hover:underline"
                    >
                      {row.reporterFullName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    <Link href={reportHref} className="block truncate">
                      {formatDateTime(row.createdAt)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={reportHref} className="inline-flex">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          STATUS_PILL_CLASSES[row.status]
                        )}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </Link>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
