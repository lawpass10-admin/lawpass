"use server";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";
import { removeMistakeSchema } from "@/lib/validators/practice";

/**
 * Soft-removes a mistake from the user's list. We set
 * `manually_removed = true` rather than DELETE so the analytics history
 * stays intact and `record_mistake` (Phase 2.7 RPC) can resurface the
 * row by resetting the flag if the user later re-misses the same
 * question. The sidebar badge query in (app)/layout.tsx already filters
 * `manually_removed = false`, so the badge decrements as soon as
 * `revalidatePath("/", "layout")` flushes.
 *
 * Plain UPDATE via the SSR client is sufficient — RLS on `mistakes`
 * enforces `user_id = auth.uid()` for both SELECT and UPDATE.
 */
export async function removeMistake(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = removeMistakeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "פרמטרים לא תקינים",
    };
  }

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("mistakes")
    .update({ manually_removed: true })
    .eq("id", parsed.data.mistakeId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[mistakes] remove FAILED user=${user.id} mistake_id=${parsed.data.mistakeId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "שגיאה — נסה שוב" };
  }

  console.info(
    `[mistakes] remove OK user=${user.id} mistake_id=${parsed.data.mistakeId}`
  );
  revalidatePath("/", "layout");
  return { ok: true };
}
