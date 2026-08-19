"use strict";

const multer = require("multer");

const { HANDWRITING_MAX_BYTES } = require("../lib/cloudinary");

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

// Handwritten answer pages for a writing task. Up to two files on the field
// `pages` — one per A4 side, which is the answer limit the exam sets. Same
// memory storage as above: the bytes are forwarded to Cloudinary and never
// touch this disk.

const HANDWRITING_MAX_FILES = 2;

const handwritingMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: HANDWRITING_MAX_BYTES,
    files: HANDWRITING_MAX_FILES,
  },
});

/**
 * Parses up to two `pages` files into req.files.
 *
 * Multer's errors are translated here rather than left to the error handler,
 * because "your photo is too big" and "you attached three" are things a student
 * can act on — a 500 is not. Anything else becomes a generic 400: a multipart
 * parse failure is a malformed request, not a server fault.
 */
function handwritingUpload(req, res, next) {
  handwritingMulter.array("pages", HANDWRITING_MAX_FILES)(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          error: "אחת התמונות גדולה מדי (מקסימום 10MB לעמוד)",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({ ok: false, error: "אפשר לצרף עד שני עמודים" });
      }
      return res.status(400).json({ ok: false, error: "העלאת התמונות נכשלה" });
    }
    next();
  });
}

module.exports = {
  screenshotUpload,
  SCREENSHOT_MAX_BYTES,
  handwritingUpload,
  HANDWRITING_MAX_FILES,
};
