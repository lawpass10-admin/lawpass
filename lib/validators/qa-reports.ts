/**
 * Slice 10 — QA Feedback System validators.
 *
 * The submit input mirrors the qa_reports schema. The action revalidates
 * server-side (defense in depth, same pattern as the auth + admin flows).
 *
 * Question-identity pairing (questionId ↔ questionType) is enforced at
 * both the validator level here AND the DB level via the named
 * `qa_reports_question_identity_paired_check` CONSTRAINT — the validator
 * version produces a friendly Hebrew message; the DB version is the
 * load-bearing invariant.
 */

import { z } from "zod";

/** Three report types — exactly matches the DB CHECK on report_type. */
export const reportTypeSchema = z.enum(["bug", "content", "design"], {
  message: "סוג דיווח לא תקין",
});
export type ReportType = z.infer<typeof reportTypeSchema>;

/** Question type allowlist — exactly matches the DB CHECK on question_type. */
export const questionTypeSchema = z.enum(["source", "angle"], {
  message: "סוג שאלה לא תקין",
});
export type QuestionType = z.infer<typeof questionTypeSchema>;

const uuid = z.string().uuid({ message: "מזהה לא תקין" });

const PROBLEM_MAX = 4000;
const EXPECTED_MAX = 4000;
const PAGE_PATH_MAX = 500;
const USER_AGENT_MAX = 500;
const VIEWPORT_MAX = 32;

/**
 * Submit-action input. The widget collects all of these client-side:
 *   - reportType / problemText / expectedText: typed by the user
 *   - pagePath: usePathname()
 *   - questionId / questionType: from QaContext (null on non-play pages)
 *   - userAgent: navigator.userAgent (optional — pass through if present)
 *   - viewport: `${innerWidth}x${innerHeight}` (optional)
 */
export const submitQaReportInput = z
  .object({
    reportType: reportTypeSchema,
    problemText: z
      .string()
      .trim()
      .min(1, { message: "יש לתאר מה לא עבד" })
      .max(PROBLEM_MAX, { message: "התיאור ארוך מדי" }),
    expectedText: z
      .string()
      .trim()
      .min(1, { message: "יש לתאר מה היה צריך לקרות" })
      .max(EXPECTED_MAX, { message: "התיאור ארוך מדי" }),
    pagePath: z
      .string()
      .trim()
      .min(1, { message: "נתיב הדף חסר" })
      .max(PAGE_PATH_MAX, { message: "נתיב דף ארוך מדי" }),
    questionId: uuid.nullable(),
    questionType: questionTypeSchema.nullable(),
    userAgent: z.string().trim().max(USER_AGENT_MAX).optional().nullable(),
    viewport: z.string().trim().max(VIEWPORT_MAX).optional().nullable(),
  })
  .refine(
    (v) => (v.questionId === null) === (v.questionType === null),
    {
      message: "מזהה שאלה וסוג שאלה חייבים להיות שניהם או אף אחד",
      path: ["questionId"],
    }
  );
export type SubmitQaReportInput = z.infer<typeof submitQaReportInput>;
