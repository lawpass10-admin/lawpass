import { Skeleton } from "@/components/ui/skeleton";

export function HeaderStripSkeleton() {
  return (
    <div
      className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
      style={{ marginBottom: 28 }}
      aria-busy="true"
      aria-label="טוען כותרת"
    >
      <div className="space-y-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>
      <div className="flex shrink-0 gap-2.5">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
