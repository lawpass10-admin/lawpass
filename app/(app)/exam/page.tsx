import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

export default async function ExamPage() {
  await requireActiveSubscription();
  return <div>סימולציות בחינה (Slice 3)</div>;
}
