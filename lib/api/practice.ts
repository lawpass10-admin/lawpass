"use client";

/**
 * Practice BUILDER domain — client wrappers (safe dual-path). Same
 * signatures + return shapes as the server actions (the `apiAction`
 * factory flows the types through), so the builder hook / components
 * import THESE unchanged. Falls back to the server action when the
 * Express API is disabled (production).
 */

import { apiAction } from "@/lib/api/client";
import {
  getAvailableQuestionCount as getAvailableQuestionCountAction,
  createPracticeSession as createPracticeSessionAction,
  abandonActiveSession as abandonActiveSessionAction,
  createReviewSession as createReviewSessionAction,
  createBatchReviewSession as createBatchReviewSessionAction,
} from "@/app/(app)/practice/_actions";

export const getAvailableQuestionCount = apiAction(
  "/api/practice/available-count",
  getAvailableQuestionCountAction,
  { fallbackError: "קלט לא תקין" }
);

export const createPracticeSession = apiAction(
  "/api/practice/sessions",
  createPracticeSessionAction,
  { fallbackError: "טופס לא תקין" }
);

export const abandonActiveSession = apiAction(
  "/api/practice/sessions/abandon",
  abandonActiveSessionAction,
  { fallbackError: "שגיאה — נסה שוב" }
);

export const createReviewSession = apiAction(
  "/api/practice/sessions/review",
  createReviewSessionAction,
  { fallbackError: "פרמטרים לא תקינים" }
);

export const createBatchReviewSession = apiAction(
  "/api/practice/sessions/batch-review",
  createBatchReviewSessionAction,
  { fallbackError: "פרמטרים לא תקינים" }
);
