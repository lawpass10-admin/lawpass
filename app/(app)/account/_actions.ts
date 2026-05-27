"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  editProfileSchema,
  type EditProfileInput,
} from "@/lib/validators/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * SPEC §7.4 — /account profile editor (Slice 6).
 *
 * Direct UPDATE against profiles relying on the existing
 * `users_update_own_profile` RLS policy (auth.uid() = id). No RPC needed:
 * full_name and exam_date_planned have no DB-level invariants beyond the
 * column constraints already enforced by Zod at the form layer.
 *
 * Defense in depth: re-parse input through editProfileSchema inside the
 * action (SPEC §9.5 layer 3) — the client-side validation can be bypassed
 * by a hand-crafted POST.
 */
export async function updateProfileAction(
  input: EditProfileInput
): Promise<ActionResult> {
  const parsed = editProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name,
      exam_date_planned: data.exam_date_planned ?? null,
    })
    .eq("id", user.id);

  if (error) {
    console.error(
      `[account] update profile FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" };
  }

  console.info(`[account] update profile OK user=${user.id}`);

  // The sidebar reads profile.full_name in (app)/layout.tsx and the
  // dashboard header strip reads exam_date_planned — invalidate the
  // layout cache so both refresh on the next navigation.
  revalidatePath("/", "layout");
  return { ok: true };
}
