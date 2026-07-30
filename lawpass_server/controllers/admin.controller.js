"use strict";

// Ported from app/(app)/admin/_actions.ts (user management) and
// app/(app)/admin/chapters/[chapterId]/questions/[questionId]/_actions.ts
// (question content editing). requireAdmin runs upstream in the route, so
// req.user is a verified admin. `revalidatePath` was dropped throughout —
// the frontend refetches after a mutation.
//
// Audit logging follows the Next.js pattern: the write succeeds first,
// then one admin_actions_log row is written (adminId always from
// req.user.id — never a payload field). The QA-report status action lives
// with the qa domain; the QA-tester toggle stays here (it targets a
// user's profile, not a report).

const { env } = require("../config/env");
const { adminClient } = require("../config/supabase");
const {
  logAdminAction,
  getProfile,
  updateProfile,
  deleteAuthSessions,
  getSourceContent,
  updateSourceContent,
  getAngleContent,
  updateAngleContent,
} = require("../db/admin");
const {
  SOURCE_EDITABLE_FIELDS,
  ANGLE_EDITABLE_FIELDS,
} = require("../validators/admin");

/**
 * Field-name diff for the audit log. We log only which fields changed —
 * never the full before/after text (potentially many KB per field).
 */
function diffFields(before, after, fields) {
  const changed = [];
  for (const key of fields) {
    const b = before[key];
    const a = after[key];
    if (Array.isArray(b) && Array.isArray(a)) {
      if (b.length !== a.length || b.some((v, i) => v !== a[i])) {
        changed.push(key);
      }
    } else if (b !== a) {
      changed.push(key);
    }
  }
  return changed;
}

// =============================================================================
// User management
// =============================================================================

