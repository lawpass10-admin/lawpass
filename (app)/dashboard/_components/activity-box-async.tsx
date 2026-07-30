import { ActivityBox } from "@/app/(app)/dashboard/_components/activity-box";
import { getKpiData } from "@/app/(app)/dashboard/_lib/queries";

/**
 * Slice 29 — async wrapper for the "מדד פעילות" daily-activity
 * box. Streams independently from the other dashboard sub-trees.
 *
 * Data source: `getKpiData(userId).dailyAccuracy[]`. `dailyAccuracy`
 * is always exactly 7 entries (one per IL-local day for the last
 * week) — we map each entry's `attempts` count into the chart.
 *
 * IMPORTANT — no new round-trip. `getKpiData` is wrapped in
 * `React.cache` (see `_lib/queries.ts`), and `<KpiRowAsync>` is the
 * primary caller earlier on the same page render. By the time this
 * component runs the promise is already resolved (or in-flight),
 * so this consumer hits the cache rather than firing a fresh
 * `attempts` SELECT. The Slice 29 STOP-AND-REPORT guard was
 * specifically against accidentally adding such a query — we don't.
 */

type Props = { userId: string };

export async function ActivityBoxAsync({ userId }: Props) {
  const kpi = await getKpiData(userId);
  return <ActivityBox points={kpi.dailyAccuracy} />;
}
