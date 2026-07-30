"use client";

/**
 * Exam domain — client wrappers (safe dual-path) for the gameplay
 * actions. Same signatures + return shapes as the server actions. Exam
 * results use error CODES (e.g. "invalid_input", "session_not_found")
 * that the components map to Hebrew, so the network-failure fallback uses
 * "invalid_input". Falls back to the action when the API is disabled.
 */

import { apiAction } from "@/lib/api/client";
import {
  createExamSession as createExamSessionAction,
  abandonActiveExamSession as abandonActiveExamSessionAction,
  submitExamAttempt as submitExamAttemptAction,
  skipExamQuestion as skipExamQuestionAction,
  pauseExam as pauseExamAction,
  resumeExam as resumeExamAction,
  toggleExamBookmark as toggleExamBookmarkAction,
  submitFinalExam as submitFinalExamAction,
  abandonAndExitExam as abandonAndExitExamAction,
  claimExamWindow as claimExamWindowAction,
} from "@/app/(app)/exam/_actions";

export const createExamSession = apiAction(
  "/api/exam/sessions",
  createExamSessionAction
);

export const abandonActiveExamSession = apiAction(
  "/api/exam/sessions/abandon",
  abandonActiveExamSessionAction
);

export const submitExamAttempt = apiAction(
  "/api/exam/attempts",
  submitExamAttemptAction
);

export const skipExamQuestion = apiAction(
  "/api/exam/skip",
  skipExamQuestionAction
);

export const pauseExam = apiAction("/api/exam/pause", pauseExamAction);

export const resumeExam = apiAction("/api/exam/resume", resumeExamAction);

export const toggleExamBookmark = apiAction(
  "/api/exam/bookmark/toggle",
  toggleExamBookmarkAction
);

export const submitFinalExam = apiAction(
  "/api/exam/submit-final",
  submitFinalExamAction
);

export const abandonAndExitExam = apiAction(
  "/api/exam/exit",
  abandonAndExitExamAction
);

export const claimExamWindow = apiAction(
  "/api/exam/claim-window",
  claimExamWindowAction
);
