import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

export default async function StatisticsPage() {
  await requireActiveSubscription();
  return <div>סטטיסטיקה (Slice 5 — אנליטיקה בסיסית בלבד ב-MVP)</div>;
}
