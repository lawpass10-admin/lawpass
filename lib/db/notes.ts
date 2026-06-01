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

import type { Learning360Item } from "@/lib/db/learning360";
import type { ResolvedQuestion } from "@/lib/db/practice";
import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// Slice 26 — centralized Notes bank ("/notes")
// =============================================================================

/** Stable identity passed to `saveNoteByIdentity` from the bank UI.
 *  Mirrors the table's UNIQUE shape; the action doesn't take a
 *  (sessionId, position) because the bank has no session context. */
export type NoteWriteIdentity = {
  question_type: "source" | "angle";
  source_question_group_id: string;
  angle_position: number | null;
};

/** Plain HTML-strip + truncate for the row excerpts shown in the bank.
 *  No risk of XSS: we're only displaying the stripped text content. */
const NOTE_EXCERPT_MAX = 140;
export function excerptFromHtml(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= NOTE_EXCERPT_MAX) return text;
  return text.slice(0, NOTE_EXCERPT_MAX).trimEnd() + "…";
}

/**
 * Bank row payload. Carries enough to render the collapsed row
 * (chapter, excerpt, last-updated) AND to drive the expanded-detail
 * shared resolvers (`questionId` for `resolveLearning360ForList` /
 * `resolveChoicesForList`).
 *
 * `isArchived` = true when the underlying source/angle row was
 * archived after the note was written (or RLS hides it). The bank
 * still surfaces the note text + the editor — the user can keep
 * editing — but the 360/choices detail collapses to a soft "הוסר
 * זמנית" badge instead of a broken render.
 */
export type NoteListItem = {
  noteId: string;
  questionType: "source" | "angle";
  /** Stored identity (always present). */
  sourceQuestionGroupId: string;
  /** Stored identity. Null for source notes, 1..5 for angle notes. */
  anglePosition: number | null;
  contentHtml: string;
  contentJson: unknown;
  excerpt: string;
  updatedAt: string;
  /** Current source/angle row id when resolvable; null when archived /
   *  RLS-hidden. Used as `Learning360Item.question_id` downstream. */
  questionId: string | null;
  chapterTitle: string;
  questionText: string;
  /** Angle-only display info. */
  angleLetter: string | null;
  isArchived: boolean;
};

type NoteRawRow = {
  id: string;
  question_type: "source" | "angle";
  source_question_group_id: string;
  angle_position: number | null;
  content_json: unknown;
  content_html: string | null;
  updated_at: string;
};

type SourceMeta = {
  current_id: string;
  question_text: string;
  chapter_title: string;
};

type AngleMeta = {
  current_id: string;
  angle_letter: string;
  question_text: string;
  chapter_title: string;
};

/**
 * Resolves each `question_notes` row into the chapter / question
 * context the bank needs, plus the current question row id the
 * shared 360°/choice resolvers expect.
 *
 * Identity mapping (mirrors the table's UNIQUE shape):
 *  - SOURCE note: `source_question_group_id` → most recent
 *    `source_questions WHERE question_group_id = X AND is_current = true`.
 *  - ANGLE note: parent group_id + `angle_position` (1..5) → join
 *    `angle_questions` against the parent's current source row +
 *    `display_order = position`.
 *
 * Notes whose underlying question has since been archived land with
 * `questionId: null`, `isArchived: true`, and empty display metadata.
 * They still surface (the user can keep editing the note text); the
 * detail-view just renders a soft "הוסר זמנית" marker instead of the
 * 360 panel. Mirrors the bookmarks-list archived behavior.
 *
 * RLS: `users_own_notes` already filters to this user; the
 * `source_questions` / `angle_questions` selects use the public
 * `is_current = true` filter to pick the current row per group.
 */
