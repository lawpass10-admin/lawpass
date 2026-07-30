"use strict";

// Ported from app/(marketing)/early-access/_actions.ts (submitWaitlist).
//
// PUBLIC endpoint — no authenticate middleware. It uses the ANON client
// (publishable key), NEVER the service-role client on a public page
// (Hardening Rule #2). The waitlist_signups_anon_insert RLS policy
// authorizes the write.
//
// This controller validates INLINE (rather than via the validateBody
// middleware) so the response preserves the action's typed union exactly
// — { ok:false, error:"invalid_email" | "transient" } at HTTP 200 — which
// the frontend switches on. (validateBody would 400 with a Hebrew string.)

const { anonClient } = require("../config/supabase");
const { submitWaitlistSchema } = require("../validators/early-access");

async function submitWaitlist(req, res) {
  const parsed = submitWaitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json({ ok: false, error: "invalid_email" });
  }

  const supabase = anonClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: parsed.data.email,
    source: parsed.data.source ?? null,
  });

  // Duplicate email — silent success (PG 23505 = unique_violation). We do
  // NOT distinguish "already on the list" from "just joined": the UX is
  // the same thank-you state, and the silence keeps waitlist membership
  // opaque to unauthenticated callers.
  if (error && error.code === "23505") {
    return res.json({ ok: true });
  }

  // Any other DB error (transient, RLS misconfig, network) → retryable.
  // The underlying message is never leaked.
  if (error) {
    console.error(
      `[early-access] waitlist insert FAILED code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "transient" });
  }

  return res.json({ ok: true });
}

module.exports = { submitWaitlist };
