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

/**
 * One handwritten page, as it comes back from the upload endpoint.
 *
 * The browser uploads to Cloudinary first (through us) and then submits the
 * references with the answer, so these arrive as ordinary strings in a request
 * body and are checked like any other user input. The URL is checked for shape
 * here and for OWNERSHIP in the controller — a well-formed https URL pointing
 * at someone else's host passes this and fails there.
 */
const handWritingPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(2).optional(),
  url: z
    .string({ message: "קישור לא תקין" })
    .url({ message: "קישור לא תקין" })
    .max(1000, { message: "קישור לא תקין" }),
  public_id: z.string({ message: "מזהה תמונה לא תקין" }).min(1).max(400),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  bytes: z.number().int().nullable().optional(),
  format: z.string().max(20).nullable().optional(),
});

/**
 * An answer is typed text, photographed handwriting, or both — but not neither.
 *
 * `text` stopped being required when handwriting arrived: a student who answered
 * on paper has nothing to type, and demanding a token character would be asking
 * them to lie to the form. The refine below is what still refuses an empty
 * submission, and it carries the message the min(1) used to.
 */
const submitAnswerSchema = z
  .object({
    text: z
      .string({ message: "תשובה לא תקינה" })
      .trim()
      .max(MAX_ANSWER_CHARS, { message: "התשובה ארוכה מדי" })
      .optional()
      .default(""),
    hand_writing: z
      .array(handWritingPageSchema)
      .max(2, { message: "אפשר לצרף עד שני עמודים" })
      .optional(),
  })
  .refine((d) => d.text.length > 0 || (d.hand_writing?.length ?? 0) > 0, {
    message: "לא ניתן לשלוח תשובה ריקה",
    path: ["text"],
  });

module.exports = { submitAnswerSchema, handWritingPageSchema, MAX_ANSWER_CHARS };
