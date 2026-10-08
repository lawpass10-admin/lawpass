import { MasteryCard } from "@/app/(app)/dashboard/_components/mastery-card";
import { getMasteryByChapter } from "@/app/(app)/dashboard/_lib/queries";

// No props: the caller is read from the session token by
// /api/dashboard/overview, so there is no user id for this component to be
// handed or to get wrong.
export async function MasteryCardAsync() {
  const rows = await getMasteryByChapter();
  return <MasteryCard rows={rows} />;
}
