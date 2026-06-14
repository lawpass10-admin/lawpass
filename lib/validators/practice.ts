import { z } from "zod";

// =============================================================================
// Practice session input schemas
// =============================================================================

/**
 * Valid choices for the "Source count" buttons (1/2/5/10/20/50). These are
 * the only values accepted server-side; the UI presents them as buttons and
 * disables individual buttons when DB availability falls below the chosen
 * count. The 1 + 2 entries enable short spot-review sessions and align
 * with the bookmark/mistake review-session pattern from Phase 4.
 *
 * Slice 23 dropped the strict enumeration check — see comment on
 * `sourceCountTarget` below.
 */

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
    // Slice 23 widened the picker to a free numeric input that derives
    // sourceCountTarget via Math.round(total / (1 + angles)). The
    // resulting integer is no longer restricted to the legacy
    // SOURCE_COUNT_CHOICES list, so we accept any integer in
    // [1, 200] (matching the input clamp in use-practice-builder).
    sourceCountTarget: z
      .number()
      .int()
      .min(1, { message: "מספר שאלות חייב להיות לפחות 1" })
      .max(200, { message: "מספר שאלות חייב להיות לכל היותר 200" }),
    anglesPerSource: z.number().int().min(0).max(4),
    /**
     * Slice 61 — exact item-count for the question_list. The hook
     * sends the user's literal picked total; the server samples
     * `sourceCountTarget = ceil(total / (1 + anglesPerSource))`
     * sources (oversampling to absorb sources with <full angle sets)
     * and trims the streamed question_list to exactly this many
     * items. Optional for backward compat with legacy callers
     * (createReviewSession variants insert with anglesPerSource=0,
     * and pre-Slice-61 tests don't pass it). When absent, the server
     * falls back to `sourceCountTarget × (1 + anglesPerSource)` —
     * the pre-Slice-61 sizing.
     *
     * Range matches MIN_TOTAL_QUESTIONS_REQUIRED (3) /
     * MAX_TOTAL_QUESTIONS_INPUT (200) in use-practice-builder.ts.
     */
    totalQuestions: z
      .number()
      .int()
      .min(3, { message: "מספר שאלות חייב להיות לפחות 3" })
      .max(200, { message: "מספר שאלות חייב להיות לכל היותר 200" })
      .optional(),
    timePerQuestionSeconds: z.number().int().min(60).max(300),
    // Slice 24 — per-session timer budget in seconds. 0 = "no timer"
    // (the off state in the builder); cap matches the DB CHECK
    // constraint at 14400s (4h).
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

/**
 * Slice 25 B-1 — note save/delete inputs.
 * Same identity model as toggleBookmark: the server resolves the
 * question at (sessionId, position) and derives the
 * (question_type, source_question_group_id, angle_position) triple.
 * Clients never send identity columns directly.
 *
 * `contentJson` is the canonical TipTap document; `contentHtml` is
 * the cached sanitized HTML. Both columns are NOT NULL on the DB,
 * so both are required here.
 *
 * `contentHtml` is capped at 200_000 chars as a defensive ceiling
 * against a malicious or accidental Mb-sized paste — well above any
 * realistic study note.
 */
export const saveNoteSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
  contentJson: z.unknown(),
  contentHtml: z.string().min(0).max(200_000),
});

export const deleteNoteSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type AdvanceToNextInput = z.infer<typeof advanceToNextSchema>;
export type ToggleBookmarkInput = z.infer<typeof toggleBookmarkSchema>;
export type ExitSessionInput = z.infer<typeof exitSessionSchema>;
export type SaveNoteInput = z.infer<typeof saveNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;

// =============================================================================
// Phase 4 — Bookmarks + Mistakes list actions
// =============================================================================

export const removeBookmarkSchema = z.object({
  bookmarkId: z.string().uuid({ message: "מזהה סימנייה לא תקין" }),
});

export const removeMistakeSchema = z.object({
  mistakeId: z.string().uuid({ message: "מזהה טעות לא תקין" }),
});

/**
 * createReviewSession input: exactly one of `sourceQuestionGroupId` or
 * `angleQuestionId` must be set, matching `questionType`. The cross-field
 * refinement enforces this — the server resolves the target via RLS.
 */
export const createReviewSessionSchema = z
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

export type RemoveBookmarkInput = z.infer<typeof removeBookmarkSchema>;
export type RemoveMistakeInput = z.infer<typeof removeMistakeSchema>;
export type CreateReviewSessionInput = z.infer<
  typeof createReviewSessionSchema
>;

/**
 * createBatchReviewSession input. `source` selects which list to draw
 * from; `chapterIdFilter` is optional — if present, only items whose
 * underlying source question belongs to that chapter are included.
 */
export const createBatchReviewSessionSchema = z.object({
  source: z.enum(["bookmarks", "mistakes"]),
  chapterIdFilter: z.string().uuid({ message: "פרק לא תקין" }).optional(),
});

export type CreateBatchReviewSessionInput = z.infer<
  typeof createBatchReviewSessionSchema
>;
