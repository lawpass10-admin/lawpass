import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  // Slice 29 — matches the flattened card: padding 14×16, radius
  // 12, no icon block, label + value + meta all centered, 2px
  // bottom bar.
  return (
    <div
      className="relative overflow-hidden rounded-[12px] border bg-card"
      style={{ padding: "14px 16px", borderColor: "var(--color-line)" }}
    >
      <Skeleton className="mx-auto h-3 w-24" />
      <Skeleton className="mx-auto mt-2 h-9 w-24" />
      <Skeleton className="mx-auto mt-1 h-3 w-32" />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: "var(--color-line)" }}
      />
    </div>
  );
}

export function KpiRowSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      style={{ gap: 16, marginBottom: 28 }}
      aria-busy="true"
      aria-label="טוען מדדים"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
