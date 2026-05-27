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
