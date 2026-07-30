"use strict";

// Ported from ../../lib/db/notes.ts — the two helpers the notes-bank
// actions use: getNoteByIdentity (lazy read) and saveNoteByIdentity
// (bank-side write). RLS gates question_notes on
// auth.uid() = user_id AND has_active_subscription().

const NOTE_SELECT_COLS =
  "id, question_type, source_question_group_id, angle_position, content_json, content_html, created_at, updated_at";

/**
 * Lazily fetch the user's note for a stored identity, or null. Tolerates
 * pre-Slice-25.2 duplicate NULL rows by taking the most recent.
 */
async function getNoteByIdentity(supabase, userId, identity) {
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
    id: row.id,
    question_type: row.question_type,
    source_question_group_id: row.source_question_group_id,
    angle_position: row.angle_position ?? null,
    content_json: row.content_json,
    content_html: row.content_html ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Write by stored identity. Same SOURCE emulate-UPSERT / ANGLE upsert
 * split as practice-play saveNote (Postgres NULLS-DISTINCT workaround for
 * source notes where angle_position is NULL).
 */
async function saveNoteByIdentity(supabase, userId, identity, contentJson, contentHtml) {
  if (identity.angle_position === null) {
    // SOURCE branch — emulate UPSERT around the NULL angle_position slot.
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
      return { ok: true, updatedAt: updateResult.data.updated_at };
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
    return { ok: true, updatedAt: data.updated_at };
  }

  // ANGLE branch — onConflict upsert works (angle_position is non-NULL).
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
  return { ok: true, updatedAt: data.updated_at };
}

module.exports = { getNoteByIdentity, saveNoteByIdentity };
