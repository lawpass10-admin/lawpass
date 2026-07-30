"use strict";

// Ported from ../../app/(app)/bookmarks/_actions.ts. Subscription-gated.
// Direct RLS-guarded DELETE (no RPC) — RLS on `bookmarks` enforces
// user_id = auth.uid(), so a guessed id just matches zero rows.
// `revalidatePath` dropped.

async function removeBookmark(req, res) {
  const { bookmarkId } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("id", bookmarkId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[bookmarks] remove FAILED user=${user.id} bookmark_id=${bookmarkId} code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "שגיאה — נסה שוב" });
  }

  console.info(
    `[bookmarks] remove OK user=${user.id} bookmark_id=${bookmarkId}`
  );
  return res.json({ ok: true });
}

module.exports = { removeBookmark };
