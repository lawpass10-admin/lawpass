"use strict";

const { Router } = require("express");

const { asyncHandler } = require("../middleware/async-handler");
const c = require("../controllers/early-access.controller");

const router = Router();

// PUBLIC — no authenticate / no subscription. Validation + the typed
// { ok, error } union are handled inside the controller.
router.post("/waitlist", asyncHandler(c.submitWaitlist));

module.exports = router;
