import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

export default async function BookmarksPage() {
  await requireActiveSubscription();
  return <div>שאלות שסימנתי (Slice 5)</div>;
}
