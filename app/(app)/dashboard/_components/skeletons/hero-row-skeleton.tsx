import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 4.X Phase 11 — Suspense fallback for the hero row. Renders two
 * navy-tinted placeholders matching the eventual card heights so the
 * KPI strip below doesn't jump when the data resolves.
 */
export function HeroRowSkeleton() {
  return (
    <section
      className="grid grid-cols-1 gap-5 mb-5 lg:[grid-template-columns:1fr_1.4fr]"
      aria-busy="true"
      aria-label="טוען כרטיסי סטטוס"
    >
      <div
        className="rounded-[22px] px-9 py-8"
        style={{
          background:
            "linear-gradient(135deg, #15296B 0%, #1E3A8A 55%, #1A327B 100%)",
          minHeight: 230,
        }}
      >
        <div className="grid grid-cols-[auto_1fr] items-center gap-7">
          <Skeleton className="size-[170px] rounded-full bg-white/10" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-32 bg-white/10" />
            <Skeleton className="h-7 w-48 bg-white/10" />
            <Skeleton className="h-4 w-56 bg-white/10" />
            <Skeleton className="h-1.5 w-full bg-white/10" />
            <Skeleton className="h-9 w-44 bg-white/10" />
          </div>
        </div>
      </div>
      <div
        className="rounded-[22px]"
        style={{
          background: "linear-gradient(135deg, #15296B 0%, #1E3A8A 100%)",
          padding: "24px 28px 36px",
          minHeight: 264,
        }}
      >
        <div className="space-y-3">
          <Skeleton className="h-3 w-28 bg-white/10" />
          <Skeleton className="h-6 w-40 bg-white/10" />
          <Skeleton className="h-4 w-56 bg-white/10" />
          <div className="mt-6 flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-11 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
