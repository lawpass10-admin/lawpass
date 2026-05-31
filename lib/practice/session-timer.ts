/**
 * Slice 24 — wall-clock model for the per-session practice timer.
 *
 * The session timer's authority lives on the server. Every play-page
 * render computes `remaining = max(0, sessionDurationSeconds - (now -
 * startedAt))` and ships that number to the client; the client's
 * <Timer> ticks down from there but doesn't own truth — on the next
 * navigation we re-derive remaining from started_at and the budget,
 * so navigation, resume, and tab-refresh all converge on the same
 * answer.
 *
 * `sessionDurationSeconds === 0` is the "no timer" sentinel — the
 * helper short-circuits and returns null so callers can branch on
 * "is there a session timer at all?" without a separate flag.
 */

export type SessionTimerInputs = {
  /** Budget in seconds. 0 = no timer (returns null below). */
  sessionDurationSeconds: number;
  /** ISO timestamp of `practice_sessions.started_at`. The DB column
   *  is NOT NULL DEFAULT NOW() and `createPracticeSession` doesn't
   *  override it, so this is always present for any session the play
   *  page can load. */
  startedAt: string;
  /** Override for tests. Defaults to `Date.now()`. */
  nowMs?: number;
};

/**
 * Returns the seconds remaining on the session timer, or null when
 * no timer is configured (`sessionDurationSeconds === 0`).
 *
 * Clamped to `[0, sessionDurationSeconds]`:
 *   - Negative clock skew between server and client would otherwise
 *     produce values larger than the original budget.
 *   - Sessions whose elapsed time has overrun the budget return 0.
 */
export function computeRemaining({
  sessionDurationSeconds,
  startedAt,
  nowMs,
}: SessionTimerInputs): number | null {
  if (!Number.isFinite(sessionDurationSeconds) || sessionDurationSeconds <= 0) {
    return null;
  }
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) {
    // Defensive fallback — if started_at can't be parsed (impossible
    // with the current schema, but cheap to guard) treat the session
    // as if it had just started so the user keeps their full budget.
    return sessionDurationSeconds;
  }
  const effectiveNowMs = nowMs ?? Date.now();
  const elapsedSeconds = Math.floor((effectiveNowMs - startMs) / 1000);
  const remaining = sessionDurationSeconds - elapsedSeconds;
  if (remaining <= 0) return 0;
  if (remaining > sessionDurationSeconds) return sessionDurationSeconds;
  return remaining;
}
