import { Skeleton } from "@/components/ui/skeleton";

/**
 * Slice 29 — skeleton placeholder matching `<ActivityBox>`'s
 * dimensions.
 * Slice 30 — radius 22, padding 22×24 to join the trend/streak
 *   cluster.
 * Slice 31 — line silhouette placeholder.
 * Slice 32 — taller (height 160 to match the new TrendCard-parity
 *   chart) and shows 3 horizontal gridline placeholders + a thin
 *   chart-line + 7 dots, mirroring the silhouette of the resolved
 *   chart so the stream-in doesn't flash.
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
      {/* Header placeholders — title (16px) + eyebrow (12px) to
          match the live card's <h3> + <span> pair. */}
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Chart surface — three faint gridlines + a thin centered
          line with 7 evenly-spaced dot placeholders. Height 160
          matches the live SVG so the column doesn't shift on stream. */}
      <div className="relative" style={{ height: 160 }} aria-hidden>
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            className="absolute inset-x-2 rounded-full"
            style={{
              top: `${t * 100}%`,
              height: 1,
              background: "var(--color-line)",
              opacity: 0.6,
            }}
          />
        ))}
        <div
          className="absolute inset-x-2 rounded-full"
          style={{
            top: "55%",
            height: 2,
            background: "var(--color-line)",
          }}
        />
        <div
          className="absolute inset-x-2 flex items-center justify-between"
          style={{ top: "55%", transform: "translateY(-50%)" }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="size-2 rounded-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
