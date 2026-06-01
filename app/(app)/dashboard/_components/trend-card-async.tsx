import { ActivityBoxAsync } from "@/app/(app)/dashboard/_components/activity-box-async";
import { StreakCard } from "@/app/(app)/dashboard/_components/streak-card";
import { TrendCard } from "@/app/(app)/dashboard/_components/trend-card";
import { getTrendData } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
};

/**
 * Slice 30 — TrendCardAsync owns the entire right-column stack.
 * Slice 32 — reordered to: trend chart → activity box → streak card.
 *   `<StreakCard>` moved up out of TrendCard so the column can be
 *   reordered without restructuring TrendCard's render. Its prop
 *   contract is unchanged (streakDays + personalHigh still come
 *   from the same `TrendData` object — just accessed one level up).
 *
 * Architectural note: `<ActivityBoxAsync>` consumes `getKpiData`,
 * which is React.cache-deduped. `<KpiRowAsync>` earlier in the
 * dashboard render is the primary caller; this nested `await`
 * resolves from the cache without firing a new query, so the
 * activity box does not delay the trend chart or streak card
 * from streaming.
 */
export async function TrendCardAsync({ userId }: Props) {
  const data = await getTrendData(userId);
  return (
    <div className="flex flex-col gap-5">
      <TrendCard data={data} />
      <ActivityBoxAsync userId={userId} />
      <StreakCard
        streakDays={data.streakDays}
        personalHigh={data.personalHigh}
      />
    </div>
  );
}
