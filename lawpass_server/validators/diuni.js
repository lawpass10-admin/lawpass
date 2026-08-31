"use strict";

// דין דיוני — submission validation.
//
// The paper id is NOT here: it comes from the route path
// (POST /api/diuni/questions/:id/attempts), so it is validated there rather
// than trusted from the body.

const { z } = require("zod");

const LETTERS = ["א", "ב", "ג", "ד"];

// A generated paper is 40 questions. The cap is set well above that — it exists
// to stop a runaway body from reaching the database, not to enforce a paper
// length, which is the generator's business and not this endpoint's.
const MAX_QUESTIONS = 200;

/**
 * One answered question. `letter` is nullable because a paper may be submitted
 * with blanks: skipping is a real answer state, and turning it into an error
 * would mean a candidate who ran out of time could not file at all.
 *
 * `number` is what aligns the submission to the paper. Alignment by array
 * position would break the moment the generator reorders a paper, and the
 * marking would then be silently wrong rather than loudly missing.
 */
const givenAnswerSchema = z.object({
  number: z.coerce
    .number({ message: "מספר שאלה לא תקין" })
    .int({ message: "מספר שאלה לא תקין" })
    .min(1, { message: "מספר שאלה לא תקין" })
    .max(MAX_QUESTIONS, { message: "מספר שאלה לא תקין" }),
  letter: z
    .enum(LETTERS, { message: "תשובה לא תקינה" })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

const submitAttemptSchema = z.object({
  given: z
    .array(givenAnswerSchema)
    .min(1, { message: "לא נשלחו תשובות" })
    .max(MAX_QUESTIONS, { message: "נשלחו יותר תשובות משאלות" })
    // Two answers for the same question is not a submission the marker can
    // resolve, and picking one of them silently would decide it for the
    // candidate. Rejected instead.
    .refine(
      (given) => new Set(given.map((g) => g.number)).size === given.length,
      { message: "נשלחה יותר מתשובה אחת לאותה שאלה" }
    ),
});

module.exports = {
  submitAttemptSchema,
  LETTERS,
};
