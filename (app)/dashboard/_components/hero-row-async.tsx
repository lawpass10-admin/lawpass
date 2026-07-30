import { HeroRow } from "@/app/(app)/dashboard/_components/hero-row";
import { getHeroLastSession } from "@/app/(app)/dashboard/_lib/queries";

type Props = {
  userId: string;
  daysToExam: number | null;
  subscriptionTotalDays: number;
  subscriptionDaysRemaining: number;
  currentPlanDay: number;
};

/**
 * Slice 4.X Phase 11 — Suspense data fetcher for the dashboard Hero
 * row. Reads the single resumable session (cached via `_lib/queries`)
 * and hands the rest of the props through. Subscription window +
 * plan-day are computed in `dashboard/page.tsx` from the already-loaded
 * `requireActiveSubscription()` row + `profile.created_at`, so they're
 * available without an extra round trip.
 */
export async function HeroRowAsync({
  userId,
  daysToExam,
  subscriptionTotalDays,
  subscriptionDaysRemaining,
  currentPlanDay,
}: Props) {
  const lastSession = await getHeroLastSession(userId);
  return (
    <HeroRow
      daysToExam={daysToExam}
      subscriptionTotalDays={subscriptionTotalDays}
      subscriptionDaysRemaining={subscriptionDaysRemaining}
      currentPlanDay={currentPlanDay}
      lastSession={lastSession}
    />
  );
}
