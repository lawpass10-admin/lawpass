"use strict";

// /api/drafts — the student's own scratch pages.
//
// `authenticate` only, with NO requireSubscription. Every other study surface
// is subscription-gated; this one is not, because a draft is the student's own
// writing and the save path already refuses to gate it. See the controller.

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/async-handler");
const c = require("../controllers/drafts.controller");

const router = Router();

router.get("/", authenticate, asyncHandler(c.listDrafts));

module.exports = router;
