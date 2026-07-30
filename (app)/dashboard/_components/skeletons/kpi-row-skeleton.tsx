import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 30 — skeleton is forked into mobile + desktop branches to
 * mirror `kpi-row-async.tsx`. The mobile lane shows the "סטטיסטיקה"
 * heading placeholder above a horizontal-scroll row of 4 compact
 * card placeholders; desktop renders the unchanged 2×2 / 1×4 grid of
 * full-size card placeholders. Both render unconditionally with
 * Tailwind visibility gates so the stream resolves into whichever
 * branch the viewport wins without layout shift.
 */

function StatCardSkeleton({ compact = false }: { compact?: boolean }) {
  // Slice 29 — flattened card: centered label + value + meta and a
  // 2px bottom bar. Slice 30 — `compact` mirrors the same prop on
  // the live card: tighter padding + smaller value placeholder so
  // the mobile scroll-row skeleton doesn't visually jump on stream.
  return (
    <div
      className="relative overflow-hidden rounded-[12px] border bg-card"
      style={{
        padding: compact ? "10px 14px" : "14px 16px",
        borderColor: "var(--color-line)",
      }}
    >
      <Skeleton className="mx-auto h-3 w-24" />
      <Skeleton
        className={`mx-auto mt-2 ${compact ? "h-7" : "h-9"} w-24`}
      />
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
    <>
      {/* Mobile: heading placeholder + horizontal-scroll row. */}
      <div
        className="md:hidden"
        style={{ marginBottom: 28 }}
        aria-busy="true"
        aria-label="טוען מדדים"
      >
        <Skeleton
          className="h-4 w-24"
          style={{ marginBottom: 12, marginInlineStart: "auto" }}
        />
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[180px] snap-start">
              <StatCardSkeleton compact />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: unchanged 2×2 → 1×4 grid. */}
      <div
        className="hidden md:grid md:grid-cols-2 lg:grid-cols-4"
        style={{ gap: 16, marginBottom: 28 }}
        aria-busy="true"
        aria-label="טוען מדדים"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
