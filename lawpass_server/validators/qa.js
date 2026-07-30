"use strict";

// Ported from lib/validators/qa-reports.ts (submit) and the
// adminSetQaReportStatusInput schema in app/(app)/admin/_actions.ts.
//
// Multipart adaptation: the widget's submit action received a plain
// object (explicit nulls). Over the REST boundary the report is sent as
// multipart/form-data (the screenshot rides alongside), so text fields
// arrive as strings and the optional identity fields are simply absent
// on non-play pages. Each nullable field is therefore wrapped in a
// `z.preprocess` that maps "" / undefined → null before the original
// rule runs; the rule itself is unchanged from the Next.js validator.

const { z } = require("zod");

/** Three report types — exactly matches the DB CHECK on report_type. */
const reportTypeSchema = z.enum(["bug", "content", "design"], {
  message: "סוג דיווח לא תקין",
});

/** Question type allowlist — exactly matches the DB CHECK on question_type. */
const questionTypeSchema = z.enum(["source", "angle"], {
  message: "סוג שאלה לא תקין",
});

const uuid = z.string().uuid({ message: "מזהה לא תקין" });

const PROBLEM_MAX = 4000;
const EXPECTED_MAX = 4000;
const PAGE_PATH_MAX = 500;
const USER_AGENT_MAX = 500;
const VIEWPORT_MAX = 32;

/** Multipart: "" and undefined both mean "field not provided" → null. */
const emptyToNull = (v) => (v === "" || v === undefined ? null : v);

const submitQaReportInput = z
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
    questionId: z.preprocess(emptyToNull, uuid.nullable()),
    questionType: z.preprocess(emptyToNull, questionTypeSchema.nullable()),
    userAgent: z.preprocess(
      emptyToNull,
      z.string().trim().max(USER_AGENT_MAX).nullable()
    ),
    viewport: z.preprocess(
      emptyToNull,
      z.string().trim().max(VIEWPORT_MAX).nullable()
    ),
  })
  .refine((v) => (v.questionId === null) === (v.questionType === null), {
    message: "מזהה שאלה וסוג שאלה חייבים להיות שניהם או אף אחד",
    path: ["questionId"],
  });

/** Admin triage — move a report between statuses. */
const adminSetQaReportStatusInput = z.object({
  reportId: z.string().uuid({ message: "מזהה דיווח לא תקין" }),
  status: z.enum(["open", "in_progress", "resolved"], {
    message: "סטטוס לא תקין",
  }),
});

module.exports = {
  reportTypeSchema,
  questionTypeSchema,
  submitQaReportInput,
  adminSetQaReportStatusInput,
};
