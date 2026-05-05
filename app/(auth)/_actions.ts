"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  birthDateSchema,
  emailSchema,
  examDatePlannedSchema,
  forgotPasswordSchema,
  fullNameSchema,
  genderSchema,
  loginSchema,
  oauthCompletionSchema,
  otpSchema,
  phoneSchema,
  resetPasswordSchema,
  signupSchema,
  type OAuthCompletionInput,
  type SignupInput,
} from "@/lib/validators/auth";

// =============================================================================
// Types
// =============================================================================

type ActionResult = { ok: true } | { ok: false; error: string };

// =============================================================================
// Helpers (not exported — internal to this file)
// =============================================================================

/**
 * Maps common Supabase AuthError codes / messages to Hebrew user-facing strings.
 * Falls back to a generic error if no match.
 *
 * Note: SPEC §6.4/§6.5 require generic strings on the login + password-reset
 * paths to prevent email enumeration. Those actions intentionally bypass this
 * helper for failure cases and return a hard-coded generic string.
 */
function mapAuthError(
  error: AuthError,
  fallback = "אירעה שגיאה. נסה שוב"
): string {
  // Supabase v2 may expose a structured `code`; fall back to message string.
  const code = (error as unknown as { code?: string }).code;
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "כתובת המייל כבר רשומה במערכת";
    case "weak_password":
      return "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה ומספר";
    case "invalid_credentials":
      return "פרטי ההתחברות שגויים";
    case "otp_expired":
    case "otp_disabled":
      return "הקוד פג תוקף או שגוי";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "יותר מדי בקשות. נסה שוב בעוד מספר דקות";
    case "email_not_confirmed":
      return "המייל טרם אומת. בדוק את תיבת הדואר שלך";
  }
  switch (error.message) {
    case "User already registered":
      return "כתובת המייל כבר רשומה במערכת";
    case "Invalid login credentials":
      return "פרטי ההתחברות שגויים";
    case "Token has expired or is invalid":
      return "הקוד פג תוקף או שגוי";
  }
  return fallback;
}

/**
 * Clears every sb-* prefixed cookie from the request. Used at the start of
 * session-establishing actions (verifyOtpAction, signInAction,
 * resetPasswordAction) and at the end of signOutAction so the Supabase SDK
 * never has to write a new session into a cookie state littered with chunks
 * from a previous user.
 *
 * Defends against two real bugs observed in production:
 *   - Stale-JWT lockout: a JWT cookie for a deleted user keeps getting sent
 *     until something explicitly deletes it.
 *   - Chunk persistence: sb-…-auth-token splits into .0/.1/.2 chunks; if the
 *     new session has fewer chunks than the old, surviving chunks corrupt
 *     JWT decoding back to the previous user.
 */
async function clearStaleAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) cookieStore.delete(c.name);
  }
}

/**
 * Validates auth.user_metadata read back in verifyOtpAction. This is the
 * contract between signUpAction (writer) and verifyOtpAction (reader); a
 * mismatch means metadata was tampered with or the writer changed shape.
 */
const userMetadataSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  gender: genderSchema,
  birth_date: birthDateSchema,
  exam_date_planned: examDatePlannedSchema,
  // ISO timestamp captured server-side at signUpAction time.
  terms_accepted_at: z.string().min(1),
});

/**
 * Calls the public.complete_user_profile RPC to create the profiles row for
 * the authenticated user. Centralizes the contract — same RPC will be used
 * by Phase 5's OAuth completion flow.
 *
 * Hardening Rule #2: uses the SSR client (carries the user's auth cookies).
 * The RPC is SECURITY DEFINER so the body can read auth.users.email_confirmed_at
 * and INSERT into profiles, but it derives the target row's id from
 * (SELECT auth.uid()) — never from a parameter — so a caller can only ever
 * create their own profile.
 *
 * Idempotency: ON CONFLICT (id) DO NOTHING in the RPC body. Concurrent calls
 * and re-runs both succeed silently.
 */
