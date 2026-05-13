/**
 * Slice 3 — Exam action validators.
 *
 * Phase 1 keeps `createExamSession`'s input shape empty (the sampler is
 * fully server-derived from the caller's auth + cluster config) but
 * exports the schema explicitly so future fields land here without
 * changing the action signature.
 *
 * Phase 3+ adds the remaining action schemas (`submitExamAttempt`,
 * `pauseExam`, `resumeExam`, `submitFinalExam`, `claimExamWindow`, etc.).
 */

import { z } from "zod";

export const createExamSessionInput = z.object({});
export type CreateExamSessionInput = z.infer<typeof createExamSessionInput>;
