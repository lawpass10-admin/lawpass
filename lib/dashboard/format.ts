/**
 * Slice 4 — Dashboard formatting helpers. Pure functions.
 */

/**
 * Format seconds as `m:ss` (e.g. 142 → "2:22", 89 → "1:29", 2.9 → "0:03").
 * Used by the KPI 3 (זמן ממוצע לשאלה) card per the Phase 8 mockup.
 *
 * Returns "0:00" when given 0; the caller is responsible for swapping
 * to "—" before calling this in the empty state.
 */
export function secondsToMmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
