"use strict";

// Ported from lib/dashboard/on-track.ts. "אתה במסלול" status pill.
//
//   - 0–4 lifetime attempts → "starting"
//   - >=5 lifetime AND >=20 attempts in the last rolling 7 days → "on_track"
//   - >=5 lifetime AND <20 attempts in the last rolling 7 days → "speed_up"
//
// Pure function — caller computes the two input counts.

const MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL = 5;
const MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK = 20;

function evaluateStatus(lifetimeAttempts, attemptsLast7Days) {
  if (lifetimeAttempts < MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL) return "starting";
  if (attemptsLast7Days >= MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK) return "on_track";
  return "speed_up";
}

module.exports = {
  evaluateStatus,
  MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL,
  MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK,
};
