"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import type { AdminUserRow, SortableColumn, SortDir } from "@/lib/db/admin";

const PLAN_LABELS: Record<string, string> = {
  "3_months": "3 חודשים",
  "6_months": "6 חודשים",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
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

function SubscriptionCell({
  value,
}: {
  value: AdminUserRow["activeSubscription"];
}) {
  if (!value) {
    return <span className="text-xs text-muted-foreground">ללא מנוי פעיל</span>;
  }
  return (
    <div className="flex flex-col">
      <span className="text-sm">
        {PLAN_LABELS[value.planType] ?? value.planType}
      </span>
      <span className="text-xs text-muted-foreground">
        עד {formatDate(value.endsAt)}
      </span>
    </div>
  );
}

// Slice 7.5 — per-column default direction (locked).
const DEFAULT_DIR_BY_COLUMN: Record<SortableColumn, SortDir> = {
  name: "asc",
  email: "asc",
  signup: "desc",
  exam: "asc",
  subscription: "desc",
  activity: "desc",
};

type HeaderCellProps = {
  column: SortableColumn;
  label: string;
  align?: "start" | "center";
  currentSort: SortableColumn;
  currentDir: SortDir;
  onSort: (column: SortableColumn) => void;
};

/**
 * Slice 7.5 — sortable <th>. Click toggles direction when the same
 * column is already active; click on another column applies that
 * column's default direction (DEFAULT_DIR_BY_COLUMN above). aria-sort
 * reflects URL state for screen readers.
 */
function HeaderCell({
  column,
  label,
  align,
  currentSort,
  currentDir,
  onSort,
}: HeaderCellProps) {
  const isActive = currentSort === column;
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "px-3 py-2 font-medium",
        align === "center" && "text-center"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isActive
            ? "text-[var(--color-navy-ink)]"
            : "text-[var(--color-ink-dim)] hover:text-[var(--color-navy-ink)]"
        )}
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

export default function UsersTable({
  rows,
  sort,
  dir,
}: {
  rows: AdminUserRow[];
  sort: SortableColumn;
  dir: SortDir;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function applySort(column: SortableColumn): void {
    const nextDir: SortDir =
      sort === column
        ? // Flip current direction.
          dir === "asc"
          ? "desc"
          : "asc"
        : // New column — apply its locked default direction.
          DEFAULT_DIR_BY_COLUMN[column];
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("sort", column);
    next.set("dir", nextDir);
    // Same convention the filter bar uses: any sort/filter change
    // resets the pager to page 1.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  let body: ReactNode;
  if (rows.length === 0) {
    body = (
      <div className="rounded-md border border-[var(--color-line)] bg-card p-6 text-sm text-muted-foreground">
        אין משתמשים להצגה.
      </div>
    );
    return body;
  }

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-line)] bg-card">
      <table className="w-full text-sm">
        {/* Slice 7 polish (c, g) + slice 7.5: token border + Hebrew-friendly
            header (no uppercase) + ink-dim text + clickable sort buttons. */}
        <thead className="bg-muted/50 text-right text-xs tracking-wide text-[var(--color-ink-dim)]">
          <tr>
            <HeaderCell
              column="name"
              label="שם"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
            <HeaderCell
              column="email"
              label="אימייל"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
            <HeaderCell
              column="signup"
              label="הצטרפות"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
            <HeaderCell
              column="exam"
              label="מועד בחינה"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
            <HeaderCell
              column="subscription"
              label="מנוי"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
            <HeaderCell
              column="activity"
              label="פעילות אחרונה"
              currentSort={sort}
              currentDir={dir}
              onSort={applySort}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {rows.map((row) => (
            <tr
              key={row.userId}
              // Slice 7 polish (f): gold-tint hover.
              className={cn(
                "transition-colors hover:bg-[var(--color-gold-tint)]"
              )}
            >
              <td className="px-3 py-2.5 align-top">
                <Link
                  href={`/admin/users/${row.userId}`}
                  className="font-medium hover:underline"
                >
                  {row.fullName}
                </Link>
              </td>
              <td className="px-3 py-2.5 align-top" dir="ltr">
                <span className="text-sm">{row.email ?? "—"}</span>
              </td>
              <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                {formatDate(row.signedUpAt)}
              </td>
              <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                {row.examDatePlanned ? formatDate(row.examDatePlanned) : "—"}
              </td>
              <td className="px-3 py-2.5 align-top">
                <SubscriptionCell value={row.activeSubscription} />
              </td>
              <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                {formatDateTime(row.lastActivityAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
