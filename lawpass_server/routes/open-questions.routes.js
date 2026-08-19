"use strict";

// Writing task (מטלת כתיבה) — read-only routes behind the same gate as the
// rest of the study content: authenticated + active subscription, with RLS
// (open_questions_students_select) as the real boundary underneath.
//
// Reads are the question paper; the one write is the student filing an answer
// (POST /:id/answers). Grading is not here — `score` is written by whatever
// marks the submission, under the admin policy, not by this router.
//
// Route order matters: /subjects is declared before /:id, or Express would
// match "subjects" as an id and hand it to the lookup.

const { Router } = require("express");

const { authenticate } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/require-subscription");
const { validateBody } = require("../middleware/validate");
const { handwritingUpload } = require("../middleware/upload");
const { asyncHandler } = require("../middleware/async-handler");
const v = require("../validators/open-questions");
const c = require("../controllers/open-questions.controller");

const router = Router();

router.get(
  "/subjects",
  authenticate,
  requireSubscription,
  asyncHandler(c.getSubjects)
);

router.get(
  "/",
  authenticate,
  requireSubscription,
  asyncHandler(c.getQuestionsBySubject)
);

// Before /:id, same reason /subjects is: "answers" would otherwise be taken for
// a question id and handed to the lookup.
router.get(
  "/answers/:id",
  authenticate,
  requireSubscription,
  asyncHandler(c.getAnswer)
);

router.get(
  "/:id",
  authenticate,
  requireSubscription,
  asyncHandler(c.getQuestion)
);

// The "שלח את השאלה לבדיקה" button. Nested under the question so the id can
// never disagree with the answer's target — there is no question id in the body
// to get wrong.
router.post(
  "/:id/answers",
  authenticate,
  requireSubscription,
  validateBody(v.submitAnswerSchema, { fallback: "לא ניתן לשלוח את התשובה" }),
  asyncHandler(c.submitAnswer)
);

// "הוסף תשובה בכתב ידך" — up to two photographed A4 pages, uploaded to
// Cloudinary and handed back as links. No validateBody: the body is multipart
// files, not JSON, and the file checks (count, size, type) live in the upload
// middleware and the controller.
router.post(
  "/:id/handwriting",
  authenticate,
  requireSubscription,
  handwritingUpload,
  asyncHandler(c.uploadHandwriting)
);

module.exports = router;
