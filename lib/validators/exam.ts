/**
 * Slice 3 — Exam action validators (stubs).
 *
 * Phase 0 lands the file so importers can resolve the path. Phase 1+
 * fills in the real schemas as actions are written (`createExamSession`,
 * `submitExamAttempt`, `pauseExam`, `resumeExam`, `submitFinalExam`,
 * `claimExamWindow`, etc.).
 */

import { z } from "zod";

/**
 * `createExamSession` has no client-supplied parameters today — the
 * sampling is fully server-derived from the caller's auth and the
 * cluster config. The empty-object schema is kept so future fields
 * (e.g. mode flavour) can be added without changing the action's
 * signature.
 */
export const createExamSessionInput = z.object({});
export type CreateExamSessionInput = z.infer<typeof createExamSessionInput>;
