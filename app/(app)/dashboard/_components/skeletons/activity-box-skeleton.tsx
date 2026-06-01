import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 29 — skeleton placeholder matching `<ActivityBox>`'s
 * dimensions: padding 20px 24px 16px, radius 14, ~120px chart
 * surface, eyebrow row at the top. No animated chart guide — keep
 * the streaming shimmer minimal so the layout doesn't flash.
 */
export function ActivityBoxSkeleton() {
  return (
    <section
      className="relative overflow-hidden rounded-[14px] border bg-card"
      style={{
        padding: "20px 24px 16px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-busy="true"
      aria-label="טוען מדד פעילות"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="h-[120px] w-full rounded-md" />
    </section>
  );
}
