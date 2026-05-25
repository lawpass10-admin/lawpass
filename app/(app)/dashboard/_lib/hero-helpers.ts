/**
 * Slice 4.X Phase 11 — Pure helpers for the dashboard Hero row.
 *
 * Server/client-agnostic. Kept narrow on purpose so they can pick up
 * unit tests in a follow-up phase without touching the renderer.
 */

/**
 * Ring geometry constants — Phase 14 polish locked the ring at the
 * smaller 170×170 footprint (r=73, stroke-width 14). The Phase 13
 * version was 200×200 with r=86 (circumference 540.354). Shrinking
 * the ring keeps the same big-number readability while letting the
 * Journey card own more horizontal real estate.
 *
 *   circumference = 2 * π * 73 ≈ 458.673.
 *
 * Exported so the renderer can write the same number into both the SVG
 * `<circle>` and the dasharray output without redeclaring it.
 */
export const RING_CIRCUMFERENCE = 458.673;
export const RING_RADIUS = 73;
export const RING_VIEWBOX = 170;
export const RING_CENTER = RING_VIEWBOX / 2;

/**
 * Subscription plan SKU → total days. Single source of truth shared
 * with the sidebar's progress bar. Anything not in the map falls back
 * to 90d (the default 3-month plan).
 */
export const SUBSCRIPTION_PLAN_TOTAL_DAYS: Record<string, number> = {
  "3_months": 90,
  "6_months": 180,
};

/**
 * Computes the SVG `stroke-dasharray` for the ring's gold fill.
 *
 * The fill represents *elapsed subscription time*, NOT the time-to-exam:
 *   fillRatio = (planTotalDays - daysRemaining) / planTotalDays
 *
 * Why subscription window rather than exam date: it produces a stable
 * 0→100% progression that maxes out exactly when the user's plan
 * expires, creating real urgency. Using `examDate − createdAt` gave
 * nonsense when the user's exam was further out than their plan
 * (negative ratios) and a too-small fill on long-horizon plans.
 *
 * Returns a clamped `[0, 1]` ratio and the two-segment dasharray
 * string the prototype uses (`"<filled> <empty>"`). When the input is
 * degenerate (≤ 0 total days), returns the empty ring.
 */
export function computeRingDash(
  daysRemaining: number,
  planTotalDays: number
): { dasharray: string; fillRatio: number } {
  if (planTotalDays <= 0) {
    return { dasharray: `0 ${RING_CIRCUMFERENCE.toFixed(2)}`, fillRatio: 0 };
  }
  const elapsed = Math.max(0, planTotalDays - Math.max(0, daysRemaining));
  const ratio = Math.min(1, elapsed / planTotalDays);
  const filled = ratio * RING_CIRCUMFERENCE;
  const empty = RING_CIRCUMFERENCE - filled;
  return {
    dasharray: `${filled.toFixed(2)} ${empty.toFixed(2)}`,
    fillRatio: ratio,
  };
}

/**
 * Computes days remaining between now and an ISO timestamp. Used by
 * the hero ring to derive the subscription remainder (`ends_at − now`).
 * Returns 0 for past timestamps; rounds up so the day the subscription
 * expires still counts as "1 day remaining" until the timestamp is
 * actually in the past.
 */
export function daysRemainingUntilISO(iso: string): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  const ms = target - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Day count since `planStartedAtISO`, 1-based. Day 1 is the day the
 * profile was created. Returns 1 when the input is invalid or in the
 * future (defensive — the UI shouldn't render "day 0").
 */
export function computePlanDay(planStartedAtISO: string | null): number {
  if (!planStartedAtISO) return 1;
  const start = new Date(planStartedAtISO).getTime();
  if (Number.isNaN(start)) return 1;
  const ms = Date.now() - start;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

/**
 * Fixed milestone ladder. Phase 16 simplified the per-step copy to a
 * single Hebrew label — the older `{label, name}` pair rendered as two
 * lines under each circle ("שבוע / 7 ימים") which read as redundant
 * once the current step shows the real day count inside its circle.
 */
export const JOURNEY_MILESTONES: ReadonlyArray<{
  day: number;
  position: number; // % along the track
  label: string;
}> = [
  { day: 1, position: 5, label: "התחלה" },
  { day: 7, position: 28, label: "שבוע" },
  { day: 14, position: 52, label: "שבועיים" },
  { day: 30, position: 73, label: "חודש" },
  { day: 100, position: 95, label: "מאסטר" },
] as const;

/**
 * Picks the next un-reached milestone given today's plan day. Returns
 * `null` when the user has cleared the final milestone — the UI then
 * hides the "המיילסטון הבא" sub-line.
 */
export function pickNextMilestone(
  currentDay: number
): { day: number; label: string; daysUntil: number } | null {
  for (const m of JOURNEY_MILESTONES) {
    if (m.day > currentDay) {
      return { day: m.day, label: m.label, daysUntil: m.day - currentDay };
    }
  }
  return null;
}

/**
 * Phase 15 — Interpolated track-fill % for the journey path.
 *
 * The 5 milestone anchors live at fixed %-positions along the track
 * (5/28/52/73/95). Between two adjacent milestones, the track fills
 * linearly with `(currentDay − start) / (end − start)` so the user
 * sees daily forward motion instead of waiting for the next milestone
 * to flip the bar in one chunk.
 *
 * Examples (positions 5/28/52/73/95):
 *   day 1   → 5%   (sitting on the first anchor)
 *   day 11  → 28 + (52−28) * (11−7)/(14−7)  ≈ 41.7%
 *   day 30  → 73%  (on the 30-day anchor)
 *   day 100+ → 95% (clamped at the final anchor)
 */
export function computeTrackFillPct(currentDay: number): number {
  if (currentDay <= JOURNEY_MILESTONES[0].day) return JOURNEY_MILESTONES[0].position;
  for (let i = 0; i < JOURNEY_MILESTONES.length - 1; i++) {
    const start = JOURNEY_MILESTONES[i];
    const end = JOURNEY_MILESTONES[i + 1];
    if (currentDay >= start.day && currentDay < end.day) {
      const t = (currentDay - start.day) / (end.day - start.day);
      return start.position + (end.position - start.position) * t;
    }
  }
  return JOURNEY_MILESTONES[JOURNEY_MILESTONES.length - 1].position;
}

/**
 * `"לפני N דקות / שעות / ימים"` — coarse relative-time formatter for
 * the hero card's last-session meta line. Kept inline rather than
 * pulling `Intl.RelativeTimeFormat` because the dashboard renders
 * server-side and we want a deterministic string (no locale fallbacks).
 */
export function formatRelativeHebrew(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "לפני פחות מדקה";
  const min = Math.floor(sec / 60);
  if (min < 60) return `לפני ${min} ${min === 1 ? "דקה" : "דקות"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} ${hr === 1 ? "שעה" : "שעות"}`;
  const day = Math.floor(hr / 24);
  return `לפני ${day} ${day === 1 ? "יום" : "ימים"}`;
}
