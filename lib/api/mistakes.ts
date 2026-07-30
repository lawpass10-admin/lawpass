"use client";

/**
 * Mistakes domain — client wrapper (safe dual-path). Same signature +
 * return shape as the server action; components import THIS.
 *
 * Falls back to the original server action when the Express API is
 * disabled (production). When enabled it POSTs to /api/mistakes/remove
 * with the Supabase Bearer token.
 */

import { apiEnabled, apiPostJson } from "@/lib/api/client";
import { removeMistake as removeMistakeAction } from "@/app/(app)/mistakes/_actions";

type ActionResult = { ok: true } | { ok: false; error: string };

const FALLBACK_ERROR = "שגיאה — נסה שוב";

export async function removeMistake(input: unknown): Promise<ActionResult> {
  if (!apiEnabled()) {
    return removeMistakeAction(input);
  }
  try {
    const data = await apiPostJson("/api/mistakes/remove", input, {
      auth: true,
    });
    if (data.ok === true) return { ok: true };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : FALLBACK_ERROR,
    };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
