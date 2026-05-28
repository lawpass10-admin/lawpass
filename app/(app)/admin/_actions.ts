"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fullNameSchema } from "@/lib/validators/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

const userIdSchema = z.string().uuid({ message: "מזהה משתמש לא תקין" });

const editProfileNameSchema = z.object({
  userId: userIdSchema,
  full_name: fullNameSchema,
});

const userTargetSchema = z.object({ userId: userIdSchema });

/**
 * Insert one row into admin_actions_log. RLS policy
 * `admins_insert_admin_log` requires public.is_admin() to be true for
 * the caller — which we've already verified via requireAdmin() — so the
 * INSERT via the SSR client succeeds.
 *
 * admin_id comes from requireAdmin()'s resolved user, NEVER from a
 * parameter (Hardening Rule #2): a forged payload can't ghost-write a
 * different admin into the audit row.
 */
async function logAdminAction(input: {
  adminId: string;
  actionType: string;
  targetUserId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_actions_log").insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    target_user_id: input.targetUserId,
    details: input.details,
  });
  if (error) {
    // Audit log is load-bearing — fail loudly in server logs but DO NOT
    // hide the underlying action's success from the caller. Surfacing a
    // log failure as an action failure would let an admin abandon the
    // log row by retrying and confuse the operator.
    console.error(
      `[admin-action] audit-log INSERT FAILED admin=${input.adminId} action=${input.actionType} target=${input.targetUserId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
  }
}

// =============================================================================
// Edit display name
// =============================================================================

/**
 * Updates profiles.full_name for the target user. Direct UPDATE under
 * the `admins_update_all_profiles` RLS policy; no RPC needed.
 *
 * Re-validates the input server-side via fullNameSchema (SPEC §9.5
 * layer 3). On success writes one admin_actions_log row.
 */
export async function adminEditProfileNameAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = editProfileNameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const { userId, full_name } = parsed.data;

  const supabase = await createClient();

  // Fetch the prior name into the audit row's details so the log
  // tells a "from → to" story without a separate lookup.
  const { data: priorRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", userId);

  if (error) {
    console.error(
      `[admin] edit profile name FAILED admin=${admin.id} target=${userId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" };
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: "admin.edit_profile_name",
    targetUserId: userId,
    details: {
      from: priorRow?.full_name ?? null,
      to: full_name,
    },
  });

  // Sidebar + dashboard header read full_name from the (app) layout —
  // bust the layout cache so the next render sees the new name.
  revalidatePath("/", "layout");
  return { ok: true };
}

// =============================================================================
// Send password-reset email
// =============================================================================

/**
 * Triggers Supabase Auth's password-recovery email for the target user.
 * Same outcome as the user's own /forgot-password flow (SPEC §6.5), but
 * initiated by an admin — handy when a user can't access their inbox
 * search or when a tester needs a fresh recovery link.
 *
 * Implementation: look up the target's email via the Auth Admin API
 * (admin.auth.admin.getUserById), then call resetPasswordForEmail with
 * an explicit `redirectTo` pointing at /reset-password. The redirectTo
 * matches the URL the user-initiated /forgot-password flow ends up at
 * (see app/(auth)/_actions.ts:requestPasswordResetAction).
 */
export async function adminSendPasswordResetAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "מזהה משתמש לא תקין" };
  }
  const { userId } = parsed.data;

  const adminClient = createAdminClient();

  const { data: userData, error: lookupErr } =
    await adminClient.auth.admin.getUserById(userId);
  if (lookupErr || !userData?.user?.email) {
    console.error(
      `[admin] password reset lookup FAILED admin=${admin.id} target=${userId} msg=${
        lookupErr?.message ?? "no email on user"
      }`
    );
    return { ok: false, error: "לא נמצא משתמש עם המזהה הזה" };
  }
  const email = userData.user.email;

  // NEXT_PUBLIC_SITE_URL is the single source of truth for absolute
  // URLs (per .env.example). resetPasswordForEmail's redirectTo
  // determines where the email's link lands after the user clicks.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error: sendErr } = await adminClient.auth.resetPasswordForEmail(
    email,
    siteUrl ? { redirectTo: `${siteUrl}/reset-password` } : undefined
  );

  if (sendErr) {
    console.error(
      `[admin] password reset send FAILED admin=${admin.id} target=${userId} msg=${sendErr.message}`
    );
    return { ok: false, error: "אירעה שגיאה בשליחת המייל. נסה שוב" };
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: "admin.password_reset",
    targetUserId: userId,
    details: { email },
  });

  return { ok: true };
}

// =============================================================================
// Force sign-out
// =============================================================================

