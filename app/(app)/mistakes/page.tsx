import Link from "next/link";
import { redirect } from "next/navigation";

import type { ChapterChip } from "@/components/practice/chapter-filter-chips";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getNotedIdentities } from "@/lib/db/notes";
import { getUserMistakes } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { MistakesList } from "./_components/mistakes-list";

/**
 * /mistakes — Server Component. Mirrors /bookmarks: lists the user's
 * non-removed mistakes (sorted by last_mistake_at DESC at the helper
 * level), computes per-chapter chip counts, hands both to the client.
 */
export default async function MistakesPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();
  if (!user) redirect("/login");

  // Slice 27 — fetch noted-identity set in parallel; drives the
  // per-row pencil-filled state on the mistakes list.
  const [mistakes, notedIdentities] = await Promise.all([
    getUserMistakes(supabase, user.id),
    getNotedIdentities(supabase, user.id),
  ]);

  const chapterCountsMap = new Map<string, { title: string; count: number }>();
  for (const m of mistakes) {
    const preview =
      m.questionType === "source" ? m.sourceQuestion : m.angleQuestion;
    if (!preview.chapterId) continue;
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
        <h1 className="text-3xl font-bold">שאלות שטעיתי בהן</h1>
        <p className="text-sm text-muted-foreground">
          שאלות שענית עליהן לא נכון — לחיצה תפתח אותן לתרגול חוזר.
        </p>
      </header>

      {mistakes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            עוד לא ענית על שאלות שגוי. נהדר!
          </p>
          <Link
            href="/practice"
            className={cn(buttonVariants({ size: "sm" }), "mt-4")}
          >
            המשך לתרגל
          </Link>
        </div>
      ) : (
        <MistakesList
          mistakes={mistakes}
          chapterCounts={chapterCounts}
          notedIdentitiesArray={[...notedIdentities]}
        />
      )}
    </div>
  );
}
