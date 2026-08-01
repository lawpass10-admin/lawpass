"use client";

/**
 * Auth domain — client wrappers (safe dual-path). This is the ONLY domain
 * that touches the session, so it's the most delicate:
 *
 *   - The Next.js server actions establish the session via cookies (SSR)
 *     and, on success, either `redirect()` server-side (signIn / signUp /
 *     requestPasswordReset / resetPassword / signOut) or RETURN
 *     `{ ok, url }` for the component to navigate (verifyOtp /
 *     completeGoogle).
 *   - The Express endpoints are stateless: they RETURN the session tokens
 *     in the body. So when the API is enabled, these wrappers must:
 *       (a) persist the returned session onto the browser Supabase client
 *           (`setSession` → @supabase/ssr writes the auth cookies the
 *           middleware reads), and
 *       (b) replicate the server redirect with a client-side
 *           `window.location.assign(url)` for the redirect-style actions
 *           (the components do nothing on success for those).
 *
 * When the API is disabled (production, NEXT_PUBLIC_API_BASE_URL unset)
 * every wrapper defers to the original server action, so the secure
 * cookie-based SSR flow is unchanged. The return SHAPES mirror what each
 * component reads (`.ok`, `.error`, and `.url` for the two navigate-self
 * actions), so call sites are untouched.
 */

import { apiEnabled, apiPostJson } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import {
  signUpAction as signUpFallback,
  verifyOtpAction as verifyOtpFallback,
  resendOtpAction as resendOtpFallback,
  signInAction as signInFallback,
  completeGoogleOAuthSignup as completeGoogleFallback,
  requestPasswordResetAction as requestPasswordResetFallback,
  resetPasswordAction as resetPasswordFallback,
  signOutAction as signOutFallback,
} from "@/app/(auth)/_actions";

// ============================================================================
// [VERIFY-EXPRESS] TEMPORARY — Next.js server-action fallback DISABLED
// REPO-WIDE. This banner is the canonical explanation; every other disabled
// site points back here. Search the repo for `[VERIFY-EXPRESS]` to find them.
//
// The frontend now talks EXCLUSIVELY to the Express API (lawpass_server) —
// there is no code path left that reaches the Next.js server actions, so a
// working feature PROVES Express served it (no silent fallback).
//
// Disabled sites:
//   • lib/api/auth.ts        — the 8 fallback lines below (all auth flows)
//   • lib/api/client.ts      — the `apiAction` factory (21 practice/exam
//                              gameplay actions in practice/practice-play/exam)
//   • lib/api/admin.ts       — the shared `dualPost` (all 7 admin actions)
//   • lib/api/bookmarks.ts, mistakes.ts, notes.ts (×2), qa.ts
//   • app/(app)/dashboard/_lib/queries.ts — `apiOr` now THROWS instead of
//     silently degrading to the in-app DB helpers
//   (account.ts + early-access.ts were already hard Express-only pilots.)
//
// ⚠️ While disabled the app REQUIRES the Express server in EVERY environment
//    incl. production (NEXT_PUBLIC_API_BASE_URL must be set) — DO NOT DEPLOY.
// ⚠️ To REVERT: uncomment every `[VERIFY-EXPRESS]`-marked block repo-wide.
// ============================================================================

type OkOrError = { ok: true } | { ok: false; error: string };
type OkUrlOrError = { ok: true; url: string } | { ok: false; error: string };

const GENERIC = "אירעה שגיאה. נסה שוב";

function errStr(data: Record<string, unknown>): string {
  return typeof data.error === "string" ? data.error : GENERIC;
}

/**
 * Persist a session returned by the API onto the browser client so
 * @supabase/ssr writes the auth cookies the server middleware reads. A
 * null/empty session (e.g. the unverified-signin branch) is a no-op.
 */
async function persistSession(session: unknown): Promise<void> {
  const s = session as
    | { access_token?: string; refresh_token?: string }
    | null
    | undefined;
  if (s && s.access_token && s.refresh_token) {
    await createClient().auth.setSession({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
    });
  }
}

