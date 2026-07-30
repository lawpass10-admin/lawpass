"use strict";

// Ported from ../../lib/validators/exam.ts. Every gameplay action carries
// a windowToken validated server-side against exam_sessions.active_window_token.

const { z } = require("zod");

const uuid = z.string().uuid();
const choiceLetter = z.enum(["א", "ב", "ג", "ד"]);
const examPosition = z.number().int().min(0).max(39);

const createExamSessionInput = z.object({
  mode: z.enum(["procedural", "substantive", "combined"]),
});

const sessionTokenBase = z.object({
  sessionId: uuid,
  windowToken: uuid,
});

const submitExamAttemptInput = sessionTokenBase.extend({
  position: examPosition,
  selectedLetter: choiceLetter,
});

const skipExamQuestionInput = sessionTokenBase.extend({
  position: examPosition,
});

const pauseExamInput = sessionTokenBase;
const resumeExamInput = sessionTokenBase;

const toggleExamBookmarkInput = sessionTokenBase.extend({
  position: examPosition,
});

const submitFinalExamInput = sessionTokenBase;
const abandonAndExitExamInput = sessionTokenBase;
const claimExamWindowInput = z.object({ sessionId: uuid });

module.exports = {
  createExamSessionInput,
  submitExamAttemptInput,
  skipExamQuestionInput,
  pauseExamInput,
  resumeExamInput,
  toggleExamBookmarkInput,
  submitFinalExamInput,
  abandonAndExitExamInput,
  claimExamWindowInput,
};
