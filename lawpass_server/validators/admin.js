"use strict";

// Ported from the inline Zod schemas in app/(app)/admin/_actions.ts and
// app/(app)/admin/chapters/[chapterId]/questions/[questionId]/_actions.ts.
// fullNameSchema is shared with the auth domain.

const { z } = require("zod");
const { fullNameSchema } = require("./auth");

const userIdSchema = z.string().uuid({ message: "מזהה משתמש לא תקין" });

// --- User management -------------------------------------------------------

const editProfileNameSchema = z.object({
  userId: userIdSchema,
  full_name: fullNameSchema,
});

const userTargetSchema = z.object({ userId: userIdSchema });

const setQaTesterSchema = z.object({
  userId: userIdSchema,
  isQaTester: z.boolean(),
});

// --- Question content editing ----------------------------------------------

/**
 * Text field cap. 10k is well above any realistic 360° body length; a
 * hard cap stops pathological pastes from blowing up the row size.
 */
const MAX_FIELD_CHARS = 10_000;

/** Array textarea cap — higher, since users newline-paste refs/concepts. */
const MAX_ARRAY_TEXTAREA_CHARS = 20_000;

const textField = z.string().max(MAX_FIELD_CHARS, { message: "השדה ארוך מדי" });

/**
 * Textarea-to-string-array transformer (slice-7 product decision): the
 * client posts the raw textarea string; the server splits on \n, trims,
 * and drops empty lines. The textarea content is the source of truth.
 */
const arrayTextareaField = z
  .string()
  .max(MAX_ARRAY_TEXTAREA_CHARS, { message: "הטקסט ארוך מדי" })
  .transform((s) =>
    s
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

const contentUuid = z.string().uuid({ message: "מזהה לא תקין" });

const editSourceContentSchema = z.object({
  sourceQuestionId: contentUuid,
  legal_topic_analysis: textField,
  full_explanation: textField,
  common_pitfall: textField,
  summary_for_memory: textField,
  quick_thinking_360: textField,
  notes_for_admin: textField.nullable().transform((v) => v ?? ""),
  concepts_and_skills: arrayTextareaField,
  references_list: arrayTextareaField,
});

const editAngleContentSchema = z.object({
  angleQuestionId: contentUuid,
  legal_topic_analysis: textField,
  full_explanation: textField,
  common_pitfall: textField,
  summary_for_memory: textField,
  quick_thinking_360: textField,
  concepts_and_skills: arrayTextareaField,
  references_list: arrayTextareaField,
});

/** Field whitelists — also drive the audit-log field diff. */
const SOURCE_EDITABLE_FIELDS = [
  "legal_topic_analysis",
  "full_explanation",
  "common_pitfall",
  "summary_for_memory",
  "quick_thinking_360",
  "notes_for_admin",
  "concepts_and_skills",
  "references_list",
];

const ANGLE_EDITABLE_FIELDS = [
  "legal_topic_analysis",
  "full_explanation",
  "common_pitfall",
  "summary_for_memory",
  "quick_thinking_360",
  "concepts_and_skills",
  "references_list",
];

module.exports = {
  editProfileNameSchema,
  userTargetSchema,
  setQaTesterSchema,
  editSourceContentSchema,
  editAngleContentSchema,
  SOURCE_EDITABLE_FIELDS,
  ANGLE_EDITABLE_FIELDS,
};
