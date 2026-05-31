/**
 * Slice 25 B-1 — server-side helpers for the per-question Notes
 * feature. The `question_notes` table already exists (migration
 * 20260503000007); this module just centralizes the identity
 * derivation + read + UPSERT shapes against it.
 *
 * Identity model (mirrors the table's UNIQUE constraint):
 *   - Source note: `question_type='source'`, `source_question_group_id`
 *     = the source's `question_group_id`, `angle_position = NULL`.
 *   - Angle note: `question_type='angle'`,
 *     `source_question_group_id = parent source's question_group_id`,
 *     `angle_position = angle's display_order (1..5)`.
 *
 * This survives angle versioning: re-publishing an angle keeps the
 * same (parent group_id, display_order) slot, so the note follows
 * the question concept rather than a particular row UUID.
 *
 * Storage shape: TipTap canonical JSON in `content_json`; cached
 * sanitized HTML in `content_html` (renderable without rehydrating
 * the editor — useful for the centralized bank in Slice 25 B-2).
 *
 * RLS: `users_own_notes` already gates this on
 * `auth.uid() = user_id AND has_active_subscription()`, so expired
 * subscribers can't read or write at the DB level — even before any
 * UI gate.
 */

import type { ResolvedQuestion } from "@/lib/db/practice";
import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// Types
// =============================================================================

export type NoteIdentity = {
  question_type: "source" | "angle";
  source_question_group_id: string;
  /** `null` for source notes; the angle's display_order (1..5) for
   *  angle notes. The DB CHECK enforces the pairing. */
  angle_position: number | null;
};

export type NoteRow = NoteIdentity & {
  id: string;
  /** TipTap canonical JSON document. */
  content_json: unknown;
  /** Sanitized HTML cached for display (e.g. the notes bank). */
  content_html: string;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// Identity derivation
// =============================================================================

/**
 * Maps a `ResolvedQuestion` to the `(question_type,
 * source_question_group_id, angle_position)` triple that keys the
 * `question_notes` table.
 *
 * Returns `null` for archived / out-of-range resolutions — those
 * surfaces don't have a stable identity to attach a note to.
 *
 * For ANGLES, `angle_position` comes from the angle's
 * `display_order`. The DB CHECK constrains the column to 1..5, and
 * the seed pipeline assigns display_order in that range, so a
 * mismatch here would mean a content-team bug, not a build bug. We
 * defensively guard with a range check anyway and surface a
 * `null` so the action can fail cleanly rather than silently writing
 * to the wrong slot.
 */
export function deriveNoteIdentity(
  resolved: ResolvedQuestion
): NoteIdentity | null {
  if (resolved.kind === "source") {
    return {
      question_type: "source",
      source_question_group_id: resolved.question.question_group_id,
      angle_position: null,
    };
  }
  if (resolved.kind === "angle") {
    const position = resolved.question.display_order;
    if (
      !Number.isFinite(position) ||
      position < 1 ||
      position > 5 ||
      !Number.isInteger(position)
    ) {
      return null;
    }
    return {
      question_type: "angle",
      source_question_group_id: resolved.parentSource.question_group_id,
      angle_position: position,
    };
  }
  return null;
}

// =============================================================================
// Reads
// =============================================================================

const NOTE_SELECT_COLS =
  "id, question_type, source_question_group_id, angle_position, content_json, content_html, created_at, updated_at";

/**
 * Fetch the user's note (if any) for the question at the resolved
 * position. The play page calls this in parallel with the existing
 * `bookmarked` / `existingAttempt` reads.
 *
 * Returns `null` for:
 *   - Archived / out-of-range resolutions (no stable identity).
 *   - Identity derivation failures (defensive).
 *   - No note row in the table for that user × question.
 *   - Any DB error (treated as "no note" so the play screen still
 *     renders; the trigger button just opens an empty editor).
 */
export async function getNoteForPosition(
  supabase: SupabaseSsrClient,
  userId: string,
  resolved: ResolvedQuestion
): Promise<NoteRow | null> {
  const identity = deriveNoteIdentity(resolved);
  if (!identity) return null;

  let query = supabase
    .from("question_notes")
    .select(NOTE_SELECT_COLS)
    .eq("user_id", userId)
    .eq("question_type", identity.question_type)
    .eq("source_question_group_id", identity.source_question_group_id);

  // `angle_position` is NULL for source notes; PostgREST `.is()` is
  // the equivalent of SQL `IS NULL`.
  query =
    identity.angle_position === null
      ? query.is("angle_position", null)
      : query.eq("angle_position", identity.angle_position);

  // Slice 25.2 bugfix — the original implementation used
  // `.maybeSingle()`, which ERRORS when 2+ rows match. Source notes
  // accumulated duplicates because the UNIQUE constraint allowed
  // them (Postgres default is NULLS DISTINCT, so the
  // (..., angle_position=NULL) tuple matched no existing row in
  // `.upsert(onConflict)`). When duplicates existed, the read here
  // returned null → editor opened empty even though saved notes
  // existed. We now `.order(updated_at desc).limit(1)` so the most
  // recent row wins regardless. `saveNote` cleans up the older
  // duplicates atomically going forward.
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id as string,
    question_type: row.question_type as "source" | "angle",
    source_question_group_id: row.source_question_group_id as string,
    angle_position: (row.angle_position as number | null) ?? null,
    content_json: row.content_json,
    content_html: (row.content_html as string) ?? "",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
