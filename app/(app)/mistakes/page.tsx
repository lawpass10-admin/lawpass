import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

export default async function MistakesPage() {
  await requireActiveSubscription();
  return <div>שאלות שטעיתי בהן (Slice 5)</div>;
}
