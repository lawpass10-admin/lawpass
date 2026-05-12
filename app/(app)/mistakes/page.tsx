import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getUserMistakes } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { MistakesList } from "./_components/mistakes-list";

/**
 * /mistakes — Slice 2 Phase 4. Server Component listing questions the
 * user has answered incorrectly (sorted by most-recent mistake first).
 * `manually_removed = true` rows are filtered out by the loader; the
 * record stays in the DB so analytics remains intact and the row can
 * resurface via record_mistake() if the user re-misses the same Q.
 */
export default async function MistakesPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  if (!user) redirect("/login");

  const mistakes = await getUserMistakes(supabase, user.id);

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
        <MistakesList mistakes={mistakes} />
      )}
    </div>
  );
}
