import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 29 — skeleton placeholder matching `<ActivityBox>`'s
 * dimensions.
 * Slice 30 — radius 22, padding 22×24 to join the trend/streak
 *   cluster.
 * Slice 31 — chart placeholder updated from a 7-bar row to a thin
 *   horizontal line with 7 evenly-spaced dot markers to mirror the
 *   new minimal-line chart. Without this, the stream-in would flash
 *   from bars to a line.
 */
export function ActivityBoxSkeleton() {
  return (
    <section
      className="relative overflow-hidden border bg-card"
      style={{
        padding: "22px 24px",
        borderRadius: 22,
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-busy="true"
      aria-label="טוען מדד פעילות"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      {/* Chart surface — a centered baseline + 7 evenly-spaced dot
          placeholders so the streaming silhouette matches the line
          chart that will resolve in its place. */}
      <div className="relative" style={{ height: 120 }} aria-hidden>
        <div
          className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-full"
          style={{ height: 2, background: "var(--color-line)" }}
        />
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="size-2 rounded-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
