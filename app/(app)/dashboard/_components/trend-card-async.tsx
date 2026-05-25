import { TrendCard } from "@/app/(app)/dashboard/_components/trend-card";
import { getTrendData } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
};

export async function TrendCardAsync({ userId }: Props) {
  const data = await getTrendData(userId);
  return <TrendCard data={data} />;
}
