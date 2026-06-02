"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Slice 43 — /early-access waitlist email-capture server action.
 *
 * Public-facing path, anon RLS-bound. Uses the cookie-backed SSR client from
 * `@/lib/supabase/server` which sends the publishable (anon) key — NEVER the
 * service-role key on a public page (Hardening Rule #2). The
 * `waitlist_signups_anon_insert` policy on `public.waitlist_signups` is what
 * authorizes this write.
 *
 * Idempotency: the table carries a UNIQUE INDEX on `lower(email)`. A duplicate
 * email surfaces here as Postgres error code `"23505"` (unique_violation). We
 * treat that as a silent success — returning a different shape for "already on
 * the list" would let a caller probe membership without auth.
 *
 * Zod first, DB second. Length caps on `email` (254 — RFC 5321 limit) and on
 * `source` (60 — funnel labels are short tokens) keep us defensive against
 * either field being weaponized as a fat-payload vector.
 */

const SubmitSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().max(60).nullable().optional(),
});

export type SubmitWaitlistResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "transient" };

export async function submitWaitlist(input: {
  email: string;
  source?: string | null;
}): Promise<SubmitWaitlistResult> {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_email" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: parsed.data.email,
    source: parsed.data.source ?? null,
  });

  // Duplicate email — silent success. PG 23505 is the unique_violation code;
  // PostgREST surfaces it on the error object's `code` field. We do NOT
  // distinguish "you're already on the list" from "you've just joined" — the
  // user UX is the same thank-you state in both cases, and the silence keeps
  // the waitlist's membership shape opaque to unauthenticated callers.
  if (error && (error as { code?: string }).code === "23505") {
    return { ok: true };
  }

  // Any other DB error (transient, RLS misconfiguration, network) → user-
  // facing retryable error. The action does NOT leak the underlying message.
  if (error) {
    return { ok: false, error: "transient" };
  }

  return { ok: true };
}
