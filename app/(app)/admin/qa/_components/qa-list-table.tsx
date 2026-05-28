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

const STATUS_PILL_CLASSES: Record<QaReportStatus, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  in_progress:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  resolved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
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
 * Server Component — the rows arrive already enriched (thumbUrl is
 * computed in the page via createSignedUrl). No client interaction
 * required on the list itself; opening a row is a normal <Link> nav.
 */
export default function QaListTable({
  rows,
}: {
  rows: Array<QaReportListRow & { thumbUrl: string | null }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-line)] bg-card p-8 text-center text-sm text-muted-foreground">
        אין דיווחים להצגה בסינון הנוכחי.
      </div>
    );
  }

  // Slice 14 — per-status counts for the group headers. Computed
  // ONCE before the row loop to avoid N² scans. The rows arrive
  // already triage-sorted (in_progress → open → resolved) from
  // listQaReports, so a single linear walk is enough to detect
  // status transitions and inject a header row above each new bucket.
  const counts = rows.reduce(
    (m, r) => {
      m[r.status] = (m[r.status] ?? 0) + 1;
      return m;
    },
    {} as Record<QaReportStatus, number>
  );

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-line)] bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-start text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-start">סוג</th>
            <th scope="col" className="px-3 py-2 text-start">דף</th>
            <th scope="col" className="px-3 py-2 text-start">מדווח</th>
            <th scope="col" className="px-3 py-2 text-start">נוצר</th>
            <th scope="col" className="px-3 py-2 text-start">סטטוס</th>
            <th scope="col" className="px-3 py-2 text-start">צילום</th>
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
            return (
              <Fragment key={row.id}>
                {showGroupHeader ? (
                  <tr
                    aria-hidden
                    className="border-b border-[var(--color-line)]"
                  >
                    <td
                      colSpan={6}
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
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/qa/${row.id}`}
                    className="font-medium text-[var(--color-navy-ink)] hover:underline"
                  >
                    {TYPE_LABELS[row.reportType]}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <code
                    dir="ltr"
                    className="block max-w-[18rem] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
                    title={row.pagePath}
                  >
                    {row.pagePath}
                  </code>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/users/${row.reporterUserId}`}
                    className="text-sm hover:underline"
                  >
                    {row.reporterFullName ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      STATUS_PILL_CLASSES[row.status]
                    )}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {row.thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={row.thumbUrl}
                      alt="צילום מסך"
                      className="h-10 w-16 rounded border border-[var(--color-line)] object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
