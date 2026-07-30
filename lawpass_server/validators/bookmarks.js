"use strict";

// Ported from removeBookmarkSchema in ../../lib/validators/practice.ts
// (kept with the bookmarks domain here for locality).

const { z } = require("zod");

const removeBookmarkSchema = z.object({
  bookmarkId: z.string().uuid({ message: "מזהה סימנייה לא תקין" }),
});

module.exports = { removeBookmarkSchema };
