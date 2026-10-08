"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { asyncHandler } = require("../middleware/async-handler");
const c = require("../controllers/dashboard.controller");

const router = Router();

// All read-only, auth + subscription gated (mirrors the dashboard page's
// requireActiveSubscription gate; RLS is defense-in-depth). GET endpoints,
// one per dashboard surface — the header strip derives its status from
// mastery inside the /status handler.
// The four analytic surfaces in one response. Declared first because it is
// the one the dashboard actually calls; the four below are what it replaced
// and stay mounted as the way back if it ever needs backing out.
router.get("/overview", authenticate, requireSubscription, asyncHandler(c.overview));

router.get("/kpi", authenticate, requireSubscription, asyncHandler(c.kpi));
router.get("/mastery", authenticate, requireSubscription, asyncHandler(c.mastery));
router.get("/status", authenticate, requireSubscription, asyncHandler(c.status));
router.get("/trend", authenticate, requireSubscription, asyncHandler(c.trend));
router.get("/hero", authenticate, requireSubscription, asyncHandler(c.hero));
// The three subject squares: questions answered, average, lowest and highest
// score for דין מהותי, דין דיוני and מטלת כתיבה.
router.get(
  "/subject-stats",
  authenticate,
  requireSubscription,
  asyncHandler(c.subjectStats)
);

// Per-law distribution and average score, per subject — the pie and bar under
// each tab of the personal dashboard.
router.get(
  "/topic-stats",
  authenticate,
  requireSubscription,
  asyncHandler(c.topicStats)
);

module.exports = router;
