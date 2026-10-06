"use strict";

// Data access for the student's own scratch pages (user_drafts).
//
// RLS-SCOPED CLIENT ONLY. user_drafts has no admin policy at all — a draft is
// the student's private notebook, not something staff read — so there is no
// service-role path here and no caller passes a user id it chose. The
// `user_drafts_students_select_own` policy is the boundary; the explicit
// user_id filter below is defence in depth and, incidentally, what lets the
// (user_id, created_at DESC) index serve the query.

/**
 * How many drafts one list request will return.
 *
 * A cap rather than paging because the scratch pad is a side feature: a student
 * with 200 saved drafts is already an outlier, and a page that silently
 * returned only the first 50 of them would be worse than one that returns the
 * lot. If this is ever hit for real, it wants paging rather than a bigger
 * number — 20,000 characters per draft is a lot of response.
 */
const LIST_LIMIT = 200;

/**
 * The caller's own drafts, newest first.
 *
 * Newest first because a scratch pad is used by recency: the thing you wrote
 * this morning is the thing you came back for.
 */
async function listDraftsForUser(client, userId, { limit = LIST_LIMIT } = {}) {
  const { data, error } = await client
    .from("user_drafts")
    .select("draft_id, text, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

module.exports = { listDraftsForUser, LIST_LIMIT };
