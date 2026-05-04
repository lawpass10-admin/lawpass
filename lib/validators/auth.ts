import { z } from "zod";

// =============================================================================
// Field-level schemas
// =============================================================================

/**
 * Password complexity per SPEC §6.1:
 * min 8 chars, must contain at least one lowercase, one uppercase, one digit.
 * The Hebrew error string mirrors the SPEC §6.1 Edge Cases example.
 */
export const passwordSchema = z
  .string()
  .min(8, { message: "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה ומספר" })
  .regex(/[a-z]/, { message: "הסיסמה חייבת להכיל אות קטנה באנגלית" })
  .regex(/[A-Z]/, { message: "הסיסמה חייבת להכיל אות גדולה באנגלית" })
  .regex(/\d/, { message: "הסיסמה חייבת להכיל מספר" });

/**
 * Gender — must match the DB CHECK constraint on profiles.gender exactly
 * (SPEC §8.2.2).
 */
export const genderSchema = z.enum(
  ["male", "female", "other", "prefer_not_to_say"],
  { message: "יש לבחור מגדר" }
);

/**
 * Returns today − 18 years as a YYYY-MM-DD string (UTC-anchored).
 * Lexicographic comparison works for ISO dates, so we avoid Date math at
 * comparison time.
 */
const eighteenYearsAgoISO = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

/**
 * Birth date — string of form YYYY-MM-DD, must be a real calendar date,
 * and must be ≥ 18 years before today (matches DB CHECK in SPEC §8.2.2).
 * Rejection message mirrors SPEC §6.1 Edge Cases.
 */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "תאריך לידה לא תקין" })
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), {
    message: "תאריך לידה לא תקין",
  })
  .refine((s) => s <= eighteenYearsAgoISO(), {
    message: "שירות LawPass זמין רק לבני 18 ומעלה",
  });

/**
 * Phone — lenient pattern (digits, dashes, spaces, parens, optional +).
 * SPEC §8.2.2 stores it as TEXT (no format constraint at DB level).
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(9, { message: "מספר טלפון לא תקין" })
  .max(20, { message: "מספר טלפון לא תקין" })
  .regex(/^[\d\s+\-()]+$/, { message: "מספר טלפון לא תקין" });

/**
 * Exam date planned — optional, stored as YYYY-MM-01 (first of month) in DB
 * because the prototype UI captures month + year only. The form layer is
 * responsible for converting (month, year) → "YYYY-MM-01" before submitting,
 * or sending null when no date is picked.
 */
export const examDatePlannedSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, { message: "תאריך לא תקין" })
  .nullable();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "יש להזין כתובת מייל" })
  .email({ message: "כתובת מייל לא תקינה" });

/** OTP — exactly 6 digits, per SPEC §6.3 / §6.5. */
export const otpTokenSchema = z
  .string()
  .regex(/^\d{6}$/, { message: "יש להזין קוד בן 6 ספרות" });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { message: "יש להזין שם מלא" })
  .max(100, { message: "שם ארוך מדי" });

// =============================================================================
// Composite schemas
// =============================================================================

/**
 * Full signup payload — validated client-side before submit and again
 * server-side in signUpAction (defense in depth, SPEC §9.5 layer 3).
 */
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    full_name: fullNameSchema,
    phone: phoneSchema,
    gender: genderSchema,
    birth_date: birthDateSchema,
    exam_date_planned: examDatePlannedSchema,
    terms_accepted: z.literal(true, {
      message: "יש לאשר את התקנון ומדיניות הפרטיות",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Per-step schemas for the 3-step wizard. The form validates the relevant
 * subset before allowing the user to advance to the next step.
 */
export const signupStep1Schema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export const signupStep2Schema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  gender: genderSchema,
  birth_date: birthDateSchema,
});

export const signupStep3Schema = z.object({
  exam_date_planned: examDatePlannedSchema,
  terms_accepted: z.literal(true, {
    message: "יש לאשר את התקנון ומדיניות הפרטיות",
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "יש להזין סיסמה" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  email: emailSchema,
  token: otpTokenSchema,
});
export type OtpInput = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
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
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
