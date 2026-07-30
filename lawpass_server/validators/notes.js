"use strict";

// Ported from the inline Zod in ../../app/(app)/notes/_actions.ts. The
// cross-field guard (source ⇒ angle_position null; angle ⇒ 1..5) is folded
// in as a .refine() so any validation failure yields the same fixed
// "טופס לא תקין" message the original returned.

const { z } = require("zod");

// source → angle_position MUST be null; angle → MUST be 1..5 (non-null).
const crossFieldGuard = (d) =>
  d.questionType === "source"
    ? d.anglePosition === null
    : d.anglePosition !== null;

const saveNoteFromBankSchema = z
  .object({
    questionType: z.enum(["source", "angle"]),
    sourceQuestionGroupId: z.string().uuid(),
    anglePosition: z.number().int().min(1).max(5).nullable(),
    contentJson: z.unknown(),
    contentHtml: z.string().min(0).max(200000),
  })
  .refine(crossFieldGuard);

const loadNoteByIdentitySchema = z
  .object({
    questionType: z.enum(["source", "angle"]),
    sourceQuestionGroupId: z.string().uuid(),
    anglePosition: z.number().int().min(1).max(5).nullable(),
  })
  .refine(crossFieldGuard);

module.exports = { saveNoteFromBankSchema, loadNoteByIdentitySchema };
