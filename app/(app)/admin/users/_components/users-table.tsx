import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/lib/db/admin";

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

export default function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        אין משתמשים להצגה.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-right text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">שם</th>
            <th className="px-3 py-2 font-medium">אימייל</th>
            <th className="px-3 py-2 font-medium">הצטרפות</th>
            <th className="px-3 py-2 font-medium">מועד בחינה</th>
            <th className="px-3 py-2 font-medium">מנוי</th>
            <th className="px-3 py-2 font-medium">כניסה אחרונה</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.userId}
              className={cn("transition-colors hover:bg-muted/40")}
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
                {formatDateTime(row.lastSignInAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
