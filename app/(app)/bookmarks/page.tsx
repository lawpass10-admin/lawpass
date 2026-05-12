import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getUserBookmarks } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { BookmarksList } from "./_components/bookmarks-list";

/**
 * /bookmarks — Slice 2 Phase 4. Server Component listing the user's
 * active bookmarks (newest first). Clicking a row creates a single-
 * question review session and redirects to /practice/play/0.
 *
 * Empty + archived states are handled by the underlying list component:
 *   - 0 bookmarks → Hebrew empty state + CTA to /practice
 *   - bookmarked question RLS-hidden (status=archived or is_current=false)
 *     → row renders as "הוסר זמנית" badge, non-clickable
 */
export default async function BookmarksPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  // Defensive — requireActiveSubscription already exited if user is null,
  // but TypeScript narrows nothing here; keep the explicit guard.
  if (!user) redirect("/login");

  const bookmarks = await getUserBookmarks(supabase, user.id);

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
        <BookmarksList bookmarks={bookmarks} />
      )}
    </div>
  );
}
