"use strict";

// Shared admin infrastructure + data-access. Ported from logAdminAction
// (app/(app)/admin/_actions.ts and the content-editor _actions.ts) plus
// the table reads/writes those actions performed inline.
//
// RLS is the boundary: every helper here runs under the admin's
// RLS-scoped client and relies on the admins_* policies
// (admins_update_all_profiles, admins_full_access_source_questions, etc.)
// — EXCEPT deleteAuthSessions, which touches the protected `auth` schema
// and therefore requires the service-role client.

/**
 * Insert one row into admin_actions_log. The admins_insert_admin_log RLS
 * policy requires public.is_admin() for the caller — already verified by
 * the requireAdmin middleware — so the INSERT via the admin's RLS client
 * succeeds.
 *
 * adminId comes from the authenticated admin (req.user.id), NEVER from a
 * request parameter (Hardening Rule #2). Both target columns are
 * optional: user-management actions set target_user_id; content edits set
 * target_resource_id; either unset column is written as null.
 *
 * The audit log is load-bearing but must not mask the underlying
 * action's success — a failed INSERT is logged loudly and swallowed,
 * exactly as the Next.js versions did (surfacing it would tempt the
 * operator to retry and abandon the row).
 */
async function logAdminAction(supabase, input) {
  const { error } = await supabase.from("admin_actions_log").insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    target_user_id: input.targetUserId != null ? input.targetUserId : null,
    target_resource_id:
      input.targetResourceId != null ? input.targetResourceId : null,
    details: input.details,
  });
  if (error) {
    console.error(
      `[admin-action] audit-log INSERT FAILED admin=${input.adminId} action=${input.actionType} target=${
        input.targetUserId || input.targetResourceId || "-"
      } code=${error.code || "unknown"} msg=${error.message}`
    );
  }
}

// =============================================================================
// Profiles
// =============================================================================

/** Read a single field-set of a profile by id (for audit "from" values). */
async function getProfile(supabase, userId, columns) {
  const { data } = await supabase
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function updateProfile(supabase, userId, patch) {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

// =============================================================================
// Auth sessions (force sign-out) — service-role only
// =============================================================================

/**
 * Delete every active session row for a user (auth.sessions). Refresh
 * tokens cascade via FK; the next refresh fails and middleware bounces
 * the user to /login. Requires the service-role client — the `auth`
 * schema is not reachable under RLS.
 */
async function deleteAuthSessions(adminClient, userId) {
  const { error } = await adminClient
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("user_id", userId);
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

// =============================================================================
// Question content (source / angle)
// =============================================================================

const SOURCE_CONTENT_COLUMNS =
  "legal_topic_analysis, full_explanation, common_pitfall, " +
  "summary_for_memory, quick_thinking_360, notes_for_admin, " +
  "concepts_and_skills, references_list";

const ANGLE_CONTENT_COLUMNS =
  "legal_topic_analysis, full_explanation, common_pitfall, " +
  "summary_for_memory, quick_thinking_360, concepts_and_skills, " +
  "references_list";

async function getSourceContent(supabase, sourceQuestionId) {
  const { data, error } = await supabase
    .from("source_questions")
    .select(SOURCE_CONTENT_COLUMNS)
    .eq("id", sourceQuestionId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function updateSourceContent(supabase, sourceQuestionId, patch) {
  const { error } = await supabase
    .from("source_questions")
    .update(patch)
    .eq("id", sourceQuestionId);
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

async function getAngleContent(supabase, angleQuestionId) {
  const { data, error } = await supabase
    .from("angle_questions")
    .select(ANGLE_CONTENT_COLUMNS)
    .eq("id", angleQuestionId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function updateAngleContent(supabase, angleQuestionId, patch) {
  const { error } = await supabase
    .from("angle_questions")
    .update(patch)
    .eq("id", angleQuestionId);
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

module.exports = {
  logAdminAction,
  getProfile,
  updateProfile,
  deleteAuthSessions,
  getSourceContent,
  updateSourceContent,
  getAngleContent,
  updateAngleContent,
};
