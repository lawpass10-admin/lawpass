"use strict";

// דין דיוני — the candidate's own sittings of a generated paper.
//
// Behind the same gate as the rest of the study content: authenticated + active
// subscription. RLS is NOT the boundary here the way it is elsewhere — the
// marking needs the answer key, which is admin-only, so these run under the
// service-role client and the scoping is the controller passing req.user.id.
// See db/diuni.js for why.
//
// The paper itself (the questions and the review) is still served by the Next.js
// side; only the sitting is filed here.

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/diuni");
const c = require("../controllers/diuni.controller");

const router = Router();

// "שלח את המבחן לבדיקה". Nested under the paper so the id can never disagree
// with what is being marked — there is no question id in the body to get wrong.
router.post(
  "/questions/:id/attempts",
  authenticate,
  requireSubscription,
  validateBody(v.submitAttemptSchema),
  asyncHandler(c.submitAttempt)
);

// The caller's own sittings, newest first. `?question_id=` narrows it to one
// paper, which is what an attempt-over-attempt comparison reads.
router.get(
  "/attempts",
  authenticate,
  requireSubscription,
  asyncHandler(c.listAttempts)
);

module.exports = router;
