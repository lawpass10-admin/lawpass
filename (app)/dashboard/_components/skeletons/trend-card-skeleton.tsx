import { ActivityBoxSkeleton } from "@/app/(app)/dashboard/_components/skeletons/activity-box-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 4.X Phase 13 — Skeleton for the stacked Trend + Streak column.
 * Two placeholders mirroring the eventual heights so the mastery card
 * to the start doesn't reflow when the data resolves.
 *
 * Slice 30 — added a THIRD placeholder for the "מדד פעילות" activity
 * box that now lives in the same right-column Suspense boundary
 * (rendered by `TrendCardAsync` under StreakCard).
 * Slice 32 — placeholders reordered to mirror the new live order:
 *   trend chart → activity box → streak card.
 */
export function TrendCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-5"
      aria-busy="true"
      aria-label="טוען מגמת הצלחה"
    >
      {/* 1. Trend chart placeholder. */}
      <div
        className="rounded-[22px] border bg-card"
        style={{
          padding: "22px 24px",
          borderColor: "var(--color-line)",
        }}
      >
        <div className="flex items-center justify-between mb-3.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-[160px] w-full" />
        <div className="mt-3.5">
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      {/* 2. Activity box placeholder — reuses the standalone skeleton
          so the placeholder stays in lockstep with the live card. */}
      <ActivityBoxSkeleton />

      {/* 3. Streak card placeholder (navy gradient block). */}
      <div
        className="rounded-[22px]"
        style={{
          background: "linear-gradient(135deg, #15296B 0%, #1E3A8A 100%)",
          padding: "22px 24px",
          minHeight: 130,
        }}
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-20 bg-white/10" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full bg-white/10" />
            <Skeleton className="h-10 w-24 bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
