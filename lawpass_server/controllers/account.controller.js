"use strict";

// Ported from app/(app)/account/_actions.ts (updateProfileAction).
// Auth-only: the users_update_own_profile RLS policy (auth.uid() = id) is
// the boundary — a user can only ever patch their own row. full_name and
// exam_date_planned have no DB-level invariants beyond the column
// constraints the validator already enforces, so it's a direct UPDATE
// (no RPC). `revalidatePath` was dropped.

async function updateProfile(req, res) {
  const data = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name,
      exam_date_planned: data.exam_date_planned ?? null,
    })
    .eq("id", user.id);

  if (error) {
    console.error(
      `[account] update profile FAILED user=${user.id} code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" });
  }

  console.info(`[account] update profile OK user=${user.id}`);
  return res.json({ ok: true });
}

module.exports = { updateProfile };
