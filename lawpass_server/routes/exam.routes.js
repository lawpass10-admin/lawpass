"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/exam");
const c = require("../controllers/exam.controller");

const router = Router();

// Every exam action is subscription-gated. The actions returned the fixed
// code "invalid_input" on any Zod failure, so validateBody uses it.
const invalid = { fixed: "invalid_input" };
const guard = [authenticate, requireSubscription];

router.post(
  "/sessions",
  ...guard,
  validateBody(v.createExamSessionInput, invalid),
  asyncHandler(c.createExamSession)
);

router.post("/sessions/abandon", ...guard, asyncHandler(c.abandonActiveExamSession));

router.post(
  "/attempts",
  ...guard,
  validateBody(v.submitExamAttemptInput, invalid),
  asyncHandler(c.submitExamAttempt)
);

router.post(
  "/skip",
  ...guard,
  validateBody(v.skipExamQuestionInput, invalid),
  asyncHandler(c.skipExamQuestion)
);

router.post(
  "/pause",
  ...guard,
  validateBody(v.pauseExamInput, invalid),
  asyncHandler(c.pauseExam)
);

router.post(
  "/resume",
  ...guard,
  validateBody(v.resumeExamInput, invalid),
  asyncHandler(c.resumeExam)
);

router.post(
  "/bookmark/toggle",
  ...guard,
  validateBody(v.toggleExamBookmarkInput, invalid),
  asyncHandler(c.toggleExamBookmark)
);

router.post(
  "/submit-final",
  ...guard,
  validateBody(v.submitFinalExamInput, invalid),
  asyncHandler(c.submitFinalExam)
);

router.post(
  "/exit",
  ...guard,
  validateBody(v.abandonAndExitExamInput, invalid),
  asyncHandler(c.abandonAndExitExam)
);

router.post(
  "/claim-window",
  ...guard,
  validateBody(v.claimExamWindowInput, invalid),
  asyncHandler(c.claimExamWindow)
);

module.exports = router;
