"use server";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";
import { removeBookmarkSchema } from "@/lib/validators/practice";

/**
 * Deletes a single bookmark row owned by the current user. RLS on the
 * bookmarks table enforces `user_id = auth.uid()`, so a malicious
 * payload can't delete someone else's row even with a guessed UUID —
 * the WHERE clause just matches zero rows.
 *
 * We use a direct DELETE rather than a SECURITY DEFINER RPC because
 * the partial-index ON CONFLICT pattern that drove `record_bookmark_toggle`
 * doesn't apply here. RLS + standard client is the simpler path.
 */
export async function removeBookmark(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = removeBookmarkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "פרמטרים לא תקינים",
    };
  }

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("id", parsed.data.bookmarkId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[bookmarks] remove FAILED user=${user.id} bookmark_id=${parsed.data.bookmarkId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "שגיאה — נסה שוב" };
  }

  console.info(
    `[bookmarks] remove OK user=${user.id} bookmark_id=${parsed.data.bookmarkId}`
  );
  revalidatePath("/", "layout");
  return { ok: true };
}
