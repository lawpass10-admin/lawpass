"use client";

import { Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReviewSession } from "@/app/(app)/practice/_actions";
import type { MistakeListRow } from "@/lib/db/practice";
import { cn } from "@/lib/utils";

import { removeMistake } from "../_actions";

/**
 * Single mistake row in /mistakes. Functionally identical to
 * BookmarkRow except for the small {count} טעות/טעויות badge and the
 * different remove tooltip + action. Kept as a separate component
 * rather than a parametrised one — the divergence is small but
 * lives in tight loops (icon labels, copy) where over-abstraction
 * tends to slow PRs.
 */
export function MistakeRow({
  mistake,
  onRemoved,
}: {
  mistake: MistakeListRow;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [opening, startOpening] = useTransition();

  const isArchived =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.isArchived
      : mistake.angleQuestion.isArchived;

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

  const countLabel =
    mistake.mistakesCount >= 2
      ? `${mistake.mistakesCount} טעויות`
      : "טעות אחת";

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
          <RowHeader
            mistake={mistake}
            isArchived={isArchived}
            countLabel={countLabel}
          />
          {!isArchived && (
            <p
              dir="auto"
              className="line-clamp-3 text-sm leading-relaxed text-foreground/85"
            >
              {mistake.questionType === "source"
                ? mistake.sourceQuestion.questionText
                : mistake.angleQuestion.questionText}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="הסר מטעויות"
          title="הסר מטעויות"
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
  mistake,
  isArchived,
  countLabel,
}: {
  mistake: MistakeListRow;
  isArchived: boolean;
  countLabel: string;
}) {
  const chapter =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.chapterTitle
      : mistake.angleQuestion.chapterTitle;
  const subtopic =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.subtopicTitle
      : mistake.angleQuestion.subtopicTitle;
  const externalId =
    mistake.questionType === "source"
      ? mistake.sourceQuestion.externalId
      : mistake.angleQuestion.parentSourceExternalId;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {mistake.questionType === "source" ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
          שאלת מקור
        </span>
      ) : (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          זווית {mistake.angleQuestion.angleLetter}
        </span>
      )}
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
        {countLabel}
      </span>
      {isArchived ? (
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
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
