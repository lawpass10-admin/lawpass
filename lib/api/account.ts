"use client";

/**
 * Account domain — client wrapper. Same signature + return shape as the
 * old server action; components import THIS.
 *
 * EXPRESS-ONLY (pilot): the Next.js server action was removed, so this
 * always calls the Express API with the Supabase Bearer token. Requires
 * NEXT_PUBLIC_API_BASE_URL to be set; if unset the fetch fails →
 * { ok:false, error:<generic> }.
 */

import { apiPostJson } from "@/lib/api/client";
import type { EditProfileInput } from "@/lib/validators/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "אירעה שגיאה בשמירת השינויים. נסה שוב";

export async function updateProfileAction(
  input: EditProfileInput
): Promise<ActionResult> {
  try {
    const data = await apiPostJson("/api/account/profile", input, {
      auth: true,
    });
    if (data.ok === true) return { ok: true };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : GENERIC_ERROR,
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
