"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/practice");
const c = require("../controllers/practice.controller");

const router = Router();

// --- Builder / setup (subscription-gated) ---
// The builder actions surfaced the specific Zod field error, so
// validateBody uses the first-issue message (with a domain fallback).

router.post(
  "/available-count",
  authenticate,
  requireSubscription,
  validateBody(v.getAvailableQuestionCountSchema, { fallback: "קלט לא תקין" }),
  asyncHandler(c.getAvailableQuestionCount)
);

router.post(
  "/sessions",
  authenticate,
  requireSubscription,
  validateBody(v.createPracticeSessionSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.createPracticeSession)
);

router.post(
  "/sessions/abandon",
  authenticate,
  requireSubscription,
  asyncHandler(c.abandonActiveSession)
);

router.post(
  "/sessions/review",
  authenticate,
  requireSubscription,
  validateBody(v.createReviewSessionSchema, { fallback: "פרמטרים לא תקינים" }),
  asyncHandler(c.createReviewSession)
);

router.post(
  "/sessions/batch-review",
  authenticate,
  requireSubscription,
  validateBody(v.createBatchReviewSessionSchema, {
    fallback: "פרמטרים לא תקינים",
  }),
  asyncHandler(c.createBatchReviewSession)
);

// --- Play (auth only; RLS enforces subscription) ---
// The play actions returned a generic "טופס לא תקין" on any Zod failure —
// validateBody uses a fixed message to match.

router.post(
  "/attempts",
  authenticate,
  validateBody(v.submitAttemptSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.submitAttempt)
);

router.post(
  "/advance",
  authenticate,
  validateBody(v.advanceToNextSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.advanceToNext)
);

router.post(
  "/bookmark/toggle",
  authenticate,
  validateBody(v.toggleBookmarkSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.toggleBookmark)
);

router.post(
  "/sessions/exit",
  authenticate,
  validateBody(v.exitSessionSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.exitSession)
);

router.post(
  "/notes",
  authenticate,
  validateBody(v.saveNoteSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.saveNote)
);

router.delete(
  "/notes",
  authenticate,
  validateBody(v.deleteNoteSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.deleteNote)
);

module.exports = router;
