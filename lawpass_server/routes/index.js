"use strict";

const { Router } = require("express");

const authRoutes = require("./auth.routes");
const practiceRoutes = require("./practice.routes");
const examRoutes = require("./exam.routes");
const notesRoutes = require("./notes.routes");
const bookmarksRoutes = require("./bookmarks.routes");
const mistakesRoutes = require("./mistakes.routes");
const qaRoutes = require("./qa.routes");
const adminRoutes = require("./admin.routes");
const accountRoutes = require("./account.routes");
const dashboardRoutes = require("./dashboard.routes");
const earlyAccessRoutes = require("./early-access.routes");
const openQuestionsRoutes = require("./open-questions.routes");
const mahotiRoutes = require("./mahoti.routes");

const router = Router();

// Domain routers mount here. All domains migrated: practice + auth + exam
// + notes + bookmarks + mistakes + qa + admin + account + dashboard +
// early-access.
router.use("/auth", authRoutes);
router.use("/practice", practiceRoutes);
router.use("/exam", examRoutes);
router.use("/notes", notesRoutes);
router.use("/bookmarks", bookmarksRoutes);
router.use("/mistakes", mistakesRoutes);
router.use("/qa", qaRoutes);
router.use("/admin", adminRoutes);
router.use("/account", accountRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/early-access", earlyAccessRoutes);
// Read-only; the writing task (מטלת כתיבה) picker and question page.
router.use("/open-questions", openQuestionsRoutes);
// דיון מהותי — filing and scoring a sitting. The paper itself is still served
// by the Next.js side.
router.use("/mahoti", mahotiRoutes);

module.exports = router;
