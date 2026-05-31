"use client";

/**
 * Slice 26 — One row in the notes bank.
 *
 * Collapsed: chapter + excerpt of the note content + last-updated.
 * Expanded: question text + ChoiceAnalysisRow per choice +
 * Learning360Panel + a read-only preview of the saved note HTML +
 * a button that opens the editor (the same lazy-loaded sheet the
 * practice play screen uses, with the bank's save callback wired up).
 *
 * The Learning360Panel + ChoiceAnalysisRow are reused verbatim from
 * the Slice 19/21 shared components.
 */

import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { ChoiceAnalysisRow } from "@/app/(app)/_components/choice-analysis-row";
import { saveNoteFromBank } from "@/app/(app)/notes/_actions";
import { Learning360Panel } from "@/app/(app)/practice/play/_components/learning-360-panel";
import { Button } from "@/components/ui/button";
import type { Learning360FieldsOnly } from "@/lib/db/learning360";
import type { NoteListItem } from "@/lib/db/notes";
import type { Choice } from "@/lib/db/practice";
import { cn } from "@/lib/utils";

// Same lazy-load pattern the practice play screen uses — TipTap +
// the editor sheet only download once the user opens the editor for
// the first time on this page.
const NoteEditorSheet = dynamic(
  () =>
    import("@/app/(app)/_components/note-editor-sheet").then(
      (m) => m.NoteEditorSheet
    ),
  { ssr: false }
);

type NoteRowProps = {
  note: NoteListItem;
  choices: Choice[];
  learning360: Learning360FieldsOnly | undefined;
};

const FMT = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function NoteRow({ note, choices, learning360 }: NoteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  // After a save, the editor's onClose callback bumps this so the
  // preview re-renders with the new HTML without forcing a route
  // refresh. The `live` shape lets us also flip the saved indicator
  // on subsequent re-opens.
  const [live, setLive] = useState<{
    contentHtml: string;
    contentJson: unknown;
  }>({ contentHtml: note.contentHtml, contentJson: note.contentJson });

  // Slice 26 — the bank knows the note's stored identity (loaded
  // server-side), so the save action takes that triple directly
  // rather than re-deriving from a (sessionId, position) pair that
  // doesn't exist here.
  const handleSave = async ({
    contentJson,
    contentHtml,
  }: {
    contentJson: unknown;
    contentHtml: string;
  }) => {
    const result = await saveNoteFromBank({
      questionType: note.questionType,
      sourceQuestionGroupId: note.sourceQuestionGroupId,
      anglePosition: note.anglePosition,
      contentJson,
      contentHtml,
    });
    if (result.ok) {
      // Mirror the saved HTML into the row's local preview so a
      // close → reopen shows the latest content even before the
      // next route revalidation lands.
      setLive({ contentHtml, contentJson });
    }
    return result;
  };

  // Optional 360 detail — only mounted when not archived AND we have
  // the resolver payload + a correct-choice we can derive server-side.
  const correctChoice = choices.find((c) => c.is_correct) ?? null;
  const canShowPanel =
    !note.isArchived && learning360 !== undefined && correctChoice !== null;

  return (
    <>
      {/* Collapsed row — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 text-start text-sm transition-colors",
          "hover:bg-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        <div className="min-w-0 space-y-1">
          {note.chapterTitle ? (
            <div
              dir="auto"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              {note.chapterTitle}
              {note.isArchived ? " · הוסר זמנית" : ""}
            </div>
          ) : null}
          <div
            dir="auto"
            className="line-clamp-1 text-foreground/90"
          >
            {note.excerpt || "—"}
          </div>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {FMT.format(new Date(note.updatedAt))}
        </span>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown
            className="size-4 text-muted-foreground"
            aria-hidden
          />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
          {/* Question text */}
          {note.questionText ? (
            <p
              dir="auto"
              className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
            >
              {note.questionText}
            </p>
          ) : note.isArchived ? (
            <p className="mb-3 text-sm text-muted-foreground">
              השאלה הוסרה זמנית מהמערכת.
            </p>
          ) : null}

          {/* Choice rows — same component as exam-results + practice-summary */}
          {choices.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {choices.map((choice) => (
                <li key={choice.letter}>
                  <ChoiceAnalysisRow
                    choice={choice}
                    selectedLetter={null}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {/* Note preview — read-only render of the saved HTML.
              We rely on the same `.note-editor-content` scoping
              class so the preview matches the editor's rendering. */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  ההערה שלי
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(true)}
              >
                <Pencil className="size-3.5" aria-hidden />
                <span className="ms-1.5">ערוך הערה</span>
              </Button>
            </header>
            {live.contentHtml ? (
              <div
                dir="rtl"
                className="note-editor-content font-heebo text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: live.contentHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                אין תוכן בהערה. לחץ &quot;ערוך הערה&quot; כדי להתחיל לכתוב.
              </p>
            )}
          </section>

          {/* 360 panel — only when not archived */}
          {canShowPanel ? (
            <div className="mt-4">
              <Learning360Panel
                question={{ ...learning360!, choices }}
                correctChoice={correctChoice!}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {editorOpen ? (
        <NoteEditorSheet
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          questionContextLabel={
            note.chapterTitle ||
            (note.isArchived ? "השאלה הוסרה זמנית" : "הערה אישית")
          }
          initialNote={{
            contentJson: live.contentJson,
            contentHtml: live.contentHtml,
            updatedAt: note.updatedAt,
          }}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}
