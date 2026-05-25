import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] border bg-card"
      style={{ padding: "18px 20px", borderColor: "var(--color-line)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-8 rounded-[10px]" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px]"
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
