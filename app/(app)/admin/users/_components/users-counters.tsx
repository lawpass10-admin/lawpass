import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserCounts } from "@/lib/db/admin";

/**
 * The three counters above the users table.
 *
 * Pure server component — the counts are fetched by the page and handed in,
 * the same arrangement as StatsRow on /admin.
 *
 * ── Sized to their contents, not to the page ──────────────────────────────
 * `flex` with a min-width per card rather than a `grid-cols-N`. A grid gives
 * every card an equal share of the full width, which left a two-digit number
 * floating in a box four times wider than it needed — the number looked small
 * because the box was big. These wrap onto a second line on a narrow screen
 * instead of stretching on a wide one.
 */
export default function UsersCounters({ counts }: { counts: UserCounts }) {
  const tiles = [
    { label: "סך כל המשתמשים", value: counts.total },
    { label: "מצטרפים ב-24 שעות", value: counts.joinedLast24h },
    { label: "מצטרפים ב-7 ימים", value: counts.joinedLast7Days },
  ];

  return (
    <section className="flex flex-wrap gap-3">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className="relative min-w-[150px] overflow-hidden border-[var(--color-line)]"
        >
          <CardHeader className="gap-0.5">
            <CardDescription className="whitespace-nowrap text-xs">
              {tile.label}
            </CardDescription>
            <CardTitle className="font-heebo text-3xl font-extrabold tabular-nums text-[var(--color-navy-ink)]">
              {tile.value.toLocaleString("he-IL")}
            </CardTitle>
          </CardHeader>
          {/* The thin gold underline the admin and dashboard cards share. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
            style={{ background: "var(--color-gold)" }}
          />
        </Card>
      ))}
    </section>
  );
}
