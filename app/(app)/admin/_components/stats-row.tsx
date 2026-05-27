import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminStats } from "@/lib/db/admin";

const PLAN_LABELS: Record<string, string> = {
  "3_months": "3 חודשים",
  "6_months": "6 חודשים",
};

/**
 * Three-card row across the top of /admin. Pure server component —
 * the data is fetched in the parent page and handed in as a prop.
 */
export default function StatsRow({ stats }: { stats: AdminStats }) {
  const planEntries = Object.entries(stats.activeSubscriptionsByPlan).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  const subsTotal = planEntries.reduce((acc, [, n]) => acc + n, 0);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>סך כל המשתמשים</CardDescription>
          <CardTitle className="font-heebo text-3xl font-extrabold tabular-nums">
            {stats.totalUsers}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>מנויים פעילים</CardDescription>
          <CardTitle className="font-heebo text-3xl font-extrabold tabular-nums">
            {subsTotal}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין מנויים פעילים</p>
          ) : (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {planEntries.map(([plan, count]) => (
                <li
                  key={plan}
                  className="flex items-baseline justify-between"
                >
                  <span>{PLAN_LABELS[plan] ?? plan}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>סך שאלות מקור</CardDescription>
          <CardTitle className="font-heebo text-3xl font-extrabold tabular-nums">
            {stats.totalSourceQuestions}
          </CardTitle>
        </CardHeader>
      </Card>
    </section>
  );
}
