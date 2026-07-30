"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createBatchReviewSession } from "@/lib/api/practice";
import { Button } from "@/components/ui/button";

type Props = {
  source: "bookmarks" | "mistakes";
  /** Active client-side chapter filter, if any. Forwarded into the
   * Server Action so the resulting batch session matches what the user
   * currently sees in the filtered list. */
  chapterIdFilter: string | null;
  /** Number of items currently in scope (post-filter). Used to hide the
   * button when the scope is empty and disable it during loading. */
  totalInScope: number;
};

/**
 * "תרגל את כולן" CTA. Sits at the top of the /bookmarks and /mistakes
 * pages above the title block (matches the prototype's top-left visual
 * placement, which is RTL natural-end). Fires createBatchReviewSession
 * with the current filter state, then does a full-page navigation so
 * the new practice_session's first question renders fresh.
 *
 * If the scoped count is 0 (after filter), the button hides entirely
 * rather than showing a disabled state — the user has nothing to
 * practice and we don't want to suggest otherwise.
 */
export function BatchPracticeButton({
  source,
  chapterIdFilter,
  totalInScope,
}: Props) {
  const [loading, setLoading] = useState(false);

  if (totalInScope === 0) return null;

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    const result = await createBatchReviewSession({
      source,
      chapterIdFilter: chapterIdFilter ?? undefined,
    });
    if (!result.ok) {
      toast.error(
        result.error === "empty_list"
          ? "אין שאלות זמינות לתרגול"
          : "שגיאה — נסה שוב"
      );
      setLoading(false);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleClick}
      disabled={loading}
    >
      <span>{loading ? "מכין סשן..." : "תרגל את כולן"}</span>
      {!loading && <Play className="ms-2 size-4" aria-hidden />}
    </Button>
  );
}