// --- Sign in: establishes the session, then navigates (action redirected).
export async function signInAction(
  ...args: Parameters<typeof signInFallback>
): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return signInFallback(...args);
  try {
    const data = await apiPostJson("/api/auth/signin", args[0], {
      auth: false,
    });
    if (data.ok === true) {
      await persistSession(data.session);
      if (typeof data.url === "string") window.location.assign(data.url);
      return { ok: true };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: "פרטי ההתחברות שגויים" };
  }
}

// --- Sign up: sends the optional intendedPlan too, then navigates.
export async function signUpAction(
  ...args: Parameters<typeof signUpFallback>
): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return signUpFallback(...args);
  try {
    const body = { ...args[0], intendedPlan: args[1]?.intendedPlan ?? undefined };
    const data = await apiPostJson("/api/auth/signup", body, { auth: false });
    if (data.ok === true) {
      if (typeof data.url === "string") window.location.assign(data.url);
      return { ok: true };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Verify OTP: establishes the session, RETURNS url (component navigates).
export async function verifyOtpAction(
  ...args: Parameters<typeof verifyOtpFallback>
): Promise<OkUrlOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return verifyOtpFallback(...args);
  try {
    const data = await apiPostJson("/api/auth/verify-otp", args[0], {
      auth: false,
    });
    if (data.ok === true) {
      await persistSession(data.session);
      return {
        ok: true,
        url: typeof data.url === "string" ? data.url : "/dashboard",
      };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Resend OTP: plain pass-through.
export async function resendOtpAction(
  ...args: Parameters<typeof resendOtpFallback>
): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return resendOtpFallback(...args);
  try {
    const data = await apiPostJson("/api/auth/resend-otp", args[0], {
      auth: false,
    });
    if (data.ok === true) return { ok: true };
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Request password reset: navigates (action redirected).
export async function requestPasswordResetAction(
  ...args: Parameters<typeof requestPasswordResetFallback>
): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return requestPasswordResetFallback(...args);
  try {
    const data = await apiPostJson(
      "/api/auth/request-password-reset",
      args[0],
      { auth: false }
    );
    if (data.ok === true) {
      if (typeof data.url === "string") window.location.assign(data.url);
      return { ok: true };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Reset password: navigates (action redirected). No session (user
//     re-authenticates on /login).
export async function resetPasswordAction(
  ...args: Parameters<typeof resetPasswordFallback>
): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return resetPasswordFallback(...args);
  try {
    const data = await apiPostJson("/api/auth/reset-password", args[0], {
      auth: false,
    });
    if (data.ok === true) {
      if (typeof data.url === "string") window.location.assign(data.url);
      return { ok: true };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Complete Google signup: auth-gated, RETURNS url (component navigates).
export async function completeGoogleOAuthSignup(
  ...args: Parameters<typeof completeGoogleFallback>
): Promise<OkUrlOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return completeGoogleFallback(...args);
  try {
    const data = await apiPostJson(
      "/api/auth/complete-google-signup",
      args[0],
      { auth: true }
    );
    if (data.ok === true) {
      return {
        ok: true,
        url: typeof data.url === "string" ? data.url : "/dashboard",
      };
    }
    return { ok: false, error: errStr(data) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

// --- Sign out: revokes server-side, clears the browser session, navigates.
export async function signOutAction(): Promise<OkOrError> {
  // [VERIFY-EXPRESS] if (!apiEnabled()) return signOutFallback();
  const supabase = createClient();
  let url = "/login";
  try {
    const data = await apiPostJson("/api/auth/signout", {}, { auth: true });
    if (typeof data.url === "string") url = data.url;
  } catch {
    // Server-side revoke failed/unreachable — still clear the client below.
  }
  await supabase.auth.signOut();
  window.location.assign(url);
  return { ok: true };
}
