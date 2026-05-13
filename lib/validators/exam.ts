/**
 * Slice 3 — Exam action validators.
 *
 * Every action validates a `windowToken` against `exam_sessions.active_window_token`
 * and almost every action carries a `clientElapsedSeconds` field that
 * the server clamps to non-negative and uses to bump `time_used_seconds`
 * server-authoritatively.
 *
 * The schema names use camelCase for the TS contract; the action body
 * destructures and passes through to the DB columns in snake_case.
 */

import { z } from "zod";

const uuid = z.string().uuid();

const choiceLetter = z.enum(["א", "ב", "ג", "ד"]);

const examPosition = z.number().int().min(0).max(39);

/**
 * Bounded elapsed-seconds tick. The server adds this to
 * `time_used_seconds` after Math.max(0, …) and a clamp against
 * `total_duration_seconds`. Cap at 600 s (10 minutes) per call —
 * generous tolerance for a paused tab waking up, but rejects
 * obvious garbage.
 */
const clientElapsedSeconds = z.number().int().min(0).max(600);

// =============================================================================
// createExamSession — Phase 1 (kept here for the canonical re-export)
// =============================================================================

export const createExamSessionInput = z.object({});
export type CreateExamSessionInput = z.infer<typeof createExamSessionInput>;

// =============================================================================
// Phase 3 — gameplay actions
// =============================================================================

/** Common base — every Phase 3 action needs at least the session +
 *  window-token pair so the server can validate before doing any work.
 *  Building it as a base object lets each action `.extend()` cleanly. */
const sessionTokenBase = z.object({
  sessionId: uuid,
  windowToken: uuid,
});

const sessionTokenTimedBase = sessionTokenBase.extend({
  clientElapsedSeconds,
});

export const submitExamAttemptInput = sessionTokenTimedBase.extend({
  position: examPosition,
  selectedLetter: choiceLetter,
});
export type SubmitExamAttemptInput = z.infer<typeof submitExamAttemptInput>;

export const skipExamQuestionInput = sessionTokenTimedBase.extend({
  position: examPosition,
});
export type SkipExamQuestionInput = z.infer<typeof skipExamQuestionInput>;

export const pauseExamInput = sessionTokenTimedBase;
export type PauseExamInput = z.infer<typeof pauseExamInput>;

export const resumeExamInput = sessionTokenBase;
export type ResumeExamInput = z.infer<typeof resumeExamInput>;

export const toggleExamBookmarkInput = sessionTokenBase.extend({
  position: examPosition,
});
export type ToggleExamBookmarkInput = z.infer<typeof toggleExamBookmarkInput>;

export const submitFinalExamInput = sessionTokenTimedBase;
export type SubmitFinalExamInput = z.infer<typeof submitFinalExamInput>;

export const abandonAndExitExamInput = sessionTokenTimedBase;
export type AbandonAndExitExamInput = z.infer<typeof abandonAndExitExamInput>;

export const claimExamWindowInput = z.object({ sessionId: uuid });
export type ClaimExamWindowInput = z.infer<typeof claimExamWindowInput>;
