import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

export default async function PracticePage() {
  await requireActiveSubscription();
  return <div>תרגול (Slice 2)</div>;
}
