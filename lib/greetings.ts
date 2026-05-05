/**
 * Hebrew time-of-day greeting (SPEC §7.1.1 specifies "בוקר טוב"; the other
 * three variants are PM-defined wireframe defaults).
 *
 * TODO(slice-7): server-side `new Date()` returns server-local time, which
 * is the Vercel region (Frankfurt area) — UTC+1/+2. Israel is UTC+2/+3.
 * The mismatch is at most a 2-hour window error around DST boundaries,
 * which is acceptable for Slice 1 but could confuse a user who logs in
 * at, say, 10:55 PM Israel time and sees "ערב טוב" instead of "לילה טוב"
 * (or vice-versa). When we want greeting accuracy, switch to client-side
 * computation or pass the user's TZ from the browser.
 *
 * Cutoffs (per Yoav's PM decision):
 *   05:00–11:59 → "בוקר טוב"
 *   12:00–16:59 → "צהריים טובים"
 *   17:00–21:59 → "ערב טוב"
 *   22:00–04:59 → "לילה טוב"
 */
export function getHebrewGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 22) return "ערב טוב";
  return "לילה טוב";
}
