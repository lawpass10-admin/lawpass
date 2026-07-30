import { Skeleton } from "@/components/ui/skeleton";

function MasteryRowSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <Skeleton className="h-3 w-4" />
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <Skeleton className="h-4 w-10" />
      <Skeleton className="h-7 w-12" />
    </div>
  );
}

export function MasteryCardSkeleton() {
  return (
    <div
      className="rounded-lg border bg-card p-6"
      aria-busy="true"
      aria-label="טוען שליטה לפי פרק"
    >
      <Skeleton className="h-5 w-32" />
      <div style={{ marginTop: 4, marginBottom: 18 }}>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex flex-col" style={{ gap: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <MasteryRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
