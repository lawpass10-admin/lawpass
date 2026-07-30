"use client";

/**
 * Early-access domain — client wrapper. Same signature + return union as
 * the old server action; components import THIS.
 *
 * EXPRESS-ONLY (pilot): the Next.js server action was removed, so this
 * always calls the Express API. Requires NEXT_PUBLIC_API_BASE_URL to be
 * set (local dev = http://localhost:4000, and in any deployed env before
 * this feature works). If it's unset the fetch fails → { ok:false,
 * error:"transient" }.
 */

import { apiPostJson } from "@/lib/api/client";

export type SubmitWaitlistResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "transient" };

export async function submitWaitlist(input: {
  email: string;
  source?: string | null;
}): Promise<SubmitWaitlistResult> {
  try {
    const data = await apiPostJson("/api/early-access/waitlist", input, {
      auth: false,
    });
    if (data.ok === true) return { ok: true };
    // The server echoes the same token union; anything unexpected → transient.
    return {
      ok: false,
      error: data.error === "invalid_email" ? "invalid_email" : "transient",
    };
  } catch {
    return { ok: false, error: "transient" };
  }
}
