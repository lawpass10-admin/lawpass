/**
 * Slice 4 — "אתה במסלול" status pill evaluator.
 *
 * Activity-based rule per plan §2.1 D1:
 *   - 0–4 lifetime attempts → "התחלת המסע" (starting)
 *   - ≥5 lifetime AND ≥20 attempts in the last rolling 7 days → "אתה במסלול" (on_track)
 *   - ≥5 lifetime AND <20 attempts in the last rolling 7 days → "כדאי להגביר קצב" (speed_up)
 *
 * Pure function — no Supabase, no Date math beyond plain integers. The
 * caller is responsible for computing the two input counts (typically
 * via `getStatusContext` in `lib/db/dashboard.ts`).
 */

import type { StatusPillState } from "@/lib/dashboard/types";

/**
 * Threshold for graduating off the "starting" pill. The user must have
 * at least this many lifetime attempts to be evaluated against the
 * 7-day weekly target.
 */
export const MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL = 5;

/**
 * Rolling-7-day attempt count at or above which the user is "אתה במסלול"
 * (on track). Tunable; bumping this requires a heavier weekly cadence
 * to keep the on-track pill.
 */
export const MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK = 20;

export function evaluateStatus(
  lifetimeAttempts: number,
  attemptsLast7Days: number
): StatusPillState {
  if (lifetimeAttempts < MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL) return "starting";
  if (attemptsLast7Days >= MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK) return "on_track";
  return "speed_up";
}