/**
 * Revokes every active session for the target user. The Supabase Auth
 * Admin API's `signOut(jwt, scope)` requires the user's JWT, which we
 * don't possess in an admin context. Instead we delete the rows that
 * back active sessions: auth.sessions. Refresh tokens cascade via FK,
 * and the next refresh attempt the user makes fails — middleware then
 * redirects them to /login.
 *
 * The user's currently-issued access JWT remains valid until expiry
 * (~1h). This is an inherent limit of stateless JWT validation; the
 * "force sign-out" semantics here match what Supabase exposes today.
 */
export async function adminForceSignOutAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "מזהה משתמש לא תקין" };
  }
  const { userId } = parsed.data;

  // Defense: refuse to sign yourself out via the admin surface. The
  // sidebar dropdown already exposes a sign-out for that.
  if (userId === admin.id) {
    return {
      ok: false,
      error: "להתנתקות אישית השתמש בכפתור בסרגל הצד",
    };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error(
      `[admin] force signout FAILED admin=${admin.id} target=${userId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה בניתוק המשתמש. נסה שוב" };
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: "admin.force_signout",
    targetUserId: userId,
    details: {},
  });

  return { ok: true };
}

// =============================================================================
// Slice 10 Phase B-2 — QA admin actions
// =============================================================================

const qaReportStatusSchema = z.enum(["open", "in_progress", "resolved"], {
  message: "סטטוס לא תקין",
});

const adminSetQaReportStatusInput = z.object({
  reportId: z.string().uuid({ message: "מזהה דיווח לא תקין" }),
  status: qaReportStatusSchema,
});

/**
 * Move a QA report between statuses. The qa_reports_admins_update_all
 * RLS policy (Slice 10 migration) permits the SSR-client UPDATE; we
 * still call requireAdmin() at the action boundary so a non-admin
 * doesn't get an obscure RLS error.
 *
 * Audit row carries the previous status so the log tells the full
 * "from → to" story without a second lookup.
 */
export async function adminSetQaReportStatusAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = adminSetQaReportStatusInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const { reportId, status } = parsed.data;

  const supabase = await createClient();

  // Fetch the prior row so the audit log can include from→to AND so we
  // know which user the report belongs to for the audit row's
  // target_user_id (admin_actions_log convention).
  const { data: priorRow } = await supabase
    .from("qa_reports")
    .select("status, user_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!priorRow) {
    return { ok: false, error: "הדיווח לא נמצא" };
  }
  const prior = priorRow as { status: string; user_id: string };

  const { error } = await supabase
    .from("qa_reports")
    .update({ status })
    .eq("id", reportId);

  if (error) {
    console.error(
      `[admin] qa set_status FAILED admin=${admin.id} report=${reportId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "עדכון הסטטוס נכשל. נסה שוב" };
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: "qa.set_status",
    targetUserId: prior.user_id,
    details: { report_id: reportId, from: prior.status, to: status },
  });

  // Bust the layout cache so the open-count badge on AdminNav reflects
  // the new state on the next render. /admin shares one layout above
  // /admin/qa/[id], so the layout-level revalidate is correct.
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const adminSetQaTesterInput = z.object({
  userId: userIdSchema,
  isQaTester: z.boolean(),
});

/**
 * Toggle profiles.is_qa_tester. The admins_update_all_profiles RLS
 * policy (Slice 1 / SPEC §9.4) already permits the UPDATE — no new
 * policy was needed for Slice 10. Audit row carries from→to so the
 * log shows who was promoted/demoted and when.
 */
export async function adminSetQaTesterAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = adminSetQaTesterInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const { userId, isQaTester } = parsed.data;

  const supabase = await createClient();

  const { data: priorRow } = await supabase
    .from("profiles")
    .select("is_qa_tester")
    .eq("id", userId)
    .maybeSingle();
  const prior =
    (priorRow as { is_qa_tester: boolean } | null)?.is_qa_tester ?? false;

  const { error } = await supabase
    .from("profiles")
    .update({ is_qa_tester: isQaTester })
    .eq("id", userId);

  if (error) {
    console.error(
      `[admin] set_qa_tester FAILED admin=${admin.id} target=${userId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "עדכון ההרשאה נכשל. נסה שוב" };
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: isQaTester ? "qa.grant_tester" : "qa.revoke_tester",
    targetUserId: userId,
    details: { from: prior, to: isQaTester },
  });

  // The (app) layout's profile SELECT now includes is_qa_tester (Slice
  // 10 Phase B-1), so a fresh render must run for the target user's
  // next page load to see the new flag. /admin is fine without further
  // revalidate — the user-detail page re-fetches via getUserDetail.
  revalidatePath("/", "layout");
  return { ok: true };
}
