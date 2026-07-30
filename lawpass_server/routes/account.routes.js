"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const { editProfileSchema } = require("../validators/auth");
const c = require("../controllers/account.controller");

const router = Router();

// Auth-only (RLS scopes the write to the caller's own profile). The
// action surfaced the specific Zod field message, with a generic fallback.
router.post(
  "/profile",
  authenticate,
  validateBody(editProfileSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.updateProfile)
);

module.exports = router;
