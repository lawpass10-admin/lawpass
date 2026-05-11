import { z } from "zod";

// =============================================================================
// Practice session input schemas
// =============================================================================

/**
 * Valid choices for the "Source count" buttons (5/10/20/50). These are the
 * only values accepted server-side; the UI presents them as buttons and
 * disables individual buttons when DB availability falls below the chosen
 * count. Slice 2 plan §2 row 5.
 */
const SOURCE_COUNT_CHOICES = [5, 10, 20, 50] as const;

/**
 * Schema for createPracticeSession Server Action input. Validated twice —
 * once client-side before the action call (defense in depth), once
 * server-side inside the action. Cross-field constraint at the bottom
 * enforces "subtopic only when exactly one chapter is selected" per
 * prototype + Slice 2 plan §2 row 6.
 */
export const createPracticeSessionSchema = z
  .object({
    selectedChapterIds: z
      .array(z.string().uuid({ message: "פרק לא תקין" }))
      .min(1, { message: "יש לבחור לפחות פרק אחד" }),
    selectedSubtopicId: z.string().uuid({ message: "תת-נושא לא תקין" }).nullable(),
    sourceCountTarget: z
      .number()
      .int()
      .refine((n) => (SOURCE_COUNT_CHOICES as readonly number[]).includes(n), {
        message: "מספר שאלות חייב להיות 5, 10, 20 או 50",
      }),
    anglesPerSource: z.number().int().min(0).max(4),
    timePerQuestionSeconds: z.number().int().min(60).max(300),
  })
  .refine(
    (data) =>
      data.selectedSubtopicId === null || data.selectedChapterIds.length === 1,
    {
      message: "תת-נושא ניתן לבחור רק כשפרק יחיד נבחר",
      path: ["selectedSubtopicId"],
    }
  );

export type CreatePracticeSessionInput = z.infer<
  typeof createPracticeSessionSchema
>;

/**
 * Schema for the reactive availability query that powers the "כרגע יש N
 * שאלות זמינות" subtitle and the disabled-state of the count buttons.
 */
export const getAvailableQuestionCountSchema = z.object({
  chapterIds: z
    .array(z.string().uuid({ message: "פרק לא תקין" }))
    .min(1, { message: "יש לבחור לפחות פרק אחד" }),
  subtopicId: z.string().uuid({ message: "תת-נושא לא תקין" }).nullable(),
});

export type GetAvailableQuestionCountInput = z.infer<
  typeof getAvailableQuestionCountSchema
>;

// =============================================================================
// Phase 3 — PracticeQuestion + PracticeSummary
// =============================================================================

/**
 * Hebrew choice letters used across source_choices, angle_choices, and
 * attempts.selected_letter. Matches the DB CHECK constraint exactly.
 */
export const choiceLetterSchema = z.enum(["א", "ב", "ג", "ד"]);
export type ChoiceLetter = z.infer<typeof choiceLetterSchema>;

/**
 * submitAttempt Server Action input. `durationSeconds` is measured
 * client-side via performance.now() between question render and submit.
 * Server further clamps to 0–600 after parse — the Zod max here is the
 * outer bound for obviously invalid payloads.
 */
export const submitAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
  selectedLetter: choiceLetterSchema,
  durationSeconds: z.number().int().min(0).max(600),
});

/**
 * advanceToNext input. `fromPosition` is required so the server can
 * advance from the position the client believes it is on (rather than
 * trusting an absent position and reading questions_answered, which
 * would race with submitAttempt's counter update).
 */
export const advanceToNextSchema = z.object({
  sessionId: z.string().uuid(),
  fromPosition: z.number().int().min(0),
});

/**
 * toggleBookmark input. The action server-side reads the question at
 * (sessionId, position) to derive the target type + ids — never trust
 * the client to send `question_group_id` or `angle_question_id`.
 */
export const toggleBookmarkSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
});

export const exitSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type AdvanceToNextInput = z.infer<typeof advanceToNextSchema>;
export type ToggleBookmarkInput = z.infer<typeof toggleBookmarkSchema>;
export type ExitSessionInput = z.infer<typeof exitSessionSchema>;
