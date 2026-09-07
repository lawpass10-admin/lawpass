/**
 * Public surface of the email service.
 *
 * Import from `@/lib/email`, not from the files underneath — the split between
 * transport and layout is an implementation detail, and keeping call sites on
 * one entry point is what makes the eventual move to lawpass_server a
 * single-file change.
 *
 * Server-side only. `sendEmail` throws if it finds a `window`, but the real
 * defence is not importing this from a Client Component in the first place.
 *
 * Usage:
 *
 *     import { sendEmail, renderEmail } from "@/lib/email";
 *
 *     const result = await sendEmail({
 *       to: candidate.email,
 *       subject: "המבחן שלך נבדק",
 *       html: renderEmail({
 *         heading: "המבחן שלך נבדק",
 *         preheader: "הציון והפתרון המלא ממתינים לך",
 *         paragraphs: [`שלום ${candidate.firstName},`, "בדקנו את מטלת הכתיבה שהגשת."],
 *         cta: { label: "צפייה בפתרון", url: `${siteUrl}/writing-task/results/${answerId}` },
 *       }),
 *       tags: { type: "grading-complete" },
 *       idempotencyKey: `grading-complete:${answerId}`,
 *     });
 *
 *     if (!result.ok) console.error("[email]", result.error);
 *
 * Note the shape: `sendEmail` reports failure, it does not throw it. Marking
 * the paper is the job; telling the candidate about it is a side effect, and a
 * Resend outage must not undo the first.
 */

// Relative within the module — see the note in templates/reengagement.ts.
export {
  sendEmail,
  isEmailConfigured,
  readEmailConfig,
  htmlToText,
  type SendEmailInput,
  type SendEmailResult,
  type EmailConfig,
} from "./client";

export { renderEmail, escapeHtml, type EmailContent } from "./layout";
