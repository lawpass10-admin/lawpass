import { requireAdmin } from "@/lib/auth/admin-gate";
import { getUsageSummary } from "@/lib/db/usage";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/usage — who uses what, from a phone and from a computer.
 *
 * Answers two questions and no others: what share of traffic is mobile, and
 * which endpoints that share actually lands on. Counted in two places — the
 * Next proxy for the web surface, the Express middleware for the API — and
 * written through one database function, so the two can be read together.
 *
 * `?days=` picks the window. The numbers are counters, not events, so there is
 * no drill-down to individual requests by design — see the migration.
 */
export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90] as const;

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const params = await searchParams;
  const asked = Number(params.days);
  const days = WINDOWS.includes(asked as (typeof WINDOWS)[number]) ? asked : 30;

  const usage = await getUsageSummary(supabase, days);
  const share = (n: number) =>
    usage.total === 0 ? "0%" : `${Math.round((n / usage.total) * 100)}%`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 md:px-0">
      <header className="space-y-2">
        <h1 className="font-heebo text-2xl font-extrabold" style={{ color: "var(--color-navy-ink)" }}>
          שימוש לפי מכשיר
        </h1>
        <p className="font-heebo text-sm text-muted-foreground">
          {usage.total.toLocaleString("he-IL")} בקשות ב-{days} הימים האחרונים
        </p>
        <nav className="flex gap-2 pt-1">
          {WINDOWS.map((option) => (
            <a
              key={option}
              href={`/admin/usage?days=${option}`}
              className="rounded-lg border px-3 py-1 font-heebo text-xs font-semibold transition-colors"
              style={
                option === days
                  ? { borderColor: "#C9A149", background: "rgba(201,161,73,0.12)" }
                  : { borderColor: "var(--color-border)" }
              }
            >
              {option} ימים
            </a>
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["נייד", usage.byDevice.mobile],
            ["מחשב", usage.byDevice.desktop],
            ["בוטים", usage.byDevice.bot],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
          >
            <p className="font-heebo text-xs text-muted-foreground">{label}</p>
            <p className="font-heebo text-2xl font-extrabold" style={{ color: "var(--color-navy-ink)" }}>
              {value.toLocaleString("he-IL")}
            </p>
            <p className="font-heebo text-xs" style={{ color: "var(--color-gold-deep)" }}>
              {share(value)}
            </p>
          </div>
        ))}
      </section>

      {usage.endpoints.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center font-heebo text-sm text-muted-foreground">
          אין עדיין נתוני שימוש בחלון הזה.
        </p>
      ) : (
        <section
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
        >
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                {["מקור", "נתיב", "נייד", "מחשב", "בוטים", "סה״כ"].map((head) => (
                  <th
                    key={head}
                    className="px-3 py-2 text-start font-heebo text-xs font-semibold text-muted-foreground"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.endpoints.map((row) => (
                <tr key={`${row.surface}${row.path}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{row.surface}</td>
                  {/* dir=ltr: a path is Latin and slashed, and in an RTL table
                      it otherwise renders with the leading slash on the wrong
                      end. */}
                  <td dir="ltr" className="px-3 py-2 font-mono text-[12px]">
                    {row.path}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.mobile.toLocaleString("he-IL")}</td>
                  <td className="px-3 py-2 tabular-nums">{row.desktop.toLocaleString("he-IL")}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {row.bot.toLocaleString("he-IL")}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {row.total.toLocaleString("he-IL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
