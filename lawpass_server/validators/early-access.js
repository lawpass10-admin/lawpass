"use strict";

// Ported from the SubmitSchema in app/(marketing)/early-access/_actions.ts.
// Length caps: email 254 (RFC 5321), source 60 (funnel labels are short
// tokens) — defensive against fat-payload abuse on this public endpoint.

const { z } = require("zod");

const submitWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().max(60).nullable().optional(),
});

module.exports = { submitWaitlistSchema };