/** POST /api/admin/profile/name — update profiles.full_name + audit. */
async function editProfileName(req, res) {
  const { userId, full_name } = req.valid;
  const supabase = req.supabase;
  const admin = req.user;

  const prior = await getProfile(supabase, userId, "full_name");

  const result = await updateProfile(supabase, userId, { full_name });
  if (!result.ok) {
    console.error(
      `[admin] edit profile name FAILED admin=${admin.id} target=${userId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" });
  }

  await logAdminAction(supabase, {
    adminId: admin.id,
    actionType: "admin.edit_profile_name",
    targetUserId: userId,
    details: { from: (prior && prior.full_name) || null, to: full_name },
  });

  console.info(`[admin] edit_profile_name OK admin=${admin.id} target=${userId}`);
  return res.json({ ok: true });
}

/**
 * POST /api/admin/password-reset — trigger Supabase Auth's recovery email
 * for the target user. Looks up the email via the Auth Admin API, then
 * sends the reset with a redirectTo pointing at /reset-password (matching
 * the user-initiated /forgot-password flow). Uses the service-role client.
 */
async function sendPasswordReset(req, res) {
  const { userId } = req.valid;
  const admin = req.user;
  const svc = adminClient();

  const { data: userData, error: lookupErr } =
    await svc.auth.admin.getUserById(userId);
  if (lookupErr || !userData || !userData.user || !userData.user.email) {
    console.error(
      `[admin] password reset lookup FAILED admin=${admin.id} target=${userId} msg=${
        (lookupErr && lookupErr.message) || "no email on user"
      }`
    );
    return res.json({ ok: false, error: "לא נמצא משתמש עם המזהה הזה" });
  }
  const email = userData.user.email;

  const { error: sendErr } = await svc.auth.resetPasswordForEmail(
    email,
    env.siteUrl ? { redirectTo: `${env.siteUrl}/reset-password` } : undefined
  );
  if (sendErr) {
    console.error(
      `[admin] password reset send FAILED admin=${admin.id} target=${userId} msg=${sendErr.message}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בשליחת המייל. נסה שוב" });
  }

  await logAdminAction(svc, {
    adminId: admin.id,
    actionType: "admin.password_reset",
    targetUserId: userId,
    details: { email },
  });

  console.info(`[admin] password_reset OK admin=${admin.id} target=${userId}`);
  return res.json({ ok: true });
}

/**
 * POST /api/admin/force-signout — revoke every active session for the
 * target user by deleting auth.sessions rows (refresh tokens cascade).
 * The already-issued access JWT stays valid until expiry (~1h) — an
 * inherent limit of stateless JWTs. Refuses to sign the admin out of
 * their own sessions via this surface.
 */
async function forceSignOut(req, res) {
  const { userId } = req.valid;
  const admin = req.user;

  if (userId === admin.id) {
    return res.json({
      ok: false,
      error: "להתנתקות אישית השתמש בכפתור בסרגל הצד",
    });
  }

  const result = await deleteAuthSessions(adminClient(), userId);
  if (!result.ok) {
    console.error(
      `[admin] force signout FAILED admin=${admin.id} target=${userId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בניתוק המשתמש. נסה שוב" });
  }

  await logAdminAction(req.supabase, {
    adminId: admin.id,
    actionType: "admin.force_signout",
    targetUserId: userId,
    details: {},
  });

  console.info(`[admin] force_signout OK admin=${admin.id} target=${userId}`);
  return res.json({ ok: true });
}

/** POST /api/admin/qa-tester — toggle profiles.is_qa_tester + audit. */
async function setQaTester(req, res) {
  const { userId, isQaTester } = req.valid;
  const supabase = req.supabase;
  const admin = req.user;

  const priorRow = await getProfile(supabase, userId, "is_qa_tester");
  const prior = (priorRow && priorRow.is_qa_tester) || false;

  const result = await updateProfile(supabase, userId, {
    is_qa_tester: isQaTester,
  });
  if (!result.ok) {
    console.error(
      `[admin] set_qa_tester FAILED admin=${admin.id} target=${userId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "עדכון ההרשאה נכשל. נסה שוב" });
  }

  await logAdminAction(supabase, {
    adminId: admin.id,
    actionType: isQaTester ? "qa.grant_tester" : "qa.revoke_tester",
    targetUserId: userId,
    details: { from: prior, to: isQaTester },
  });

  console.info(`[admin] set_qa_tester OK admin=${admin.id} target=${userId} to=${isQaTester}`);
  return res.json({ ok: true });
}

// =============================================================================
// Question content editing
// =============================================================================

/**
 * POST /api/admin/content/source — update the editable text/array fields
 * on a source_questions row. The validator whitelists exactly the
 * editable fields, so a forged payload can't touch question_text /
 * chapter_id / status / choice rows. RLS
 * (admins_full_access_source_questions) permits the UPDATE.
 */
async function editSourceContent(req, res) {
  const admin = req.user;
  const supabase = req.supabase;
  const { sourceQuestionId, ...nextFields } = req.valid;

  const priorRow = await getSourceContent(supabase, sourceQuestionId);
  if (!priorRow) {
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  const result = await updateSourceContent(supabase, sourceQuestionId, nextFields);
  if (!result.ok) {
    console.error(
      `[admin] edit source content FAILED admin=${admin.id} source=${sourceQuestionId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" });
  }

  const fieldsChanged = diffFields(priorRow, nextFields, SOURCE_EDITABLE_FIELDS);

  await logAdminAction(supabase, {
    adminId: admin.id,
    actionType: "edit_source_content",
    targetResourceId: sourceQuestionId,
    details: { fields_changed: fieldsChanged },
  });

  console.info(
    `[admin] edit_source_content OK admin=${admin.id} source=${sourceQuestionId} changed=[${fieldsChanged.join(",")}]`
  );
  return res.json({ ok: true });
}

/** POST /api/admin/content/angle — same as source, for angle_questions. */
async function editAngleContent(req, res) {
  const admin = req.user;
  const supabase = req.supabase;
  const { angleQuestionId, ...nextFields } = req.valid;

  const priorRow = await getAngleContent(supabase, angleQuestionId);
  if (!priorRow) {
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  const result = await updateAngleContent(supabase, angleQuestionId, nextFields);
  if (!result.ok) {
    console.error(
      `[admin] edit angle content FAILED admin=${admin.id} angle=${angleQuestionId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" });
  }

  const fieldsChanged = diffFields(priorRow, nextFields, ANGLE_EDITABLE_FIELDS);

  await logAdminAction(supabase, {
    adminId: admin.id,
    actionType: "edit_angle_content",
    targetResourceId: angleQuestionId,
    details: { fields_changed: fieldsChanged },
  });

  console.info(
    `[admin] edit_angle_content OK admin=${admin.id} angle=${angleQuestionId} changed=[${fieldsChanged.join(",")}]`
  );
  return res.json({ ok: true });
}

module.exports = {
  editProfileName,
  sendPasswordReset,
  forceSignOut,
  setQaTester,
  editSourceContent,
  editAngleContent,
};
