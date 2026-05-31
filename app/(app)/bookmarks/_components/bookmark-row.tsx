"use client";

import { Bookmark, ChevronLeft, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RowNotePencil } from "@/app/(app)/_components/row-note-pencil";
import { createReviewSession } from "@/app/(app)/practice/_actions";
import type { BookmarkListRow } from "@/lib/db/practice";
import { formatHebrewDateShort } from "@/lib/format/hebrew-date";
import { cn } from "@/lib/utils";

import { removeBookmark } from "../_actions";

/**
 * One bookmark in the /bookmarks list, Phase 5 layout. Three clusters:
 *   - RTL-start: chapter title + subtopic chip + type chip
 *   - center:    truncated question preview (or "הוסר זמנית" badge)
 *   - RTL-end:   bookmark-icon remove button + date + chevron
 *
 * Whole row is a button for keyboard activation; the bookmark icon is
 * a child button with stopPropagation so it doesn't double-fire.
 * Archived bookmarks render with the row click disabled and chevron
 * hidden, but the icon button still works (so the user can clean up
 * orphan bookmarks for questions whose content got pulled).
 */
export function BookmarkRow({
  bookmark,
  onRemoved,
  hasNote,
}: {
  bookmark: BookmarkListRow;
  onRemoved: (id: string) => void;
  /** Slice 27 — server-side flag from the page's notedIdentities
   *  set. Drives the pencil-fill state without an additional
   *  per-row round-trip. */
  hasNote: boolean;
}) {
  const [removing, setRemoving] = useState(false);
  const [opening, startOpening] = useTransition();

  const isArchived =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.isArchived
      : bookmark.angleQuestion.isArchived;

  const chapterTitle =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.chapterTitle
      : bookmark.angleQuestion.chapterTitle;
  const subtopicTitle =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.subtopicTitle
      : bookmark.angleQuestion.subtopicTitle;
  const preview =
    bookmark.questionType === "source"
      ? bookmark.sourceQuestion.questionText
      : bookmark.angleQuestion.questionText;
  const dateLabel = formatHebrewDateShort(bookmark.createdAt);

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (removing) return;
    setRemoving(true);
    onRemoved(bookmark.bookmarkId);
    void (async () => {
      const result = await removeBookmark({ bookmarkId: bookmark.bookmarkId });
      if (!result.ok) {
        toast.error(result.error);
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
        "flex items-center gap-3 rounded-lg border bg-background p-3 shadow-sm transition-colors",
        isArchived
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        opening && "opacity-70"
      )}
    >
      {/* RTL-start cluster: tags */}
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {chapterTitle && (
          <span className="text-sm text-muted-foreground" dir="auto">
            {chapterTitle}
          </span>
        )}
        {subtopicTitle && (
          <span
            dir="auto"
            className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/75"
          >
            {subtopicTitle}
          </span>
        )}
        {/* Slice 18 — the source/angle badge previously rendered here
            (white-bg "מקור" / "זווית X") is hidden from the user. The
            preview-text conditional above (~L37-50) still branches on
            questionType to pick which question's text to show; only
            the visible badge is removed. */}
      </div>

      {/* CENTER: preview */}
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isArchived ? "" : "text-foreground/85"
        )}
        dir="auto"
      >
        {isArchived ? (
          <span className="font-medium text-destructive">הוסר זמנית</span>
        ) : (
          preview
        )}
      </p>

      {/* RTL-end cluster: pencil, bookmark-remove, date, chevron */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Slice 27 — note pencil. Click opens the shared editor
            sheet for THIS question (identity derived from the
            stored bookmark row). Disabled for archived rows where
            the note identity can't be resolved. */}
        {(() => {
          if (bookmark.questionType === "source") {
            const groupId = bookmark.sourceQuestion.questionGroupId;
            return (
              <RowNotePencil
                identity={{
                  questionType: "source",
                  sourceQuestionGroupId: groupId,
                  anglePosition: null,
                }}
                initiallyHasNote={hasNote}
                disabled={isArchived || !groupId}
                questionContextLabel={
                  chapterTitle || "הערה אישית"
                }
              />
            );
          }
          const parentGroupId =
            bookmark.angleQuestion.parentQuestionGroupId;
          const displayOrder = bookmark.angleQuestion.displayOrder;
          return (
            <RowNotePencil
              identity={{
                questionType: "angle",
                sourceQuestionGroupId: parentGroupId,
                anglePosition: displayOrder,
              }}
              initiallyHasNote={hasNote}
              disabled={
                isArchived || !parentGroupId || displayOrder === null
              }
              questionContextLabel={chapterTitle || "הערה אישית"}
            />
          );
        })()}
        <button
          type="button"
          aria-label="הסר מהסימניות"
          title="הסר מהסימניות"
          onClick={handleRemove}
          disabled={removing}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-amber-500 transition-colors",
            "hover:bg-amber-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            removing && "opacity-50"
          )}
        >
          {removing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Bookmark className="size-4 fill-current" aria-hidden />
          )}
        </button>
        {dateLabel && (
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        )}
        {!isArchived && (
          <ChevronLeft
            className="size-4 text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
