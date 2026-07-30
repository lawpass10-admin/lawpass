"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireTester } = require("../middleware/require-tester");
const { requireAdmin } = require("../middleware/require-admin");
const { screenshotUpload } = require("../middleware/upload");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/qa");
const c = require("../controllers/qa.controller");

const router = Router();

// Tester submit. `screenshotUpload` must run before validateBody so the
// multipart text fields are parsed into req.body. The submit action
// surfaced the specific Zod field message (with a generic fallback).
router.post(
  "/reports",
  authenticate,
  requireTester,
  screenshotUpload,
  validateBody(v.submitQaReportInput, { fallback: "טופס לא תקין" }),
  asyncHandler(c.submitReport)
);

// Admin triage — move a report between statuses.
router.post(
  "/status",
  authenticate,
  requireAdmin,
  validateBody(v.adminSetQaReportStatusInput, { fallback: "טופס לא תקין" }),
  asyncHandler(c.setStatus)
);

module.exports = router;
