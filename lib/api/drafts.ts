"use client";

/**
 * Drafts domain — client wrapper over GET /api/drafts.
 *
 * NO SERVER-ACTION FALLBACK, unlike the other wrappers here, because there is
 * no action to fall back TO: reading drafts never existed on the Next.js side.
 * Drafts were write-only until this page — the scratch-pad dialog could file
 * one and nothing could show it again. So when the API is disabled this says
 * so plainly rather than pretending the list is empty, which would read to a
 * student as "my notes are gone".
 */

import { apiEnabled, apiGetJson } from "@/lib/api/client";

/** One saved scratch page, as the list renders it. */
export type DraftSummary = {
  draft_id: string;
  /** First sentence of the draft. Computed server-side — see lib/draft-title.js. */
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type DraftsResult =
  | { ok: true; drafts: DraftSummary[] }
  | { ok: false; error: string };

const FALLBACK_ERROR = "לא ניתן לטעון את הטיוטות — נסו שוב";
const DISABLED_ERROR = "שירות הטיוטות אינו זמין כרגע";

export async function listMyDrafts(): Promise<DraftsResult> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };

  try {
    const data = await apiGetJson("/api/drafts", { auth: true });
    if (data.ok === true && Array.isArray(data.drafts)) {
      return { ok: true, drafts: data.drafts as DraftSummary[] };
    }
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : FALLBACK_ERROR,
    };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
