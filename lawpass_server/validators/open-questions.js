"use strict";

// Writing task (מטלת כתיבה) — submission validation.
//
// The question id is NOT here: it comes from the route path
// (POST /api/open-questions/:id/answers), so it is validated there rather than
// trusted from the body.

const { z } = require("zod");

// Two A4 pages of Hebrew is on the order of 6,000-8,000 characters. The cap is
// set well above that: it exists to stop a runaway paste from filling a jsonb
// column, not to enforce the exam's length limit — that limit is a marking
// criterion the grader applies, not something to silently truncate here.
const MAX_ANSWER_CHARS = 60000;

const submitAnswerSchema = z.object({
  text: z
    .string({ message: "תשובה לא תקינה" })
    .trim()
    .min(1, { message: "לא ניתן לשלוח תשובה ריקה" })
    .max(MAX_ANSWER_CHARS, { message: "התשובה ארוכה מדי" }),
});

module.exports = { submitAnswerSchema, MAX_ANSWER_CHARS };
