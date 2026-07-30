"use strict";

// Ported from ../../app/(app)/mistakes/_actions.ts. Subscription-gated.
// SOFT-remove: set manually_removed = true rather than DELETE, so
// analytics history stays intact and record_mistake can resurface the row
// if the user re-misses the question. RLS on `mistakes` enforces
// user_id = auth.uid(). `revalidatePath` dropped.

async function removeMistake(req, res) {
  const { mistakeId } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const { error } = await supabase
    .from("mistakes")
    .update({ manually_removed: true })
    .eq("id", mistakeId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[mistakes] remove FAILED user=${user.id} mistake_id=${mistakeId} code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "שגיאה — נסה שוב" });
  }

  console.info(
    `[mistakes] remove OK user=${user.id} mistake_id=${mistakeId}`
  );
  return res.json({ ok: true });
}

module.exports = { removeMistake };
