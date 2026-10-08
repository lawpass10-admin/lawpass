import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HeaderStripAsync } from "@/app/(app)/dashboard/_components/header-strip-async";
import { HeaderStripSkeleton } from "@/app/(app)/dashboard/_components/skeletons/header-strip-skeleton";
import { SubjectStatsRowSkeleton } from "@/app/(app)/dashboard/_components/skeletons/subject-stats-row-skeleton";
import { SubjectTabsSkeleton } from "@/app/(app)/dashboard/_components/skeletons/subject-tabs-skeleton";
import { SubjectStatsRowAsync } from "@/app/(app)/dashboard/_components/subject-stats-row-async";
import { SubjectTabsAsync } from "@/app/(app)/dashboard/_components/subject-tabs-async";
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
  const { user } = await requireActiveSubscription();

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

  // The subscription-window maths that used to live here fed the hero ring's
  // fill and its "יום N מתוך 100" label. Both went with the hero row. The
  // countdown itself has not been deleted — the sidebar still shows the plan's
  // days remaining — and `_lib/hero-helpers.ts` stays on disk, so the ring can
  // be brought back without rebuilding it.

  return (
    <div className="space-y-6">
      {/* 1. Header strip — streams */}
      <Suspense fallback={<HeaderStripSkeleton />}>
        <HeaderStripAsync
          fullName={profile.full_name}
          examDate={examDate}
          daysToExam={examDays}
        />
      </Suspense>

      {/* 2. The three subject squares.
          Replaced the hero banner and the four-KPI row that used to sit here.
          Those answered "how is the plan going"; these answer "how much have I
          done in each subject, and how well" — which is what the page is for
          now that it is סטטיסטיקה אישית ותרגול מותאם.

          Streams like every other card here: server-rendered from
          lawpass_server's /api/dashboard/subject-stats. */}
      <Suspense fallback={<SubjectStatsRowSkeleton />}>
        <SubjectStatsRowAsync />
      </Suspense>

      {/* 3. Subject tabs and their two charts, full width.
          Replaced the two-column mastery + trend grid. The right column
          (מגמת הצלחה → streak → מדד פעילות) is gone: those tracked activity
          over time, where this page is now about performance by subject and by
          law. `trend-card*.tsx`, `streak-card.tsx` and `activity-box*.tsx` stay
          on disk, unreferenced, so the timeline can come back without being
          rebuilt. */}
      <Suspense fallback={<SubjectTabsSkeleton />}>
        <SubjectTabsAsync />
      </Suspense>
    </div>
  );
}
