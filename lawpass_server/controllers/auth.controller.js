"use strict";

// Ported from ../../app/(auth)/_actions.ts. Adaptations for a stateless
// token API (vs the Next.js cookie/redirect model):
//   - Session-establishing actions RETURN the Supabase session tokens
//     ({access_token, refresh_token, ...}) in the JSON body. The frontend
//     stores them and sends the access_token as `Authorization: Bearer`.
//   - `redirect("/x")` becomes `{ ok:true, url:"/x" }` (client navigates).
//   - `revalidatePath` is dropped (Next cache hint; no equivalent).
//   - Cookie helpers (clearStaleAuthCookies, the resend-cooldown cookie)
//     are dropped — there are no server-held cookies. Supabase's own rate
//     limits remain the backstop for resend/reset.
//   - Google OAuth *initiation/callback* stays in Next.js (browser PKCE
//     handshake); only the post-OAuth profile completion is here.

const { anonClient } = require("../config/supabase");
const { isValidPlanId } = require("../constants/profile");
const { userMetadataSchema } = require("../validators/auth");

// =============================================================================
// Helpers
// =============================================================================

/**
 * Maps Supabase AuthError codes/messages to Hebrew strings. Login + reset
 * paths intentionally bypass this for failures (generic strings, no email
 * enumeration — SPEC §6.4/§6.5).
 */
function mapAuthError(error, fallback = "אירעה שגיאה. נסה שוב") {
  const code = error && error.code;
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
    default:
      break;
  }
  switch (error && error.message) {
    case "User already registered":
      return "כתובת המייל כבר רשומה במערכת";
    case "Invalid login credentials":
      return "פרטי ההתחברות שגויים";
    case "Token has expired or is invalid":
      return "הקוד פג תוקף או שגוי";
    default:
      return fallback;
  }
}

/** Whittles a Supabase session down to what the client needs to persist. */
function serializeSession(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user
      ? { id: session.user.id, email: session.user.email }
      : null,
  };
}

/**
 * Calls the complete_user_profile RPC (SECURITY DEFINER; derives the row
 * id from auth.uid()). `supabase` must be authenticated as the target
 * user. Idempotent (ON CONFLICT DO NOTHING).
 */
async function createProfile(supabase, input) {
  const { error } = await supabase.rpc("complete_user_profile", {
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_gender: input.gender,
    p_birth_date: input.birth_date,
    p_exam_date_planned: input.exam_date_planned,
    p_terms_accepted_at: input.terms_accepted_at,
    p_signup_source: input.signup_source,
    p_academic_institution: input.academic_institution,
    p_legal_specialization: input.legal_specialization,
  });

  if (error) {
    console.error(
      `[profile] rpc FAILED user=${input.user_id} code=${error.code ?? "unknown"} message=${error.message}`
    );
    return {
      ok: false,
      error: "אירעה שגיאה ביצירת הפרופיל. נסה שוב או פנה לתמיכה",
    };
  }

  console.info(
    `[profile] rpc OK user=${input.user_id} signup_source=${input.signup_source}`
  );
  return { ok: true };
}

async function hasActiveSubscription(supabase, userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

// =============================================================================
// Public endpoints (no auth)
// =============================================================================

/**
 * Sign up with email + password; triggers an OTP email. Email-confirm is
 * ON, so no session is established here (profile creation is deferred to
 * verify-otp). Returns the verify-email URL.
 */
async function signUp(req, res) {
  const data = req.valid;
  const intendedPlan = isValidPlanId(req.body?.intendedPlan)
    ? req.body.intendedPlan
    : undefined;

  const supabase = anonClient();
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.full_name,
        phone: data.phone,
        gender: data.gender,
        birth_date: data.birth_date,
        exam_date_planned: data.exam_date_planned,
        academic_institution: data.academic_institution,
        legal_specialization: data.legal_specialization,
        terms_accepted_at: new Date().toISOString(),
        ...(intendedPlan ? { intended_plan: intendedPlan } : {}),
      },
    },
  });

  if (error) {
    return res.json({ ok: false, error: mapAuthError(error) });
  }

  return res.json({
    ok: true,
    url: `/verify-email?email=${encodeURIComponent(data.email)}`,
  });
}

/**
 * Verifies the signup OTP, creates the profile, and establishes a
 * session. Returns the session tokens + the post-login URL.
 */
