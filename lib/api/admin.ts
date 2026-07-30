"use client";

/**
 * Admin domain — client wrappers (safe dual-path). Same signatures +
 * return shape ({ ok } | { ok:false, error }) as the server actions; the
 * admin components import THESE. Each falls back to its server action when
 * the Express API is disabled (production); otherwise POSTs JSON with the
 * Supabase Bearer token.
 *
 * Note: adminSetQaReportStatusAction targets the QA domain on the server
 * (POST /api/qa/status) — the report status lives with the qa router — but
 * it's an admin action, so its wrapper lives here next to the others.
 */

import { apiEnabled, apiPostJson } from "@/lib/api/client";
import {
  adminEditProfileNameAction as editProfileNameFallback,
  adminSendPasswordResetAction as sendPasswordResetFallback,
  adminForceSignOutAction as forceSignOutFallback,
  adminSetQaTesterAction as setQaTesterFallback,
  adminSetQaReportStatusAction as setQaReportStatusFallback,
} from "@/app/(app)/admin/_actions";
import {
  adminEditSourceContentAction as editSourceContentFallback,
  adminEditAngleContentAction as editAngleContentFallback,
} from "@/app/(app)/admin/chapters/[chapterId]/questions/[questionId]/_actions";

type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב";

/** Shared dual-path POST → { ok } | { ok:false, error } envelope. */
async function dualPost(
  path: string,
  input: unknown,
  fallback: (input: unknown) => Promise<ActionResult>
): Promise<ActionResult> {
  if (!apiEnabled()) {
    return fallback(input);
  }
  try {
    const data = await apiPostJson(path, input, { auth: true });
    if (data.ok === true) return { ok: true };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : GENERIC_ERROR,
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export function adminEditProfileNameAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/profile/name", input, editProfileNameFallback);
}

export function adminSendPasswordResetAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/password-reset", input, sendPasswordResetFallback);
}

export function adminForceSignOutAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/force-signout", input, forceSignOutFallback);
}

export function adminSetQaTesterAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/qa-tester", input, setQaTesterFallback);
}

export function adminEditSourceContentAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/content/source", input, editSourceContentFallback);
}

export function adminEditAngleContentAction(input: unknown): Promise<ActionResult> {
  return dualPost("/api/admin/content/angle", input, editAngleContentFallback);
}

export function adminSetQaReportStatusAction(input: unknown): Promise<ActionResult> {
  // Server route lives under the qa router.
  return dualPost("/api/qa/status", input, setQaReportStatusFallback);
}
