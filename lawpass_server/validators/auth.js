"use strict";

// Ported from ../../lib/validators/auth.ts (type exports dropped). The
// userMetadataSchema (the signUp→verifyOtp contract) is also included.

const { z } = require("zod");
const {
  ACADEMIC_INSTITUTION_IDS,
  LEGAL_SPECIALIZATION_IDS,
} = require("../constants/profile");

// =============================================================================
// Field-level schemas
// =============================================================================

const passwordSchema = z
  .string()
  .min(8, { message: "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה ומספר" })
  .regex(/[a-z]/, { message: "הסיסמה חייבת להכיל אות קטנה באנגלית" })
  .regex(/[A-Z]/, { message: "הסיסמה חייבת להכיל אות גדולה באנגלית" })
  .regex(/\d/, { message: "הסיסמה חייבת להכיל מספר" });

const genderSchema = z.enum(
  ["male", "female", "other", "prefer_not_to_say"],
  { message: "יש לבחור מגדר" }
);

const eighteenYearsAgoISO = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "תאריך לידה לא תקין" })
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), {
    message: "תאריך לידה לא תקין",
  })
  .refine((s) => s <= eighteenYearsAgoISO(), {
    message: "שירות LawPass זמין רק לבני 18 ומעלה",
  });

const phoneSchema = z
  .string()
  .trim()
  .regex(/^05\d{8}$/, {
    message: "מספר טלפון לא תקין. נייד ישראלי בפורמט 0501234567",
  });

const examDatePlannedSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, { message: "תאריך לא תקין" })
  .nullish();

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "יש להזין כתובת מייל" })
  .email({ message: "כתובת מייל לא תקינה" });

const otpTokenSchema = z
  .string()
  .regex(/^\d{6}$/, { message: "יש להזין קוד בן 6 ספרות" });

const fullNameSchema = z
  .string()
  .trim()
  .min(2, { message: "יש להזין שם מלא" })
  .max(100, { message: "שם ארוך מדי" });

const academicInstitutionSchema = z.enum(ACADEMIC_INSTITUTION_IDS, {
  message: "יש לבחור מוסד אקדמי",
});

const legalSpecializationSchema = z.enum(LEGAL_SPECIALIZATION_IDS, {
  message: "יש לבחור תחום התמחות",
});

// =============================================================================
// Composite schemas
// =============================================================================

const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    full_name: fullNameSchema,
    phone: phoneSchema,
    gender: genderSchema,
    birth_date: birthDateSchema,
    academic_institution: academicInstitutionSchema,
    legal_specialization: legalSpecializationSchema,
    exam_date_planned: examDatePlannedSchema,
    terms_accepted: z.literal(true, {
      message: "יש לאשר את התקנון ומדיניות הפרטיות",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "יש להזין סיסמה" }),
});

const otpSchema = z.object({
  email: emailSchema,
  token: otpTokenSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z
  .object({
    email: emailSchema,
    token: otpTokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

const oauthCompletionSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  gender: genderSchema,
  birth_date: birthDateSchema,
  exam_date_planned: examDatePlannedSchema,
  academic_institution: academicInstitutionSchema,
  legal_specialization: legalSpecializationSchema,
  terms_accepted: z.literal(true, {
    message: "יש לאשר את התקנון ומדיניות הפרטיות",
  }),
});

const resendOtpSchema = z.object({ email: emailSchema });

/**
 * Contract for auth.user_metadata written by signup and read back on OTP
 * verification. A mismatch means metadata drift or tampering.
 */
const userMetadataSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  gender: genderSchema,
  birth_date: birthDateSchema,
  exam_date_planned: examDatePlannedSchema,
  academic_institution: academicInstitutionSchema,
  legal_specialization: legalSpecializationSchema,
  terms_accepted_at: z.string().min(1),
  intended_plan: z.enum(["plan_3m", "plan_6m"]).optional(),
});

/**
 * /account profile editor — full_name + exam_date_planned only. Composed
 * from the field-level schemas so any future tightening propagates. The
 * exam date stays .nullish() (from examDatePlannedSchema) to keep it
 * clearable from the UI.
 */
const editProfileSchema = z.object({
  full_name: fullNameSchema,
  exam_date_planned: examDatePlannedSchema,
});

module.exports = {
  signupSchema,
  loginSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthCompletionSchema,
  resendOtpSchema,
  userMetadataSchema,
  // Reused by the admin domain (admin edits a user's display name).
  fullNameSchema,
  // Reused by the account domain (user edits their own profile).
  editProfileSchema,
};
