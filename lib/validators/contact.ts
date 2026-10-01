import { z } from "zod";

/**
 * The צרו קשר / תמיכה contact form.
 *
 * All four fields are required — the first three because the brief says so, the
 * message because a contact form with no message is a wasted round trip for
 * both sides.
 *
 * The caps match the CHECK constraints on general_user_comments. They are
 * stated in both places on purpose: the schema stops a bad submission with a
 * readable message, the constraint stops anything that never went through this
 * schema. Keep them in step.
 */
export const contactSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "יש להזין שם מלא" })
    .max(120, { message: "השם ארוך מדי" }),

  email: z
    .string()
    .trim()
    .min(5, { message: "יש להזין כתובת דוא\"ל" })
    .max(254, { message: "הכתובת ארוכה מדי" })
    .email({ message: "כתובת הדוא\"ל אינה תקינה" }),

  // Deliberately permissive: Israeli numbers are written 050-123-4567,
  // 0501234567 and +972-50-123-4567, and a stricter pattern would reject a
  // real number from someone trying to reach support — which is the opposite
  // of what this form is for. Digits, spaces, dashes, brackets and a leading +.
  phone: z
    .string()
    .trim()
    .min(6, { message: "יש להזין מספר טלפון" })
    .max(32, { message: "המספר ארוך מדי" })
    .regex(/^[+()\-\s\d]+$/, { message: "מספר הטלפון אינו תקין" })
    .refine((value) => (value.match(/\d/g) ?? []).length >= 6, {
      message: "מספר הטלפון אינו תקין",
    }),

  comment: z
    .string()
    .trim()
    .min(2, { message: "יש להזין את תוכן הפנייה" })
    .max(4000, { message: "הפנייה ארוכה מדי" }),

  /**
   * The honeypot. Hidden from people, so anything in it came from something
   * filling every field it found.
   *
   * Optional and unvalidated BEYOND being a string: a bot that submits it is
   * not told that the field is why it failed, and a human who somehow focuses
   * it is not shown an error for a field they cannot see. The action decides
   * what to do; the schema only carries it.
   */
  website: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
