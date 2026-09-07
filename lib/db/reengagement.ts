/**
 * Data access for the re-engagement nudge.
 *
 * The selection logic is NOT here — it is the `reengagement_candidates` SQL
 * function (supabase/migrations/20260907000001_reengagement_nudges.sql). This
 * file only calls it and writes the send log, so there is exactly one
 * definition of "inactive" and it lives next to the data it measures.
 *
 * Service role throughout: the function returns other people's email addresses
 * and the log table has no RLS policies, both deliberately.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** One row of `reengagement_candidates`. */
export type ReengagementCandidate = {
  user_id: string;
  full_name: string;
  user_email: string;
  gender: string | null;
  last_activity_at: string;
  nudges_sent: number;
};

export type CandidateOptions = {
  /** Silence before a nudge is due. The feature's headline number. */
  inactiveHours?: number;
  /** Minimum gap between two nudges to the same person. */
  cooldownHours?: number;
  /** Total nudges one person will ever receive before we stop. */
  maxNudges?: number;
  /** Ceiling on one run — see the note about function timeouts in the route. */
  batchLimit?: number;
};

export async function fetchReengagementCandidates(
  admin: SupabaseClient,
  options: CandidateOptions = {}
): Promise<ReengagementCandidate[]> {
  const { data, error } = await admin.rpc("reengagement_candidates", {
    inactive_hours: options.inactiveHours ?? 24,
    cooldown_hours: options.cooldownHours ?? 168,
    max_nudges: options.maxNudges ?? 3,
    batch_limit: options.batchLimit ?? 25,
  });

  if (error) throw new Error(`reengagement_candidates failed: ${error.message}`);
  return (data ?? []) as ReengagementCandidate[];
}

/**
 * Records that we tried.
 *
 * WRITTEN ON FAILURE TOO, with delivered=false. If a failed send left no row,
 * a provider outage would put the same candidates back in the next run's
 * results, and the run after that — hammering Resend with the same batch every
 * hour until it recovered, then delivering the backlog all at once. A row
 * costs nothing and makes the cooldown mean what it says.
 */
export async function recordNudge(
  admin: SupabaseClient,
  input: { userId: string; providerId: string | null; delivered: boolean; kind?: string }
): Promise<void> {
  const { error } = await admin.from("email_nudges").insert({
    user_id: input.userId,
    kind: input.kind ?? "reengagement",
    provider_id: input.providerId,
    delivered: input.delivered,
  });

  // Logged, not thrown: the email has already gone out by this point, and
  // failing the request would not un-send it. The cost of a lost row is one
  // possible duplicate later, which is better than a 500 on a cron endpoint.
  if (error) console.error("[reengagement] could not log nudge", input.userId, error.message);
}
