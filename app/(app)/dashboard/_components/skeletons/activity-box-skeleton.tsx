import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 29 — skeleton placeholder matching `<ActivityBox>`'s
 * dimensions.
 * Slice 30 — radius 14 → 22 + padding "20px 24px 16px" → "22px 24px"
 * to match the redesigned card joining the trend/streak cluster.
 * Chart placeholder swapped from a single bar to a 7-bar row
 * mirroring the new bars chart so the stream-in doesn't flash.
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
      <div
        className="flex items-end gap-2"
        style={{ height: 120 }}
        aria-hidden
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="rounded"
            style={{
              flex: 1,
              // Stagger heights slightly so the placeholder feels like
              // a chart rather than a flat block.
              height: `${40 + ((i * 13) % 60)}%`,
            }}
          />
        ))}
      </div>
    </section>
  );
}
