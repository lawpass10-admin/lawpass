import Link from "next/link";
import { redirect } from "next/navigation";

import type { ChapterChip } from "@/components/practice/chapter-filter-chips";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getNotedIdentities } from "@/lib/db/notes";
import { getUserBookmarks } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { BookmarksList } from "./_components/bookmarks-list";

/**
 * /bookmarks — Server Component. Lists the user's bookmarks, computes
 * per-chapter counts for the filter chips, and hands both to the client
 * list. Archived bookmarks (RLS-hidden underlying question) are
 * EXCLUDED from chapter counts (they have no chapter info to bucket
 * against) but kept in the list so the user can clean them up.
 *
 * Empty state — 0 bookmarks total — bypasses the list and shows a
 * Hebrew CTA back to /practice.
 */
export default async function BookmarksPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();
  if (!user) redirect("/login");

  // Slice 27 — fetch the user's note identities in parallel with
  // bookmarks so each row can render a filled/marked pencil for
  // questions that already have a note. Both reads are RLS-gated by
  // (auth.uid() = user_id AND has_active_subscription()).
  const [bookmarks, notedIdentities] = await Promise.all([
    getUserBookmarks(supabase, user.id),
    getNotedIdentities(supabase, user.id),
  ]);

  // Per-chapter counts for the filter chips. Built from the bookmarks
  // result so the chip counts always match what's in the visible list
  // (no separate query, no drift). Archived rows have empty chapterId
  // — skip them. Sorted alphabetically (Hebrew locale) per Phase 5 §10.
  const chapterCountsMap = new Map<string, { title: string; count: number }>();
  for (const b of bookmarks) {
    const preview =
      b.questionType === "source" ? b.sourceQuestion : b.angleQuestion;
    if (!preview.chapterId) continue; // archived
    const existing = chapterCountsMap.get(preview.chapterId);
    if (existing) existing.count++;
    else
      chapterCountsMap.set(preview.chapterId, {
        title: preview.chapterTitle,
        count: 1,
      });
  }
  const chapterCounts: ChapterChip[] = [...chapterCountsMap.entries()]
    .map(([id, v]) => ({ id, title: v.title, count: v.count }))
    .sort((a, b) => a.title.localeCompare(b.title, "he"));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          המאגר שלי
        </p>
        <h1 className="text-3xl font-bold">שאלות שסימנתי</h1>
        <p className="text-sm text-muted-foreground">
          שאלות שסימנת לחזרה — לחיצה תפתח אותן לתרגול חוזר.
        </p>
      </header>

      {bookmarks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">עדיין לא סימנת שאלות.</p>
          <Link
            href="/practice"
            className={cn(buttonVariants({ size: "sm" }), "mt-4")}
          >
            התחל לתרגל
          </Link>
        </div>
      ) : (
        <BookmarksList
          bookmarks={bookmarks}
          chapterCounts={chapterCounts}
          notedIdentitiesArray={[...notedIdentities]}
        />
      )}
    </div>
  );
}
