import { MasteryCard } from "@/app/(app)/dashboard/_components/mastery-card";
import { getMasteryByChapter } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
};

export async function MasteryCardAsync({ userId }: Props) {
  const rows = await getMasteryByChapter(userId);
  return <MasteryCard rows={rows} />;
}
