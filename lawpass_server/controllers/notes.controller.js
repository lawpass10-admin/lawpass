"use strict";

// Ported from ../../app/(app)/notes/_actions.ts (centralized notes bank).
// These actions only require authentication — RLS (has_active_subscription)
// is the subscription gate, so no requireSubscription middleware.
// `revalidatePath` dropped.

const { saveNoteByIdentity, getNoteByIdentity } = require("../db/notes");

/**
 * Persist an edit from the notes bank's in-place editor. The bank already
 * knows the note's stored identity triple and sends it directly.
 */
async function saveNoteFromBank(req, res) {
  const data = req.valid;
  const user = req.user;

  const result = await saveNoteByIdentity(
    req.supabase,
    user.id,
    {
      question_type: data.questionType,
      source_question_group_id: data.sourceQuestionGroupId,
      angle_position: data.anglePosition,
    },
    data.contentJson,
    data.contentHtml
  );

  if (!result.ok) return res.json(result);

  console.info(
    `[notes] save_from_bank OK user=${user.id} type=${data.questionType} group=${data.sourceQuestionGroupId} pos=${data.anglePosition ?? "null"}`
  );
  return res.json(result);
}

/**
 * Lazily load the user's note for a stored identity (pencil-click on the
 * bookmarks/mistakes list rows). Returns `{ note: null }` when none.
 */
async function loadNoteByIdentity(req, res) {
  const data = req.valid;

  const row = await getNoteByIdentity(req.supabase, req.user.id, {
    question_type: data.questionType,
    source_question_group_id: data.sourceQuestionGroupId,
    angle_position: data.anglePosition,
  });

  console.info(
    `[notes] load OK user=${req.user.id} type=${data.questionType} group=${data.sourceQuestionGroupId} pos=${data.anglePosition ?? "null"} found=${row ? "yes" : "no"}`
  );

  if (!row) return res.json({ ok: true, note: null });
  return res.json({
    ok: true,
    note: {
      contentJson: row.content_json,
      contentHtml: row.content_html,
      updatedAt: row.updated_at,
    },
  });
}

module.exports = { saveNoteFromBank, loadNoteByIdentity };
