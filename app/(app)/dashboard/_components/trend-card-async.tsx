import { ActivityBoxAsync } from "@/app/(app)/dashboard/_components/activity-box-async";
import { TrendCard } from "@/app/(app)/dashboard/_components/trend-card";
import { getTrendData } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
};

/**
 * Slice 30 — TrendCardAsync now owns the entire right-column stack:
 * the trend chart + streak card pair (rendered by `<TrendCard>`) and
 * the new "מדד פעילות" activity box stacked below them. The outer
 * `flex flex-col gap-5` matches TrendCard's own inner gap so the
 * three cards read as one column with a consistent rhythm.
 *
 * Architectural note: `<ActivityBoxAsync>` consumes `getKpiData`,
 * which is React.cache-deduped. `<KpiRowAsync>` earlier in the
 * dashboard render is the primary caller; this nested `await`
 * resolves from the cache without firing a new query, so adding
 * the activity box into this Suspense boundary does NOT delay the
 * trend chart / streak card from streaming.
 */
export async function TrendCardAsync({ userId }: Props) {
  const data = await getTrendData(userId);
  return (
    <div className="flex flex-col gap-5">
      <TrendCard data={data} />
      <ActivityBoxAsync userId={userId} />
    </div>
  );
}
