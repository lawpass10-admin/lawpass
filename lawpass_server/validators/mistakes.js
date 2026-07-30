"use strict";

// Ported from removeMistakeSchema in ../../lib/validators/practice.ts
// (kept with the mistakes domain here for locality).

const { z } = require("zod");

const removeMistakeSchema = z.object({
  mistakeId: z.string().uuid({ message: "מזהה טעות לא תקין" }),
});

module.exports = { removeMistakeSchema };
