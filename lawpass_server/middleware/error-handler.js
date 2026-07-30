"use strict";

/** 404 for unmatched routes. */
function notFound(req, res) {
  res.status(404).json({ ok: false, error: "לא נמצא" });
}

/**
 * Terminal error handler. Any unhandled throw lands here. We log
 * server-side and return a generic Hebrew message — internals are never
 * leaked to the client. (4-arg signature is required by Express.)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const code = err && err.code ? err.code : "unknown";
  console.error(
    `[server] UNHANDLED ${req.method} ${req.originalUrl} code=${code} message=${
      err && err.message ? err.message : String(err)
    }`
  );
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "אירעה שגיאה. נסה שוב" });
}

module.exports = { notFound, errorHandler };
