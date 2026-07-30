"use strict";

// Ported from app/(app)/qa/_actions.ts (submitQaReport) and the QA
// portion of app/(app)/admin/_actions.ts (adminSetQaReportStatusAction).
//
// The tester gate now lives in the requireTester middleware and the
// screenshot multipart parse in the upload middleware, so the controller
// keeps only the report-specific logic: screenshot content validation,
// INSERT, upload, and the screenshot_path patch. `revalidatePath` /
// router navigation were dropped (no server-side equivalent).
//
// submitReport MUST NOT touch exam/practice state — the widget renders
// during an active exam and this endpoint stays scoped to qa_reports +
// the qa-screenshots bucket so the timer / window-token / auto-submit
// are never disturbed.

const { adminClient } = require("../config/supabase");
const {
  createQaReport,
  updateQaReportScreenshotPath,
  getQaReportStatusOwner,
  updateQaReportStatus,
} = require("../db/qa");
const { logAdminAction } = require("../db/admin");

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB — matches bucket cap.

function mimeToExt(mime) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * POST /api/qa/reports — tester submits a QA report (auth + tester gate
 * applied upstream). The optional screenshot is in req.file (multer
 * memory storage); text fields validated into req.valid.
 */
async function submitReport(req, res) {
  const data = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  // Screenshot content pre-check (multer already capped the size; here we
  // guard the MIME type and derive the extension, matching the original
  // fail-fast messages). An empty file handle is treated as "no file".
  let file = req.file || null;
  let ext = null;
  if (file) {
    if (!file.size || file.size <= 0) {
      file = null;
    } else if (file.size > SCREENSHOT_MAX_BYTES) {
      return res
        .status(400)
        .json({ ok: false, error: "צילום המסך גדול מדי (מקסימום 5MB)" });
    } else if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return res.status(400).json({
        ok: false,
        error: "סוג צילום מסך לא נתמך (PNG, JPEG או WebP בלבד)",
      });
    } else {
      ext = mimeToExt(file.mimetype);
      if (!ext) {
        return res
          .status(400)
          .json({ ok: false, error: "סוג צילום מסך לא נתמך" });
      }
    }
  }

  // INSERT the report first (single source of the id).
  const insertResult = await createQaReport(supabase, {
    user_id: user.id,
    report_type: data.reportType,
    page_path: data.pagePath,
    question_id: data.questionId,
    question_type: data.questionType,
    problem_text: data.problemText,
    expected_text: data.expectedText,
    user_agent: data.userAgent,
    viewport: data.viewport,
  });
  if (!insertResult.ok) {
    console.error(
      `[qa] insert failed user=${user.id} code=${insertResult.code || "unknown"} msg=${insertResult.error}`
    );
    return res.json({ ok: false, error: "שמירת הדיווח נכשלה. נסה שוב" });
  }
  const reportId = insertResult.id;

  // Optional screenshot upload + path patch. If either step fails the row
  // is already saved, so we log and still return success — the admin can
  // reconcile the missing file rather than lose the report.
  if (file && ext) {
    const storagePath = `${user.id}/${reportId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("qa-screenshots")
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (uploadErr) {
      console.error(
        `[qa] screenshot upload failed user=${user.id} report=${reportId} msg=${uploadErr.message}`
      );
      return res.json({ ok: true, reportId });
    }

    const patchResult = await updateQaReportScreenshotPath(
      adminClient(),
      reportId,
      storagePath
    );
    if (!patchResult.ok) {
      console.error(
        `[qa] screenshot_path UPDATE failed user=${user.id} report=${reportId} msg=${patchResult.error}`
      );
      // Row + file both exist, only the FK is missing — let the admin
      // reconcile; the report itself is preserved.
    }
  }

  console.info(
    `[qa] report created user=${user.id} report=${reportId} type=${data.reportType} path=${data.pagePath}`
  );
  return res.json({ ok: true, reportId });
}

/**
 * POST /api/qa/status — admin moves a report between statuses (admin gate
 * applied upstream). Writes one admin_actions_log row carrying the
 * from → to transition. `revalidatePath("/admin", "layout")` was dropped.
 */
async function setStatus(req, res) {
  const { reportId, status } = req.valid;
  const supabase = req.supabase;
  const admin = req.user;

  // Prior row: previous status for the audit story + owner id for the
  // audit row's target_user_id.
  const prior = await getQaReportStatusOwner(supabase, reportId);
  if (!prior) {
    return res.json({ ok: false, error: "הדיווח לא נמצא" });
  }

  const result = await updateQaReportStatus(supabase, reportId, status);
  if (!result.ok) {
    console.error(
      `[admin] qa set_status FAILED admin=${admin.id} report=${reportId} code=${result.code || "unknown"} msg=${result.error}`
    );
    return res.json({ ok: false, error: "עדכון הסטטוס נכשל. נסה שוב" });
  }

  await logAdminAction(supabase, {
    adminId: admin.id,
    actionType: "qa.set_status",
    targetUserId: prior.user_id,
    details: { report_id: reportId, from: prior.status, to: status },
  });

  console.info(
    `[qa] set_status OK admin=${admin.id} report=${reportId} ${prior.status}→${status}`
  );
  return res.json({ ok: true });
}

module.exports = { submitReport, setStatus };
