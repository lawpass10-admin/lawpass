/**
 * Placeholder for the subject tabs and their two charts. Reserves the real
 * height so the page does not reflow when the aggregates land.
 */
export function SubjectTabsSkeleton() {
  return (
    <div className="space-y-4">
      <div
        className="h-[52px] w-full animate-pulse rounded-xl"
        style={{ background: "var(--color-line)", opacity: 0.35 }}
      />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-[340px] animate-pulse rounded-xl"
            style={{ background: "var(--color-line)", opacity: 0.35 }}
          />
        ))}
      </div>
    </div>
  );
}
