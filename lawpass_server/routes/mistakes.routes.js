"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/mistakes");
const c = require("../controllers/mistakes.controller");

const router = Router();

router.post(
  "/remove",
  authenticate,
  requireSubscription,
  validateBody(v.removeMistakeSchema, { fallback: "פרמטרים לא תקינים" }),
  asyncHandler(c.removeMistake)
);

module.exports = router;
