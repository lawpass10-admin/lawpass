/**
 * Placeholder for the three subject squares.
 *
 * Fixed at the real card's height so the mastery and trend cards below do not
 * jump when the numbers land.
 */
export function SubjectStatsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[168px] animate-pulse rounded-xl"
          style={{ background: "var(--color-line)", opacity: 0.35 }}
        />
      ))}
    </div>
  );
}
