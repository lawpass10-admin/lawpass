"use strict";

// שאלון מותאם אישית — the pool a candidate can build from, and the build itself.

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { asyncHandler } = require("../middleware/async-handler");
const c = require("../controllers/custom-exam.controller");

const router = Router();

// How many questions exist per area, for one subject. Drives the form's caps.
router.get("/pool", authenticate, requireSubscription, asyncHandler(c.pool));

// Build one exam from a per-area request and return its id.
router.post("/", authenticate, requireSubscription, asyncHandler(c.build));

module.exports = router;
