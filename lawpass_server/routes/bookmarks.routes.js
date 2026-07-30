"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/bookmarks");
const c = require("../controllers/bookmarks.controller");

const router = Router();

// The action surfaced the specific Zod message, with a domain fallback.
router.post(
  "/remove",
  authenticate,
  requireSubscription,
  validateBody(v.removeBookmarkSchema, { fallback: "פרמטרים לא תקינים" }),
  asyncHandler(c.removeBookmark)
);

module.exports = router;
