"use client";

import { ChevronLeft, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RowNotePencil } from "@/app/(app)/_components/row-note-pencil";
import { createReviewSession } from "@/app/(app)/practice/_actions";
import type { MistakeListRow } from "@/lib/db/practice";
import { formatHebrewDateShort } from "@/lib/format/hebrew-date";
import { cn } from "@/lib/utils";

import { removeMistake } from "../_actions";

/**
 * One mistake in the /mistakes list, Phase 5 layout. Mirrors
 * BookmarkRow with two differences:
 *   - icon is a red X (soft-remove via manually_removed=true)
 *   - date column shows the last-mistake date (most recent error,
 *     more relevant than first time)
 */
export function MistakeRow({
  mistake,
  onRemoved,
  hasNote,
}: {
  mistake: MistakeListRow;
  onRemoved: (id: string) => void;
  /** Slice 27 — server-side flag from the page's notedIdentities
   *  set. */
  hasNote: boolean;
}) {
  const [removing, setRemoving] = useState(false);
  const [opening, startOpening] = useTransition();

  const isArchived =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.isArchived
      : mistake.angleQuestion.isArchived;

  const chapterTitle =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.chapterTitle
      : mistake.angleQuestion.chapterTitle;
  const subtopicTitle =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.subtopicTitle
      : mistake.angleQuestion.subtopicTitle;
  const preview =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.questionText
      : mistake.angleQuestion.questionText;
  const dateLabel = formatHebrewDateShort(mistake.lastMistakeAt);

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (removing) return;
    setRemoving(true);
    onRemoved(mistake.mistakeId);
    void (async () => {
      const result = await removeMistake({ mistakeId: mistake.mistakeId });
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
        mistake.questionType === "source"
          ? await createReviewSession({
              questionType: "source",
              sourceQuestionGroupId: mistake.sourceQuestion.questionGroupId,
            })
          : await createReviewSession({
              questionType: "angle",
              angleQuestionId: mistake.angleQuestion.id,
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
            preview-text conditional above (~L32-50) still branches on
            questionType to pick which question's text to show; only
            the visible badge is removed. */}
      </div>

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

      <div className="flex shrink-0 items-center gap-2">
        {/* Slice 27 — note pencil. Same derivation rules as the
            bookmarks row. */}
        {(() => {
          if (mistake.questionType === "source") {
            const groupId = mistake.sourceQuestion.questionGroupId;
            return (
              <RowNotePencil
                identity={{
                  questionType: "source",
                  sourceQuestionGroupId: groupId,
                  anglePosition: null,
                }}
                initiallyHasNote={hasNote}
                disabled={isArchived || !groupId}
                questionContextLabel={chapterTitle || "הערה אישית"}
              />
            );
          }
          const parentGroupId =
            mistake.angleQuestion.parentQuestionGroupId;
          const displayOrder = mistake.angleQuestion.displayOrder;
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
          aria-label="הסר מטעויות"
          title="הסר מטעויות"
          onClick={handleRemove}
          disabled={removing}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-destructive transition-colors",
            "hover:bg-destructive/10",
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
