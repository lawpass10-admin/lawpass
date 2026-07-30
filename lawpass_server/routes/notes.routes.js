"use strict";

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/notes");
const c = require("../controllers/notes.controller");

const router = Router();

// Notes-bank actions — auth only (RLS enforces subscription). Any
// validation failure returns the fixed "טופס לא תקין" the actions used.

router.post(
  "/save",
  authenticate,
  validateBody(v.saveNoteFromBankSchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.saveNoteFromBank)
);

router.post(
  "/load",
  authenticate,
  validateBody(v.loadNoteByIdentitySchema, { fixed: "טופס לא תקין" }),
  asyncHandler(c.loadNoteByIdentity)
);

module.exports = router;
