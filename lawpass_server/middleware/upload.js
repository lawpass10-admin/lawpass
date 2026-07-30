"use strict";

const multer = require("multer");

// Screenshot upload for QA reports. The widget attaches an optional
// image; over the REST boundary it arrives as a multipart/form-data
// field named `screenshot`. We keep the file in memory (never on disk) —
// it's forwarded straight to Supabase Storage — and cap it at the same
// 5 MiB the bucket enforces.

const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB — matches bucket cap.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SCREENSHOT_MAX_BYTES },
});

/**
 * Parses a single optional `screenshot` file into req.file and the text
 * fields into req.body. Translates multer's size-limit error into the
 * same friendly Hebrew message the original action returned, so the
 * widget's UX is unchanged; any other multer failure becomes a generic
 * 400 rather than a 500.
 */
function screenshotUpload(req, res, next) {
  upload.single("screenshot")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ ok: false, error: "צילום המסך גדול מדי (מקסימום 5MB)" });
      }
      return res
        .status(400)
        .json({ ok: false, error: "העלאת צילום המסך נכשלה" });
    }
    next();
  });
}

module.exports = { screenshotUpload, SCREENSHOT_MAX_BYTES };
