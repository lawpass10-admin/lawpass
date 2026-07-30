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
router.get("/kpi", authenticate, requireSubscription, asyncHandler(c.kpi));
router.get("/mastery", authenticate, requireSubscription, asyncHandler(c.mastery));
router.get("/status", authenticate, requireSubscription, asyncHandler(c.status));
router.get("/trend", authenticate, requireSubscription, asyncHandler(c.trend));
router.get("/hero", authenticate, requireSubscription, asyncHandler(c.hero));

module.exports = router;
