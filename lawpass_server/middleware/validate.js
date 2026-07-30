"use strict";

/**
 * Body validation via a Zod schema. On success sets `req.valid` to the
 * parsed data. On failure responds 400 with a Hebrew message.
 *
 * Message selection mirrors the original server actions:
 *   - opts.fixed    → always use this message (the play actions returned
 *                     a generic "טופס לא תקין" regardless of field).
 *   - else first Zod issue message (the builder actions surfaced the
 *                     specific field error).
 *   - else opts.fallback, else a generic default.
 */
function validateBody(schema, opts = {}) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message;
      const message =
        opts.fixed || firstIssue || opts.fallback || "קלט לא תקין";
      return res.status(400).json({ ok: false, error: message });
    }
    req.valid = parsed.data;
    next();
  };
}

module.exports = { validateBody };
