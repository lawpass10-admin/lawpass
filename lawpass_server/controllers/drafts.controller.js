"use strict";

// "הטיוטות שלי" — the list behind the sidebar row.
//
// Read-only. Saving a draft is still the server action in app/(app)/_actions.ts
// (the scratch-pad dialog writes through it); this is the reading side, which
// never existed before because drafts were write-only — you could file one and
// then had no way to see it again.
//
// NO SUBSCRIPTION GATE, and that is deliberate rather than an omission. The
// save path states the rule outright: "a lapsed student's notes are still
// their notes, and locking someone out of their own writing is not a thing a
// paywall should do." A reader that gated would mean a student can write
// drafts they are not allowed to read back, which is the same rule applied
// incoherently.

const db = require("../db/drafts");
const { draftTitle } = require("../lib/draft-title");

/**
 * One row as the list renders it.
 *
 * The title is computed here, not in the browser — see lib/draft-title.js for
 * why. The full text ships with the row: a scratch pad entry is read in place,
 * and a second request per draft to show what it says would be a round trip
 * for every card on the page.
 */
function toListEntry(row) {
  return {
    draft_id: row.draft_id,
    title: draftTitle(row.text),
    text: row.text,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** GET /api/drafts — the caller's own drafts, newest first. */
async function listDrafts(req, res) {
  try {
    const rows = await db.listDraftsForUser(req.supabase, req.user.id);

    console.info(`[drafts] list OK user=${req.user.id} count=${rows.length}`);
    return res.json({ ok: true, drafts: rows.map(toListEntry) });
  } catch (error) {
    console.error(
      `[drafts] list FAILED user=${req.user.id} code=${error?.code ?? "unknown"} msg=${error?.message ?? error}`
    );
    // An empty list and a failed read must not look the same on screen: the
    // first means "you have not written anything", the second means "we could
    // not fetch what you wrote", and a student told the wrong one of those
    // concludes their notes are gone.
    return res.json({ ok: false, error: "לא ניתן לטעון את הטיוטות — נסו שוב" });
  }
}

module.exports = { listDrafts, toListEntry };
