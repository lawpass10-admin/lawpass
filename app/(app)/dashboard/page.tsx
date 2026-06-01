import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ActivityBoxAsync } from "@/app/(app)/dashboard/_components/activity-box-async";
import { HeaderStripAsync } from "@/app/(app)/dashboard/_components/header-strip-async";
import { HeroRowAsync } from "@/app/(app)/dashboard/_components/hero-row-async";
import { KpiRowAsync } from "@/app/(app)/dashboard/_components/kpi-row-async";
import { MasteryCardAsync } from "@/app/(app)/dashboard/_components/mastery-card-async";
import { ActivityBoxSkeleton } from "@/app/(app)/dashboard/_components/skeletons/activity-box-skeleton";
import { HeaderStripSkeleton } from "@/app/(app)/dashboard/_components/skeletons/header-strip-skeleton";
import { HeroRowSkeleton } from "@/app/(app)/dashboard/_components/skeletons/hero-row-skeleton";
import { KpiRowSkeleton } from "@/app/(app)/dashboard/_components/skeletons/kpi-row-skeleton";
import { MasteryCardSkeleton } from "@/app/(app)/dashboard/_components/skeletons/mastery-card-skeleton";
import { TrendCardSkeleton } from "@/app/(app)/dashboard/_components/skeletons/trend-card-skeleton";
import { TrendCardAsync } from "@/app/(app)/dashboard/_components/trend-card-async";
import {
  SUBSCRIPTION_PLAN_TOTAL_DAYS,
  computePlanDay,
  daysRemainingUntilISO,
} from "@/app/(app)/dashboard/_lib/hero-helpers";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";

/**
 * /dashboard — Slice 4 streamed dashboard.
 *
 * Architecture:
 *   - The shell awaits the fast auth + profile fetches at the top level
 *     (single sub-100ms round trip), then renders 4 Suspense boundaries
 *     that stream their data independently.
 *   - Each `*Async` component owns one heavier query and renders the
 *     matching presentational component when it resolves; its skeleton
 *     placeholder paints immediately so the layout doesn't reflow.
 *   - `HeaderStripAsync` AND `MasteryCardAsync` both depend on the
 *     mastery aggregate. The shared call is deduped via React.cache in
 *     `_lib/queries.ts` — Option A in the Phase 5 plan (cache wins;
 *     no need to collapse them under a single boundary).
 *
 * Subscription block lives in the sidebar (`components/app/app-sidebar.tsx`),
 * not on the dashboard — Phase 9a dropped the duplicate dashboard card.
 *
 * The auth + subscription gate also defends against Next.js Router
 * Cache replaying the rendered layout segment between sibling Link
 * navigations without re-running the layout's server-side gate.
 */

function daysUntil(future: Date, now: Date = new Date()): number {
  const ms = future.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function DashboardPage() {
  const { user, subscription } = await requireActiveSubscription();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, exam_date_planned, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding/complete-profile");

  const examDate = profile.exam_date_planned
    ? new Date(profile.exam_date_planned)
    : null;
  const examDays = examDate ? daysUntil(examDate) : null;

  // Hero ring fill = % of *subscription* window elapsed, not exam-date
  // distance. This produces a stable 0→100% progression that maxes out
  // when the plan expires (real urgency), and avoids the broken math
  // when the exam is further out than the subscription (would produce
  // negative ratios). `currentPlanDay` is still anchored to
  // `profile.created_at` because the Journey card represents the
  // user's personal study journey, not their billing window.
  const subscriptionTotalDays =
    SUBSCRIPTION_PLAN_TOTAL_DAYS[subscription.plan_type] ?? 90;
  const subscriptionDaysRemaining = daysRemainingUntilISO(subscription.ends_at);
  // `currentPlanDay` is still consumed by `<HeroRowAsync>` (rendered
  // as "יום N מתוך 100" inside the hero ring). Slice 29 only stops
  // using it for the bottom-slot JourneyCard — the hero binding
  // stays. `journey-card.tsx` + `hero-helpers.ts` stay on disk
  // untouched in case we want to bring the timeline back later.
  const currentPlanDay = computePlanDay(profile.created_at);

  return (
    <div className="space-y-6">
      {/* 1. Header strip — streams */}
      <Suspense fallback={<HeaderStripSkeleton />}>
        <HeaderStripAsync
          userId={user.id}
          fullName={profile.full_name}
          examDate={examDate}
          daysToExam={examDays}
        />
      </Suspense>

      {/* 2. Hero row (Phase 11) — streams */}
      <Suspense fallback={<HeroRowSkeleton />}>
        <HeroRowAsync
          userId={user.id}
          daysToExam={examDays}
          subscriptionTotalDays={subscriptionTotalDays}
          subscriptionDaysRemaining={subscriptionDaysRemaining}
          currentPlanDay={currentPlanDay}
        />
      </Suspense>

      {/* 3. KPI row — streams */}
      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRowAsync userId={user.id} />
      </Suspense>

      {/* 4. Mastery + Trend — 2-column @ md+, mastery wider (1.6fr / 1fr) */}
      <div
        className="grid grid-cols-1 gap-[18px] md:[grid-template-columns:1.6fr_1fr]"
      >
        <Suspense fallback={<MasteryCardSkeleton />}>
          <MasteryCardAsync userId={user.id} />
        </Suspense>
        <Suspense fallback={<TrendCardSkeleton />}>
          <TrendCardAsync userId={user.id} />
        </Suspense>
      </div>

      {/* 5. Activity box — Slice 29: replaces the JourneyCard in
          the bottom slot. Reads from the React.cache-deduped
          `getKpiData()` payload, so it adds no new DB round-trip
          on top of the KPI row above. */}
      <Suspense fallback={<ActivityBoxSkeleton />}>
        <ActivityBoxAsync userId={user.id} />
      </Suspense>
    </div>
  );
}
