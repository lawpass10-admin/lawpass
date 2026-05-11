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
