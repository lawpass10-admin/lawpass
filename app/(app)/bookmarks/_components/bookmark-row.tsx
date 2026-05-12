"use client";

import { Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReviewSession } from "@/app/(app)/practice/_actions";
import type { BookmarkListRow } from "@/lib/db/practice";
import { cn } from "@/lib/utils";

import { removeBookmark } from "../_actions";

/**
 * One bookmark in the /bookmarks list. The whole row is clickable
 * (creates a review session and navigates to /practice/play/0). The
 * trailing X button is a separate target with stopPropagation so it
 * doesn't fire the parent click.
 *
 * Archived bookmarks (where the source/angle row is RLS-hidden) render
 * as a faded, non-clickable card with the "הוסר זמנית" badge.
 */
export function BookmarkRow({
  bookmark,
  onRemoved,
}: {
  bookmark: BookmarkListRow;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [opening, startOpening] = useTransition();

  const isArchived =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.isArchived
      : bookmark.angleQuestion.isArchived;

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (removing) return;
    setRemoving(true);
    onRemoved(bookmark.bookmarkId);
    void (async () => {
      const result = await removeBookmark({ bookmarkId: bookmark.bookmarkId });
      if (!result.ok) {
        toast.error(result.error);
        // No way to "un-remove" from the row's local POV; the parent
        // list owns optimistic state. The next router refresh will
        // restore the row from the server.
        setRemoving(false);
      }
    })();
  }

  function handleOpen() {
    if (isArchived || opening) return;
    startOpening(async () => {
      const result =
        bookmark.questionType === "source"
          ? await createReviewSession({
              questionType: "source",
              sourceQuestionGroupId: bookmark.sourceQuestion.questionGroupId,
            })
          : await createReviewSession({
              questionType: "angle",
              angleQuestionId: bookmark.angleQuestion.id,
            });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div
      role={isArchived ? undefined : "button"}
      tabIndex={isArchived ? -1 : 0}
      aria-disabled={isArchived || undefined}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (isArchived) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        "group relative rounded-lg border bg-background p-4 shadow-sm transition-colors",
        isArchived
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        opening && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <RowHeader bookmark={bookmark} isArchived={isArchived} />
          {!isArchived && (
            <p
              dir="auto"
              className="line-clamp-3 text-sm leading-relaxed text-foreground/85"
            >
              {bookmark.questionType === "source"
                ? bookmark.sourceQuestion.questionText
                : bookmark.angleQuestion.questionText}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="הסר מהסימניות"
          title="הסר מהסימניות"
          onClick={handleRemove}
          disabled={removing}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-destructive/10 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            removing && "opacity-50"
          )}
        >
          {removing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <X className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

function RowHeader({
  bookmark,
  isArchived,
}: {
  bookmark: BookmarkListRow;
  isArchived: boolean;
}) {
  const chapter =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.chapterTitle
      : bookmark.angleQuestion.chapterTitle;
  const subtopic =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.subtopicTitle
      : bookmark.angleQuestion.subtopicTitle;
  const externalId =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.externalId
      : bookmark.angleQuestion.parentSourceExternalId;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {bookmark.questionType === "source" ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
          שאלת מקור
        </span>
      ) : (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          זווית {bookmark.angleQuestion.angleLetter}
        </span>
      )}
      {isArchived ? (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
          הוסר זמנית
        </span>
      ) : (
        <>
          {chapter && (
            <span className="text-muted-foreground">
              {chapter}
              {subtopic && (
                <>
                  <span className="mx-1">/</span>
                  {subtopic}
                </>
              )}
            </span>
          )}
          {externalId && (
            <span
              dir="auto"
              className="font-mono text-[11px] text-muted-foreground/80"
            >
              {externalId}
            </span>
          )}
        </>
      )}
    </div>
  );
}
