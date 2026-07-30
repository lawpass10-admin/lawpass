"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/auth");
const c = require("../controllers/auth.controller");

const router = Router();

// --- Public (no session required) ---
// The signup/OTP/reset actions surfaced the specific Zod field error, so
// validateBody uses the first-issue message with a domain fallback.

router.post(
  "/signup",
  validateBody(v.signupSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.signUp)
);

router.post(
  "/verify-otp",
  validateBody(v.otpSchema, { fallback: "קלט לא תקין" }),
  asyncHandler(c.verifyOtp)
);

router.post(
  "/resend-otp",
  validateBody(v.resendOtpSchema, { fallback: "כתובת מייל לא תקינה" }),
  asyncHandler(c.resendOtp)
);

// signIn returned a fixed generic error on any Zod failure (no enumeration).
router.post(
  "/signin",
  validateBody(v.loginSchema, { fixed: "פרטי ההתחברות שגויים" }),
  asyncHandler(c.signIn)
);

router.post(
  "/request-password-reset",
  validateBody(v.forgotPasswordSchema, { fallback: "כתובת מייל לא תקינה" }),
  asyncHandler(c.requestPasswordReset)
);

router.post(
  "/reset-password",
  validateBody(v.resetPasswordSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.resetPassword)
);

// --- Authenticated (Bearer token) ---

router.post(
  "/complete-google-signup",
  authenticate,
  validateBody(v.oauthCompletionSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.completeGoogleSignup)
);

router.post("/signout", authenticate, asyncHandler(c.signOut));

module.exports = router;
