"use client";

/**
 * Notes-bank domain — client wrapper (safe dual-path). Same signatures +
 * return shapes as the server actions; components import THIS.
 *
 * The return types are derived from the server actions themselves
 * (Awaited<ReturnType<…>>) so they stay in lock-step with the components'
 * expectations. Falls back to the actions when the Express API is
 * disabled (production); otherwise POSTs to /api/notes/save|load with the
 * Supabase Bearer token.
 */

import { apiEnabled, apiPostJson } from "@/lib/api/client";
import {
  saveNoteFromBank as saveNoteFromBankAction,
  loadNoteByIdentity as loadNoteByIdentityAction,
} from "@/app/(app)/notes/_actions";

type SaveResult = Awaited<ReturnType<typeof saveNoteFromBankAction>>;
type LoadResult = Awaited<ReturnType<typeof loadNoteByIdentityAction>>;

export async function saveNoteFromBank(input: unknown): Promise<SaveResult> {
  if (!apiEnabled()) {
    return saveNoteFromBankAction(input);
  }
  try {
    const data = await apiPostJson("/api/notes/save", input, { auth: true });
    // Server returns the same { ok, updatedAt | error } envelope.
    return data as unknown as SaveResult;
  } catch {
    return { ok: false, error: "טופס לא תקין" };
  }
}

export async function loadNoteByIdentity(input: unknown): Promise<LoadResult> {
  if (!apiEnabled()) {
    return loadNoteByIdentityAction(input);
  }
  try {
    const data = await apiPostJson("/api/notes/load", input, { auth: true });
    // Server returns the same { ok, note | error } envelope.
    return data as unknown as LoadResult;
  } catch {
    return { ok: false, error: "טופס לא תקין" };
  }
}
