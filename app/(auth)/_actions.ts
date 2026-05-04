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
  otpSchema,
  phoneSchema,
  resetPasswordSchema,
  signupSchema,
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
 * Inserts a row into profiles for the authenticated user.
 *
 * Hardening Rule #2: uses the SSR client (lib/supabase/server.ts) which
 * carries the user's auth cookies. The INSERT satisfies the RLS policy
 * "users_insert_own_profile" with WITH CHECK ((SELECT auth.uid()) = id).
 * Does NOT use createAdminClient.
 *
 * Idempotent: if the profile already exists (e.g. user calls verifyOtp twice,
 * or two requests race) the function returns ok without re-inserting.
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

  // Idempotency: skip insert if profile already exists.
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", input.user_id)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: "שגיאה בקריאת פרופיל. נסה שוב" };
  }
  if (existing) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: input.user_id,
    full_name: input.full_name,
    phone: input.phone,
    gender: input.gender,
    birth_date: input.birth_date,
    exam_date_planned: input.exam_date_planned,
    terms_accepted_at: input.terms_accepted_at,
    signup_source: input.signup_source,
    // is_admin defaults to FALSE; created_at / updated_at default to NOW().
  });

  if (insertError) {
    // Unique-violation race: another concurrent verifyOtpAction beat us to the
    // insert. Treat as success.
    if ((insertError as { code?: string }).code === "23505") {
      return { ok: true };
    }
    return {
      ok: false,
      error: "אירעה שגיאה ביצירת הפרופיל. נסה שוב או פנה לתמיכה",
    };
  }
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
  revalidatePath("/", "layout");
  redirect("/login");
}