export async function getUserNotes(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<NoteListItem[]> {
  const { data, error } = await supabase
    .from("question_notes")
    .select(
      "id, question_type, source_question_group_id, angle_position, content_json, content_html, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as NoteRawRow[];
  // Universe of group_ids we need to resolve. Source notes need the
  // source itself; angle notes need the PARENT source (for chapter
  // info + as a join target for angles).
  const groupIds = new Set<string>();
  // Collected angle_position values per parent group, so we can
  // filter the angles fetch in JS without a per-note round-trip.
  const angleSlots = new Map<string, Set<number>>(); // parent_group_id → {positions}
  for (const r of rows) {
    if (!r.source_question_group_id) continue;
    groupIds.add(r.source_question_group_id);
    if (r.question_type === "angle" && r.angle_position !== null) {
      const set =
        angleSlots.get(r.source_question_group_id) ?? new Set<number>();
      set.add(r.angle_position);
      angleSlots.set(r.source_question_group_id, set);
    }
  }

  // (a) Fetch current source_questions for every group_id we care
  // about (source notes display from here; angle notes use it as
  // the chapter source + the angle-join base).
  const sourceMetaByGroupId = new Map<string, SourceMeta>();
  // Also: parent group_id → current source row id, for the angle
  // join below.
  const sourceIdByGroupId = new Map<string, string>();
  if (groupIds.size > 0) {
    type SourceRow = {
      id: string;
      question_group_id: string;
      question_text: string | null;
      chapter:
        | { title: string }
        | { title: string }[]
        | null;
    };
    const { data: sourcesData } = await supabase
      .from("source_questions")
      .select(
        "id, question_group_id, question_text, chapter:chapters!source_questions_chapter_id_fkey(title)"
      )
      .in("question_group_id", Array.from(groupIds))
      .eq("is_current", true);
    for (const row of (sourcesData ?? []) as unknown as SourceRow[]) {
      const chapterPick = Array.isArray(row.chapter)
        ? row.chapter[0]
        : row.chapter;
      const meta: SourceMeta = {
        current_id: row.id,
        question_text: row.question_text ?? "",
        chapter_title: chapterPick?.title ?? "",
      };
      sourceMetaByGroupId.set(row.question_group_id, meta);
      sourceIdByGroupId.set(row.question_group_id, row.id);
    }
  }

  // (b) Fetch angles whose parent is one of the resolved current
  // sources. We filter in-JS by display_order so we only need ONE
  // `.in("source_question_id", parentIds)` query.
  const angleMetaByParentSlot = new Map<string, AngleMeta>(); // key: `${parentGroupId}:${position}`
  if (angleSlots.size > 0 && sourceIdByGroupId.size > 0) {
    const parentSourceIds = Array.from(sourceIdByGroupId.values());
    type AngleRow = {
      id: string;
      source_question_id: string;
      angle_letter: string;
      display_order: number;
      question_text: string | null;
    };
    const { data: anglesData } = await supabase
      .from("angle_questions")
      .select(
        "id, source_question_id, angle_letter, display_order, question_text"
      )
      .in("source_question_id", parentSourceIds);
    // Build reverse: source.id → group_id (we have the forward map).
    const groupByParentId = new Map<string, string>();
    for (const [gid, sid] of sourceIdByGroupId) groupByParentId.set(sid, gid);
    for (const row of (anglesData ?? []) as unknown as AngleRow[]) {
      const parentGroupId = groupByParentId.get(row.source_question_id);
      if (!parentGroupId) continue;
      const positionsForThisGroup = angleSlots.get(parentGroupId);
      if (!positionsForThisGroup) continue;
      if (!positionsForThisGroup.has(row.display_order)) continue;
      const parentMeta = sourceMetaByGroupId.get(parentGroupId);
      angleMetaByParentSlot.set(`${parentGroupId}:${row.display_order}`, {
        current_id: row.id,
        angle_letter: row.angle_letter,
        question_text: row.question_text ?? "",
        chapter_title: parentMeta?.chapter_title ?? "",
      });
    }
  }

  // (c) Assemble the public row payload.
  const out: NoteListItem[] = [];
  for (const r of rows) {
    const contentHtml = r.content_html ?? "";
    const excerpt = excerptFromHtml(contentHtml);
    if (r.question_type === "source") {
      const meta = sourceMetaByGroupId.get(r.source_question_group_id);
      out.push({
        noteId: r.id,
        questionType: "source",
        sourceQuestionGroupId: r.source_question_group_id,
        anglePosition: null,
        contentHtml,
        contentJson: r.content_json,
        excerpt,
        updatedAt: r.updated_at,
        questionId: meta?.current_id ?? null,
        chapterTitle: meta?.chapter_title ?? "",
        questionText: meta?.question_text ?? "",
        angleLetter: null,
        isArchived: meta === undefined,
      });
    } else {
      if (r.angle_position === null) continue;
      const angleMeta = angleMetaByParentSlot.get(
        `${r.source_question_group_id}:${r.angle_position}`
      );
      out.push({
        noteId: r.id,
        questionType: "angle",
        sourceQuestionGroupId: r.source_question_group_id,
        anglePosition: r.angle_position,
        contentHtml,
        contentJson: r.content_json,
        excerpt,
        updatedAt: r.updated_at,
        questionId: angleMeta?.current_id ?? null,
        chapterTitle: angleMeta?.chapter_title ?? "",
        questionText: angleMeta?.question_text ?? "",
        angleLetter: angleMeta?.angle_letter ?? null,
        isArchived: angleMeta === undefined,
      });
    }
  }
  return out;
}

// =============================================================================
// Slice 27 — by-identity read helpers for the bookmarks/mistakes lists
// =============================================================================

/**
 * Slice 27 — lazily fetch the user's note for a given identity. The
 * bookmarks + mistakes list pages call this on pencil click rather
 * than pre-fetching all notes' content (which would be wasteful for
 * pages with many rows; only the rows the user actually opens cost
 * a round-trip).
 *
 * Tolerates pre-Slice-25.2 duplicate rows (NULL-in-UNIQUE leftover)
 * by ordering on `updated_at` and taking the most recent — same
 * defensive read shape as `getNoteForPosition`. Returns null when
 * no row exists.
 */
export async function getNoteByIdentity(
  supabase: SupabaseSsrClient,
  userId: string,
  identity: NoteWriteIdentity
): Promise<NoteRow | null> {
  let query = supabase
    .from("question_notes")
    .select(NOTE_SELECT_COLS)
    .eq("user_id", userId)
    .eq("question_type", identity.question_type)
    .eq("source_question_group_id", identity.source_question_group_id);

  query =
    identity.angle_position === null
      ? query.is("angle_position", null)
      : query.eq("angle_position", identity.angle_position);

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

/**
 * Slice 27 — list every note identity the user has, so the list
 * pages can flag rows that already have a note WITHOUT a per-row
 * round-trip. Returns a `Set<string>` keyed:
 *
 *   source notes → `"source:${sourceQuestionGroupId}"`
 *   angle notes  → `"angle:${parentGroupId}:${anglePosition}"`
 *
 * Use `notedIdentityKey()` to derive the lookup key from either
 * side so callers don't accidentally write a different shape.
 */
export async function getNotedIdentities(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("question_notes")
    .select("question_type, source_question_group_id, angle_position")
    .eq("user_id", userId);
  const set = new Set<string>();
  if (error || !data) return set;
  for (const row of data as Array<{
    question_type: "source" | "angle";
    source_question_group_id: string | null;
    angle_position: number | null;
  }>) {
    if (!row.source_question_group_id) continue;
    if (row.question_type === "source") {
      set.add(`source:${row.source_question_group_id}`);
    } else if (row.angle_position !== null) {
      set.add(
        `angle:${row.source_question_group_id}:${row.angle_position}`
      );
    }
  }
  return set;
}

/**
 * Slice 27 — single source of truth for the indicator-set lookup
 * key. Same shape as the strings produced by `getNotedIdentities`.
 */
export function notedIdentityKey(identity: NoteWriteIdentity): string {
  if (identity.angle_position === null) {
    return `source:${identity.source_question_group_id}`;
  }
  return `angle:${identity.source_question_group_id}:${identity.angle_position}`;
}

// =============================================================================
// Slice 26 — save by stored identity (bank-side write path)
// =============================================================================

/**
 * Write helper used by the notes bank server action. Same SOURCE
 * emulate-UPSERT / ANGLE upsert split as the practice-play
 * `saveNote` (Slice 25.2) — the only difference is identity
 * provenance: the bank already has the stored
 * `(question_type, source_question_group_id, angle_position)` triple
 * (it loaded the row to render the editor) and passes it in
 * directly, rather than re-resolving from a (sessionId, position)
 * pair that doesn't exist on /notes.
 *
 * Returns the new `updated_at` on success, or an error string. The
 * caller maps that to the same { ok, updatedAt } shape the editor's
 * save callback expects.
 */
export async function saveNoteByIdentity(
  supabase: SupabaseSsrClient,
  userId: string,
  identity: NoteWriteIdentity,
  contentJson: unknown,
  contentHtml: string
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  if (identity.angle_position === null) {
    // SOURCE branch — Postgres' default NULLS DISTINCT means
    // .upsert(onConflict) can't recognize the NULL-row case; emulate.
    const { data: existingRows, error: lookupError } = await supabase
      .from("question_notes")
      .select("id")
      .eq("user_id", userId)
      .eq("question_type", "source")
      .eq("source_question_group_id", identity.source_question_group_id)
      .is("angle_position", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (lookupError) {
      console.error(
        `[notes] save_by_identity lookup FAILED user=${userId} msg=${lookupError.message}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    const existing =
      existingRows && existingRows.length > 0 ? existingRows[0] : null;
    if (existing) {
      const [updateResult, cleanupResult] = await Promise.all([
        supabase
          .from("question_notes")
          .update({ content_json: contentJson, content_html: contentHtml })
          .eq("id", existing.id)
          .select("updated_at")
          .single(),
        supabase
          .from("question_notes")
          .delete()
          .eq("user_id", userId)
          .eq("question_type", "source")
          .eq("source_question_group_id", identity.source_question_group_id)
          .is("angle_position", null)
          .neq("id", existing.id),
      ]);
      if (updateResult.error || !updateResult.data) {
        console.error(
          `[notes] save_by_identity update FAILED user=${userId} msg=${updateResult.error?.message ?? "no data"}`
        );
        return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
      }
      if (cleanupResult.error) {
        console.warn(
          `[notes] save_by_identity cleanup non-fatal user=${userId} msg=${cleanupResult.error.message}`
        );
      }
      return { ok: true, updatedAt: updateResult.data.updated_at as string };
    }
    const { data, error } = await supabase
      .from("question_notes")
      .insert({
        user_id: userId,
        question_type: "source",
        source_question_group_id: identity.source_question_group_id,
        angle_position: null,
        content_json: contentJson,
        content_html: contentHtml,
      })
      .select("updated_at")
      .single();
    if (error || !data) {
      console.error(
        `[notes] save_by_identity insert FAILED user=${userId} msg=${error?.message ?? "no data"}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    return { ok: true, updatedAt: data.updated_at as string };
  }

  // ANGLE branch — .upsert(onConflict) works because angle_position
  // is a non-NULL integer.
  const { data, error } = await supabase
    .from("question_notes")
    .upsert(
      {
        user_id: userId,
        question_type: identity.question_type,
        source_question_group_id: identity.source_question_group_id,
        angle_position: identity.angle_position,
        content_json: contentJson,
        content_html: contentHtml,
      },
      {
        onConflict:
          "user_id,question_type,source_question_group_id,angle_position",
      }
    )
    .select("updated_at")
    .single();
  if (error || !data) {
    console.error(
      `[notes] save_by_identity angle FAILED user=${userId} msg=${error?.message ?? "no data"}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }
  return { ok: true, updatedAt: data.updated_at as string };
}

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

// =============================================================================
// Slice 38 — batch identity resolver for review surfaces
// =============================================================================

/**
 * Slice 38 — resolve the `NoteWriteIdentity` triple for every item in
 * a review surface's `question_list`. Returns a Map keyed
 * `"${question_type}:${question_id}"`, with `null` for rows whose
 * parent source is archived / RLS-hidden / missing (the call site
 * renders a disabled pencil — same rule as the bookmarks/mistakes
 * list pages in Slice 27).
 *
 * Construction MUST stay byte-for-byte identical to `deriveNoteIdentity`
 * (line ~562 above):
 *
 *   SOURCE: { question_type: "source",
 *             source_question_group_id: source_questions.question_group_id,
 *             angle_position: null }
 *
 *   ANGLE:  { question_type: "angle",
 *             source_question_group_id: parent source_questions.question_group_id,
 *             angle_position: angle_questions.display_order }
 *
 * The angle SELECT mirrors `ANGLE_PREVIEW_SELECT` /
 * `mapAnglePreview` from `lib/db/practice.ts` (Slice 27) — same
 * `source_question:source_questions!angle_questions_source_question_id_fkey(question_group_id)`
 * join + `pickOne` parent-unwrap. Where Slice 27 surfaces the parent
 * group + display_order onto a UI preview type, we surface them onto
 * a notes identity here.
 *
 * Used in parallel inside `getSummary` (practice) and
 * `getExamResultsAggregate` (exam) so the review surfaces can mount
 * the existing `<RowNotePencil>` without extra round-trips per row.
 */
export async function resolveNoteIdentitiesForList(
  supabase: SupabaseSsrClient,
  items: Learning360Item[]
): Promise<Map<string, NoteWriteIdentity | null>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of items) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const map = new Map<string, NoteWriteIdentity | null>();
  const [srcRes, angRes] = await Promise.all([
    sourceIds.length > 0
      ? supabase
          .from("source_questions")
          .select("id, question_group_id")
          .in("id", sourceIds)
      : Promise.resolve({ data: null as unknown }),
    angleIds.length > 0
      ? supabase
          .from("angle_questions")
          .select(
            "id, display_order, source_question:source_questions!angle_questions_source_question_id_fkey(question_group_id)"
          )
          .in("id", angleIds)
      : Promise.resolve({ data: null as unknown }),
  ]);

  // SOURCE → seed `"source:${id}"` keys. Rows missing from the SELECT
  // (archived / RLS-hidden) stay un-seeded → callers get `undefined`
  // and treat the row as having no identity, same as `null`.
  for (const row of (srcRes.data ?? []) as Array<{
    id: string;
    question_group_id: string | null;
  }>) {
    if (!row.question_group_id) {
      map.set(`source:${row.id}`, null);
      continue;
    }
    map.set(`source:${row.id}`, {
      question_type: "source",
      source_question_group_id: row.question_group_id,
      angle_position: null,
    });
  }

  // ANGLE → seed `"angle:${id}"` keys. The Postgres-REST join
  // returns either a single object or a one-element array depending
  // on the FK shape; mirror the Slice-27 `pickOne` semantics inline
  // so this file stays self-contained.
  type AngleParent = { question_group_id: string | null };
  type AngleRow = {
    id: string;
    display_order: number | null;
    source_question: AngleParent | AngleParent[] | null;
  };
  for (const row of (angRes.data ?? []) as AngleRow[]) {
    const parent = Array.isArray(row.source_question)
      ? (row.source_question[0] ?? null)
      : row.source_question;
    const parentGroupId = parent?.question_group_id ?? null;
    const position = row.display_order;
    // Defensive: angle without resolvable parent OR with out-of-range
    // display_order → null identity. Mirrors `deriveNoteIdentity`'s
    // 1..5 integer guard at line ~574.
    if (
      !parentGroupId ||
      position === null ||
      !Number.isFinite(position) ||
      !Number.isInteger(position) ||
      position < 1 ||
      position > 5
    ) {
      map.set(`angle:${row.id}`, null);
      continue;
    }
    map.set(`angle:${row.id}`, {
      question_type: "angle",
      source_question_group_id: parentGroupId,
      angle_position: position,
    });
  }

  return map;
}
