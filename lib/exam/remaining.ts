/**
 * How much of an exam sitting is left, in seconds.
 *
 * This is the browser-side mirror of the `public.exam_elapsed_seconds` SQL
 * function added in supabase/migrations/20260927000001_exam_wallclock_timer.sql.
 * The two MUST agree: the server is authoritative when an answer is filed,
 * but the page has to render a clock before any RPC has run, and before this
 * existed it rendered `total_duration_seconds - time_used_seconds` straight
 * from the row. That stored figure is only refreshed when an RPC fires, so
 * every reload showed the clock as it stood at the last answer and handed the
 * candidate back the time since — measured at about 106 seconds per refresh,
 * repeatable, and unbounded if you kept reloading.
 *
 * Deriving it from `started_at` instead means the clock cannot be rewound by
 * reloading, because nothing about the page's lifetime appears in it.
 *
 * A finished sitting is a different question: there is no "now" to measure
 * against any more, and `time_used_seconds` was frozen at the real elapsed by
 * `submit_final_exam`. So completed and abandoned rows read the stored value,
 * which is also what the results page and the archive show.
 */
export function examRemainingSeconds(
  session: {
    total_duration_seconds: number;
    time_used_seconds: number;
    total_paused_seconds: number;
    status: string;
    started_at: string;
    paused_at: string | null;
  },
  now: number = Date.now()
): number {
  const total = session.total_duration_seconds;

  if (session.status !== "active" && session.status !== "paused") {
    return Math.max(0, total - session.time_used_seconds);
  }

  const startedMs = new Date(session.started_at).getTime();
  if (!Number.isFinite(startedMs)) {
    // A row we cannot date is not worth guessing at — fall back to the cache
    // rather than showing a clock derived from NaN.
    return Math.max(0, total - session.time_used_seconds);
  }

  // The pause currently in progress, if any. Completed pauses are already in
  // total_paused_seconds; this one is not, because it has no end yet.
  let livePause = 0;
  if (session.status === "paused" && session.paused_at) {
    const pausedMs = new Date(session.paused_at).getTime();
    if (Number.isFinite(pausedMs)) {
      livePause = Math.max(0, Math.round((now - pausedMs) / 1000));
    }
  }

  const wall = Math.round((now - startedMs) / 1000);
  const elapsed = Math.min(
    total,
    Math.max(0, wall - (session.total_paused_seconds ?? 0) - livePause)
  );
  return Math.max(0, total - elapsed);
}
