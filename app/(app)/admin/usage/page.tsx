import { requireAdmin } from "@/lib/auth/admin-gate";
import { getContentConsumption, getUsageSummary } from "@/lib/db/usage";
import { createClient } from "@/lib/supabase/server";

import { pageLabelFor } from "./_lib/page-labels";

/**
 * /admin/usage — how much material candidates get through, and on what.
 *
 * Two sections, in order of what is actually asked of this screen:
 *
 * 1. CONSUMPTION (yesterday and the last week): papers sat and writing tasks
 *    marked. One row per content type, with the number of distinct candidates
 *    beside each count. Fixed windows — these two are the ones that get
 *    looked at, and a selector would only invite comparing a 90-day total
 *    with a 1-day one.
 * 2. TRAFFIC: mobile's share and the endpoints it lands on, from the counters
 *    written by the Next proxy and the Express middleware. `?days=` picks that
 *    window only.
 *
 * The two cannot be derived from each other: traffic counts requests, so a
 * candidate who opens a paper and thinks better of it appears in the second
 * section and not in the first.
 */
export const dynamic = "force-dynamic";

const WINDOWS = [1, 7, 30, 90] as const;

/**
 * Hebrew for a window, which is not `${n} ימים` at n = 1.
 *
 * getUsageSummary counts from `today - (days - 1)`, so days = 1 is TODAY —
 * not the last 24 hours and not yesterday. "היום" is therefore the accurate
 * word as well as the grammatical one.
 *
 * Worth knowing when reading that tab: `usage_daily` is a running counter per
 * day, so today's row is still filling. A low number at 09:00 is the morning,
 * not a drop in traffic.
 */
function windowLabel(days: number): string {
  return days === 1 ? "היום" : `${days} ימים`;
}

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
  const consumption = await getContentConsumption(supabase);
  const share = (n: number) =>
    usage.total === 0 ? "0%" : `${Math.round((n / usage.total) * 100)}%`;

  // Totals across content types, so the header can say how much was got
  // through without the reader adding three numbers up.
  const sat1 = consumption.metrics.reduce((sum, m) => sum + m.day1, 0);
  const sat7 = consumption.metrics.reduce((sum, m) => sum + m.day7, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 md:px-0">
      <header className="space-y-2">
        <h1 className="font-heebo text-2xl font-extrabold" style={{ color: "var(--color-navy-ink)" }}>
          צריכת תוכן
        </h1>
        <p className="font-heebo text-sm text-muted-foreground">
          {sat1.toLocaleString("he-IL")} פריטים הושלמו ביממה האחרונה,{" "}
          {sat7.toLocaleString("he-IL")} בשבוע האחרון
        </p>
      </header>

      <section
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
      >
        <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.03)" }}>
              {["תוכן", "24 שעות", "משתמשים", "7 ימים", "משתמשים"].map((head, i) => (
                <th
                  key={`${head}-${i}`}
                  className="px-3 py-2 text-start font-heebo text-xs font-semibold text-muted-foreground"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {consumption.metrics.map((row) => (
              <tr key={row.label} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td className="px-3 py-2 font-heebo font-semibold">{row.label}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {row.day1.toLocaleString("he-IL")}
                </td>
                {/* The distinct-user figure sits in a dimmer column beside each
                    count: 6 papers from one candidate and 6 from six are the
                    same number and not the same week. */}
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.users1.toLocaleString("he-IL")}
                </td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {row.day7.toLocaleString("he-IL")}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {row.users7.toLocaleString("he-IL")}
                </td>
              </tr>
            ))}
            <tr
              style={{
                borderTop: "2px solid var(--color-border)",
                background: "rgba(201,161,73,0.07)",
              }}
            >
              <td className="px-3 py-2 font-heebo font-extrabold">סה״כ</td>
              <td className="px-3 py-2 font-extrabold tabular-nums">
                {sat1.toLocaleString("he-IL")}
              </td>
              {/* No total for the user columns: the same candidate can appear in
                  two content rows, so adding them would double-count people. */}
              <td className="px-3 py-2 text-muted-foreground">—</td>
              <td className="px-3 py-2 font-extrabold tabular-nums">
                {sat7.toLocaleString("he-IL")}
              </td>
              <td className="px-3 py-2 text-muted-foreground">—</td>
            </tr>
          </tbody>
        </table>
      </section>

      <header className="space-y-2 pt-2">
        <h2 className="font-heebo text-xl font-extrabold" style={{ color: "var(--color-navy-ink)" }}>
          שימוש לפי מכשיר
        </h2>
        <p className="font-heebo text-sm text-muted-foreground">
          {usage.total.toLocaleString("he-IL")}{" "}
          {days === 1 ? "בקשות היום" : `בקשות ב-${days} הימים האחרונים`}
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
              {windowLabel(option)}
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
                {["מקור", "עמוד", "נתיב", "נייד", "מחשב", "בוטים", "סה״כ"].map((head) => (
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
                  {/* The screen this endpoint serves. Before the path, because
                      it is the column an admin scans down — the path answers
                      "what was called", this answers "from where". */}
                  <td className="px-3 py-2 font-heebo whitespace-nowrap">
                    {pageLabelFor(row.surface, row.path)}
                  </td>
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