async function verifyOtp(req, res) {
  const data = req.valid;

  const supabase = anonClient();
  const { data: verifyData, error } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.token,
    type: "email",
  });

  if (error) {
    return res.json({ ok: false, error: mapAuthError(error, "הקוד פג תוקף או שגוי") });
  }

  const userId = verifyData.user?.id;
  const meta = verifyData.user?.user_metadata;
  if (!userId || !meta) {
    await supabase.auth.signOut();
    return res.json({ ok: false, error: "אירעה שגיאה. נסה שוב" });
  }

  const metaParsed = userMetadataSchema.safeParse(meta);
  if (!metaParsed.success) {
    await supabase.auth.signOut();
    return res.json({
      ok: false,
      error: "פרטי ההרשמה אינם זמינים. נסה להירשם מחדש",
    });
  }

  // `supabase` now holds the verified session in memory, so the RPC and
  // subscription query below run authenticated as this user (RLS applies).
  const profileResult = await createProfile(supabase, {
    user_id: userId,
    full_name: metaParsed.data.full_name,
    phone: metaParsed.data.phone,
    gender: metaParsed.data.gender,
    birth_date: metaParsed.data.birth_date,
    exam_date_planned: metaParsed.data.exam_date_planned ?? null,
    terms_accepted_at: metaParsed.data.terms_accepted_at,
    signup_source: "email",
    academic_institution: metaParsed.data.academic_institution,
    legal_specialization: metaParsed.data.legal_specialization,
  });
  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return res.json(profileResult);
  }

  const subscribed = await hasActiveSubscription(supabase, userId);
  const intendedPlan = metaParsed.data.intended_plan;
  const url = subscribed
    ? "/dashboard"
    : intendedPlan
      ? `/checkout?plan=${intendedPlan}`
      : "/pricing";

  return res.json({
    ok: true,
    url,
    session: serializeSession(verifyData.session),
  });
}

/**
 * Resends the signup OTP. The Next version enforced a 60s cooldown via an
 * HttpOnly cookie; in a stateless API that lives client-side, with
 * Supabase's own resend rate limit as the server backstop.
 */
async function resendOtp(req, res) {
  const { email } = req.valid;

  const supabase = anonClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return res.json({ ok: false, error: mapAuthError(error) });
  }
  return res.json({ ok: true });
}

/**
 * Sign in with email + password. Generic error on failure (no email
 * enumeration). Returns session tokens + /dashboard on success; routes an
 * unverified-but-valid credential pair to /verify-email (no session).
 */
async function signIn(req, res) {
  const data = req.valid;

  const supabase = anonClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return res.json({
        ok: true,
        url: `/verify-email?email=${encodeURIComponent(data.email)}`,
        session: null,
      });
    }
    return res.json({ ok: false, error: "פרטי ההתחברות שגויים" });
  }

  return res.json({
    ok: true,
    url: "/dashboard",
    session: serializeSession(signInData.session),
  });
}

/**
 * Fire-and-forget password-reset OTP. Always returns the reset-password
 * URL regardless of whether the email exists (no enumeration).
 */
async function requestPasswordReset(req, res) {
  const { email } = req.valid;

  const supabase = anonClient();
  await supabase.auth.resetPasswordForEmail(email);

  return res.json({
    ok: true,
    url: `/reset-password?email=${encodeURIComponent(email)}`,
  });
}

/**
 * Verifies the recovery OTP and sets a new password, then signs the
 * recovery session out so the user re-authenticates. Returns /login.
 */
async function resetPassword(req, res) {
  const data = req.valid;

  // One client instance for the whole flow: verifyOtp puts the recovery
  // session in memory, authorizing the subsequent updateUser.
  const supabase = anonClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.token,
    type: "recovery",
  });
  if (verifyError) {
    return res.json({
      ok: false,
      error: mapAuthError(verifyError, "הקוד פג תוקף או שגוי"),
    });
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: data.password,
  });
  if (updateError) {
    await supabase.auth.signOut();
    return res.json({ ok: false, error: mapAuthError(updateError) });
  }

  await supabase.auth.signOut();
  return res.json({ ok: true, url: "/login?reset=1" });
}

// =============================================================================
// Authenticated endpoints (Bearer token)
// =============================================================================

/**
 * Completes Google OAuth signup: collects the fields Google doesn't
 * provide and creates the profile. Requires an authenticated session
 * (authenticate middleware → req.user, req.supabase).
 */
async function completeGoogleSignup(req, res) {
  const data = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  // Merge guard — Supabase may auto-merge this OAuth login into an
  // existing email-flow account (SPEC §6.2 step 4).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return res.json({ ok: true, url: "/dashboard" });
  }

  const profileResult = await createProfile(supabase, {
    user_id: user.id,
    full_name: data.full_name,
    phone: data.phone,
    gender: data.gender,
    birth_date: data.birth_date,
    exam_date_planned: data.exam_date_planned ?? null,
    terms_accepted_at: new Date().toISOString(),
    signup_source: "google",
    academic_institution: data.academic_institution,
    legal_specialization: data.legal_specialization,
  });

  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return res.json(profileResult);
  }

  const subscribed = await hasActiveSubscription(supabase, user.id);
  return res.json({ ok: true, url: subscribed ? "/dashboard" : "/pricing" });
}

/** Signs the user out (revokes the session server-side). Returns /login. */
async function signOut(req, res) {
  await req.supabase.auth.signOut();
  return res.json({ ok: true, url: "/login" });
}

module.exports = {
  signUp,
  verifyOtp,
  resendOtp,
  signIn,
  requestPasswordReset,
  resetPassword,
  completeGoogleSignup,
  signOut,
};
