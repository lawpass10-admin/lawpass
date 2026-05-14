/**
 * Slice 3 — Exam action validators.
 *
 * Every action validates a `windowToken` against
 * `exam_sessions.active_window_token`. Time math is fully
 * server-authoritative since Phase 5 — `clientElapsedSeconds` was
 * removed (the field was deprecated in hotfix v2 and superseded by
 * the Postgres-side elapsed computation in the SECURITY DEFINER RPCs
 * added in `20260516000001_exam_phase5_atomic_actions.sql`).
 */

import { z } from "zod";

const uuid = z.string().uuid();

const choiceLetter = z.enum(["א", "ב", "ג", "ד"]);

const examPosition = z.number().int().min(0).max(39);

// =============================================================================
// createExamSession — Phase 1 (kept here for the canonical re-export)
// =============================================================================

export const createExamSessionInput = z.object({});
export type CreateExamSessionInput = z.infer<typeof createExamSessionInput>;

// =============================================================================
// Phase 3 / Phase 5 — gameplay actions
// =============================================================================

/**
 * Common base — every gameplay action needs at least the session +
 * window-token pair so the server can validate before doing any work.
 */
const sessionTokenBase = z.object({
  sessionId: uuid,
  windowToken: uuid,
});

export const submitExamAttemptInput = sessionTokenBase.extend({
  position: examPosition,
  selectedLetter: choiceLetter,
});
export type SubmitExamAttemptInput = z.infer<typeof submitExamAttemptInput>;

export const skipExamQuestionInput = sessionTokenBase.extend({
  position: examPosition,
});
export type SkipExamQuestionInput = z.infer<typeof skipExamQuestionInput>;

export const pauseExamInput = sessionTokenBase;
export type PauseExamInput = z.infer<typeof pauseExamInput>;

export const resumeExamInput = sessionTokenBase;
export type ResumeExamInput = z.infer<typeof resumeExamInput>;

export const toggleExamBookmarkInput = sessionTokenBase.extend({
  position: examPosition,
});
export type ToggleExamBookmarkInput = z.infer<typeof toggleExamBookmarkInput>;

export const submitFinalExamInput = sessionTokenBase;
export type SubmitFinalExamInput = z.infer<typeof submitFinalExamInput>;

export const abandonAndExitExamInput = sessionTokenBase;
export type AbandonAndExitExamInput = z.infer<typeof abandonAndExitExamInput>;

export const claimExamWindowInput = z.object({ sessionId: uuid });
export type ClaimExamWindowInput = z.infer<typeof claimExamWindowInput>;
