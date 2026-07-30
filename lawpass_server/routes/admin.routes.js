"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/require-admin");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/admin");
const c = require("../controllers/admin.controller");

const router = Router();

// Every admin endpoint: authenticate → requireAdmin → validate. The
// profile-name / qa-tester / content actions surfaced the specific Zod
// field message; the user-target actions returned a fixed message.

router.post(
  "/profile/name",
  authenticate,
  requireAdmin,
  validateBody(v.editProfileNameSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.editProfileName)
);

router.post(
  "/password-reset",
  authenticate,
  requireAdmin,
  validateBody(v.userTargetSchema, { fixed: "מזהה משתמש לא תקין" }),
  asyncHandler(c.sendPasswordReset)
);

router.post(
  "/force-signout",
  authenticate,
  requireAdmin,
  validateBody(v.userTargetSchema, { fixed: "מזהה משתמש לא תקין" }),
  asyncHandler(c.forceSignOut)
);

router.post(
  "/qa-tester",
  authenticate,
  requireAdmin,
  validateBody(v.setQaTesterSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.setQaTester)
);

router.post(
  "/content/source",
  authenticate,
  requireAdmin,
  validateBody(v.editSourceContentSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.editSourceContent)
);

router.post(
  "/content/angle",
  authenticate,
  requireAdmin,
  validateBody(v.editAngleContentSchema, { fallback: "טופס לא תקין" }),
  asyncHandler(c.editAngleContent)
);

module.exports = router;