async function createProfile(input: {
  user_id: string;
  full_name: string;
  phone: string;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
  birth_date: string; // YYYY-MM-DD
  exam_date_planned: string | null; // YYYY-MM-01 or null
  terms_accepted_at: string; // ISO timestamp from signUpAction
  signup_source: "email" | "google";
}): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("complete_user_profile", {
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_gender: input.gender,
    p_birth_date: input.birth_date,
    p_exam_date_planned: input.exam_date_planned,
    p_terms_accepted_at: input.terms_accepted_at,
    p_signup_source: input.signup_source,
  });

  if (error) {
    // TODO(slice-7): replace with structured logger.
    console.error(
      `[profile] rpc FAILED user=${input.user_id} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return {
      ok: false,
      error: "אירעה שגיאה ביצירת הפרופיל. נסה שוב או פנה לתמיכה",
    };
  }

  // TODO(slice-7): replace with structured logger.
  console.info(
    `[profile] rpc OK user=${input.user_id} signup_source=${input.signup_source}`
  );
  return { ok: true };
}

// =============================================================================
// Server Actions
// =============================================================================

/**
 * SPEC §6.1: signs up a user with email + password and triggers an OTP email.
 *
 * Confirm email is ON in the Supabase dashboard, so signUp() does NOT establish
 * a session — auth cookies are not set. The profiles INSERT is therefore
 * deferred to verifyOtpAction (where the session exists and RLS lets us write).
 *
 * Profile metadata is stashed in auth.user_metadata via options.data and read
 * back from auth.users.raw_user_meta_data in verifyOtpAction.
 *
 * Redirects to /verify-email?email=... on success.
 */
export async function signUpAction(input: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      // Stored on auth.users.raw_user_meta_data; read back in verifyOtpAction.
      data: {
        full_name: data.full_name,
        phone: data.phone,
        gender: data.gender,
        birth_date: data.birth_date,
        exam_date_planned: data.exam_date_planned,
        // Captured server-side at signup time, persisted to
        // profiles.terms_accepted_at on OTP verification.
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  redirect(`/verify-email?email=${encodeURIComponent(data.email)}`);
}

/**
 * SPEC §6.3: verifies the 6-digit OTP, creates the profiles row, activates
 * the account.
 *
 * After OTP verification, middleware in (app)/layout.tsx detects missing
 * subscription and redirects to /pricing. Phase 6 wires the pricing CTA
 * to grant_mock_subscription() which creates the mock sub and unblocks
 * /dashboard access.
 *
 * Custom 5-attempt / 15-minute lockout from SPEC §6.3 + §12.2.4 is deferred:
 * for Phase 3 we rely on Supabase Auth's built-in rate limits and surface a
 * best-effort UI attempt counter on the client.
 * TODO(slice-7): explicit lockout via custom DB tracking.
 */
export async function verifyOtpAction(input: {
  email: string;
  token: string;
}): Promise<ActionResult> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "קלט לא תקין",
    };
  }
  const data = parsed.data;

  // Wipe any stale sb-* cookies before Supabase writes the new session.
  await clearStaleAuthCookies();

  const supabase = await createClient();
  const { data: verifyData, error } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.token,
    type: "email",
  });

  if (error) {
    return {
      ok: false,
      error: mapAuthError(error, "הקוד פג תוקף או שגוי"),
    };
  }

  const userId = verifyData.user?.id;
  const meta = verifyData.user?.user_metadata;
  if (!userId || !meta) {
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  // Re-validate metadata read back from auth.users — defense in depth against
  // any drift between signUpAction (writer) and here (reader).
  const metaParsed = userMetadataSchema.safeParse(meta);
  if (!metaParsed.success) {
    return {
      ok: false,
      error: "פרטי ההרשמה אינם זמינים. נסה להירשם מחדש",
    };
  }

  const profileResult = await createProfile({
    user_id: userId,
    full_name: metaParsed.data.full_name,
    phone: metaParsed.data.phone,
    gender: metaParsed.data.gender,
    birth_date: metaParsed.data.birth_date,
    exam_date_planned: metaParsed.data.exam_date_planned,
    terms_accepted_at: metaParsed.data.terms_accepted_at,
    signup_source: "email",
  });
  if (!profileResult.ok) {
    // Fail-recovery: don't leave the user in a half-authenticated state with
    // no profile row. Without this, the next request would land on
    // (app)/layout.tsx, hit the missing-profile branch, and redirect to
    // /onboarding/complete-profile (a Phase 5 placeholder) with no recovery
    // path. Sign them out and wipe cookies so they're back to a clean slate
    // and can retry signup. The auth.users orphan remains until admin cleanup
    // or until Phase 5 wires /onboarding/complete-profile to recover from it.
    await supabase.auth.signOut();
    await clearStaleAuthCookies();
    return profileResult;
  }

  // Commit cookies set by Supabase SSR before the redirect lands.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * SPEC §6.3 Edge Case: 60-second cooldown before OTP can be resent.
 *
 * Cooldown is enforced via an HttpOnly cookie 'lawpass_otp_resend_lock' with
 * Max-Age=60. The cookie is set only AFTER Supabase accepts the resend, so a
 * Supabase-side rejection (e.g. its own rate limit) doesn't burn the user's
 * cooldown slot. Supabase has its own ~60s server-side rate limit on resend,
 * which acts as a backstop if the user clears the cookie.
 */
export async function resendOtpAction(input: {
  email: string;
}): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "כתובת מייל לא תקינה",
    };
  }

  const cookieStore = await cookies();
  if (cookieStore.has("lawpass_otp_resend_lock")) {
    return { ok: false, error: "המתן עד 60 שניות לפני שליחת קוד חדש" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  cookieStore.set("lawpass_otp_resend_lock", "1", {
    maxAge: 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { ok: true };
}

/**
 * SPEC §6.4: signs in with email + password.
 *
 * Returns a generic error on any failure (no email enumeration). On success
 * redirects to /dashboard.
 */
export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "פרטי ההתחברות שגויים" };
  }
  const data = parsed.data;

  // Wipe any stale sb-* cookies before Supabase writes the new session.
  await clearStaleAuthCookies();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    // SPEC §6.4 step 3: pending_verification → /verify-email. Supabase only
    // returns this code when the email + password ARE valid but the email is
    // unverified, so we know it's safe to surface the email back. The leak
    // ("this credential pair is valid but unverified") is the trade-off SPEC
    // accepts in exchange for letting legitimate users recover from an
    // abandoned signup.
    if ((error as { code?: string }).code === "email_not_confirmed") {
      redirect(`/verify-email?email=${encodeURIComponent(data.email)}`);
    }
    // SPEC §6.4: never reveal whether the email exists for any other failure.
    return { ok: false, error: "פרטי ההתחברות שגויים" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * SPEC §6.2 + §9.6.1: starts the Google OAuth flow.
 *
 * Calls supabase.auth.signInWithOAuth, which (a) writes a PKCE verifier
 * cookie via our SSR client's setAll callback, and (b) returns the Google
 * authorization URL. We redirect the browser to that URL; Google redirects
 * back to Supabase's /auth/v1/callback, which then redirects to our own
 * /auth/callback Route Handler (configured via NEXT_PUBLIC_SITE_URL +
 * /auth/callback in the redirectTo option here).
 *
 * Hardening Rule #2: SSR client only — never createAdminClient.
 */
export async function signInWithGoogleAction(): Promise<ActionResult> {
  console.error("[oauth-start] begin");

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  console.error("[oauth-start] signInWithOAuth returned", {
    hasUrl: !!data?.url,
    urlOrigin: data?.url ? new URL(data.url).origin : null,
    errorName: error?.name,
    errorMessage: error?.message,
  });

  const cookieStore = await cookies();
  const sbCookies = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-"));
  console.error("[oauth-start] post-signInWithOAuth cookie state", {
    sbCookieNames: sbCookies.map((c) => c.name),
    totalCookies: cookieStore.getAll().length,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  if (!data?.url) {
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  redirect(data.url);
}

/**
 * SPEC §6.2 step 5 + §9.6.1: completes the Google OAuth signup by collecting
 * the demographic fields Google doesn't provide (phone, gender, birth_date,
 * exam_date_planned, terms_accepted) and creating the profiles row.
 *
 * full_name is sourced from auth.users.user_metadata (Google's payload), not
 * collected on the form. Fallback chain: full_name → name → email-local-part →
 * "User". The RPC requires it as NOT NULL, so we always supply something.
 *
 * Hardening Rule #2: SSR client only. The complete_user_profile RPC is
 * SECURITY DEFINER and derives the profile id from (SELECT auth.uid()) — a
 * caller can't create a profile for someone else regardless of what they pass.
 *
 * Defense-in-depth merge guard: if a profile already exists for the current
 * user (typically because Supabase auto-merged this OAuth login into an
 * existing email-flow account per SPEC §6.2 step 4), skip submission and
 * redirect /dashboard. The RPC's ON CONFLICT DO NOTHING is the safety net,
 * but UX-wise we want the no-op to happen *before* the user thinks they
 * submitted successfully.
 *
 * Fail-recovery on RPC error mirrors verifyOtpAction: signOut + cookie sweep
 * so the user isn't stranded in a half-authenticated state.
 */
export async function completeGoogleOAuthSignup(
  input: OAuthCompletionInput
): Promise<ActionResult> {
  const parsed = oauthCompletionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  // Merge guard — see SPEC §6.2 step 4 (Supabase auto-merges by email).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    redirect("/dashboard");
  }

  // Source full_name from Google's user_metadata. Google typically populates
  // both full_name and name; we prefer full_name. Defensive fallbacks for the
  // unlikely case Google returns no name (e.g. older Google account, scope
  // misconfiguration). The RPC requires NOT NULL.
  const metaFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const metaName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;
  const fullName: string =
    metaFullName ||
    metaName ||
    (user.email ?? "").split("@")[0] ||
    "User";

  const profileResult = await createProfile({
    user_id: user.id,
    full_name: fullName,
    phone: data.phone,
    gender: data.gender,
    birth_date: data.birth_date,
    exam_date_planned: data.exam_date_planned,
    terms_accepted_at: new Date().toISOString(),
    signup_source: "google",
  });

  if (!profileResult.ok) {
    // Mirror verifyOtpAction's fail-recovery: don't strand the user in a
    // half-authenticated state with no profile. SignOut + cookie sweep so
    // they're back to /login and can retry (re-click Google, fresh attempt).
    await supabase.auth.signOut();
    await clearStaleAuthCookies();
    return profileResult;
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * SPEC §6.5: triggers password-reset OTP email.
 *
 * Always proceeds to the OTP-entry screen regardless of whether the email
 * exists — no email enumeration. Supabase's resetPasswordForEmail is fire-
 * and-forget; we ignore any error so the response is identical for known
 * and unknown emails.
 */
export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "כתובת מייל לא תקינה",
    };
  }
  const email = parsed.data.email;

  const supabase = await createClient();
  // Fire-and-forget: error is intentionally swallowed to prevent email
  // enumeration. Supabase enforces its own rate limit; if a real user hits
  // it, they silently won't receive an email and can retry later.
  await supabase.auth.resetPasswordForEmail(email);

  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

/**
 * SPEC §6.5 steps 4–6: verifies recovery OTP and sets a new password.
 *
 * verifyOtp({type:'recovery'}) establishes a short-lived recovery session
 * that authorizes updateUser({password}). After the password update we sign
 * the user out so they re-enter with the new password, matching SPEC §6.5
 * step 6: "מועבר להתחברות מחדש".
 */
export async function resetPasswordAction(input: {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  // Wipe any stale sb-* cookies before the recovery session writes new ones.
  await clearStaleAuthCookies();

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.token,
    type: "recovery",
  });
  if (verifyError) {
    return {
      ok: false,
      error: mapAuthError(verifyError, "הקוד פג תוקף או שגוי"),
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: data.password,
  });
  if (updateError) {
    return { ok: false, error: mapAuthError(updateError) };
  }

  // Sign out so the user re-authenticates with the new password.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reset=1");
}

/**
 * Signs the user out and redirects to /login. Wired now because Phase 4+
 * layouts will need it; SPEC §6.14.
 */
export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Belt-and-suspenders: ensure no sb-* cookie chunk survives the signOut.
  // The SDK's setAll callback should clear them, but a missed chunk could
  // re-authenticate the next request to a stale session.
  await clearStaleAuthCookies();
  revalidatePath("/", "layout");
  redirect("/login");
}
