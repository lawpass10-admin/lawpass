"use strict";

// Ported verbatim from ../../lib/validators/practice.ts (TypeScript type
// exports dropped — Zod schemas are the runtime contract).

const { z } = require("zod");

// Hebrew choice letters — matches the DB CHECK constraint exactly.
const choiceLetterSchema = z.enum(["א", "ב", "ג", "ד"]);

/**
 * createPracticeSession input. Cross-field refine enforces "subtopic only
 * when exactly one chapter is selected".
 */
const createPracticeSessionSchema = z
  .object({
    selectedChapterIds: z
      .array(z.string().uuid({ message: "פרק לא תקין" }))
      .min(1, { message: "יש לבחור לפחות פרק אחד" }),
    selectedSubtopicId: z
      .string()
      .uuid({ message: "תת-נושא לא תקין" })
      .nullable(),
    sourceCountTarget: z
      .number()
      .int()
      .min(1, { message: "מספר שאלות חייב להיות לפחות 1" })
      .max(200, { message: "מספר שאלות חייב להיות לכל היותר 200" }),
    anglesPerSource: z.number().int().min(0).max(4),
    totalQuestions: z
      .number()
      .int()
      .min(3, { message: "מספר שאלות חייב להיות לפחות 3" })
      .max(200, { message: "מספר שאלות חייב להיות לכל היותר 200" })
      .optional(),
    timePerQuestionSeconds: z.number().int().min(60).max(300),
    sessionDurationSeconds: z
      .number()
      .int()
      .min(0, { message: "זמן לסשן חייב להיות 0 או יותר" })
      .max(14400, { message: "זמן לסשן חייב להיות עד 4 שעות" }),
  })
  .refine(
    (data) =>
      data.selectedSubtopicId === null || data.selectedChapterIds.length === 1,
    {
      message: "תת-נושא ניתן לבחור רק כשפרק יחיד נבחר",
      path: ["selectedSubtopicId"],
    }
  );

/** Reactive availability query for the builder subtitle + count buttons. */
const getAvailableQuestionCountSchema = z.object({
  chapterIds: z
    .array(z.string().uuid({ message: "פרק לא תקין" }))
    .min(1, { message: "יש לבחור לפחות פרק אחד" }),
  subtopicId: z.string().uuid({ message: "תת-נושא לא תקין" }).nullable(),
});

/** submitAttempt input. Server re-clamps durationSeconds to 0–600. */
const submitAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
  selectedLetter: choiceLetterSchema,
  durationSeconds: z.number().int().min(0).max(600),
});

const advanceToNextSchema = z.object({
  sessionId: z.string().uuid(),
  fromPosition: z.number().int().min(0),
});

const toggleBookmarkSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
});

const exitSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

const saveNoteSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
  contentJson: z.unknown(),
  contentHtml: z.string().min(0).max(200000),
});

const deleteNoteSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
});

/** createReviewSession: exactly one target id must match questionType. */
const createReviewSessionSchema = z
  .object({
    questionType: z.enum(["source", "angle"]),
    sourceQuestionGroupId: z.string().uuid().optional(),
    angleQuestionId: z.string().uuid().optional(),
  })
  .refine(
    (data) =>
      data.questionType === "source"
        ? !!data.sourceQuestionGroupId && !data.angleQuestionId
        : !!data.angleQuestionId && !data.sourceQuestionGroupId,
    { message: "פרמטרים לא תואמים לסוג השאלה" }
  );

const createBatchReviewSessionSchema = z.object({
  source: z.enum(["bookmarks", "mistakes"]),
  chapterIdFilter: z.string().uuid({ message: "פרק לא תקין" }).optional(),
});

module.exports = {
  choiceLetterSchema,
  createPracticeSessionSchema,
  getAvailableQuestionCountSchema,
  submitAttemptSchema,
  advanceToNextSchema,
  toggleBookmarkSchema,
  exitSessionSchema,
  saveNoteSchema,
  deleteNoteSchema,
  createReviewSessionSchema,
  createBatchReviewSessionSchema,
};
