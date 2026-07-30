"use client";

/**
 * Bookmarks domain — client wrapper (safe dual-path). Same signature +
 * return shape as the server action; components import THIS.
 *
 * When the Express API is disabled (no NEXT_PUBLIC_API_BASE_URL, e.g.
 * production) it defers to the original server action, so behaviour is
 * unchanged. When enabled it POSTs to /api/bookmarks/remove with the
 * Supabase Bearer token.
 */

import { apiEnabled, apiPostJson } from "@/lib/api/client";
import { removeBookmark as removeBookmarkAction } from "@/app/(app)/bookmarks/_actions";

type ActionResult = { ok: true } | { ok: false; error: string };

const FALLBACK_ERROR = "שגיאה — נסה שוב";

export async function removeBookmark(input: unknown): Promise<ActionResult> {
  if (!apiEnabled()) {
    return removeBookmarkAction(input);
  }
  try {
    const data = await apiPostJson("/api/bookmarks/remove", input, {
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
