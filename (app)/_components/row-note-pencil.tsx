/**
 * Slice 27 — shared "pencil + note editor" trigger for the
 * bookmarks + mistakes list rows. Mirrors the Slice 25 B-1
 * NoteTriggerButton's visual idiom (gold accent + filled when a
 * note already exists) AND lazy-loads the editor sheet on first
 * open (TipTap stays out of the list pages' initial chunks).
 *
 * Flow on click:
 *   1. setLoading(true)
 *   2. server action `loadNoteByIdentity({ identity })`
 *   3. mount <NoteEditorSheet> with the loaded note + a save
 *      callback that writes via `saveNoteFromBank` (same
 *      identity, same triple)
 *
 * `disabled` covers archived rows (no resolvable identity) — the
 * pencil is dimmed and click is a no-op.
 */

"use client";

import { Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import {
  loadNoteByIdentity,
  saveNoteFromBank,
} from "@/app/(app)/notes/_actions";
import type { NoteSavePayload } from "@/app/(app)/_components/note-editor-sheet";
import { cn } from "@/lib/utils";

const NoteEditorSheet = dynamic(
  () =>
    import("@/app/(app)/_components/note-editor-sheet").then(
      (m) => m.NoteEditorSheet
    ),
  { ssr: false }
);

type NoteIdentityPayload = {
  questionType: "source" | "angle";
  sourceQuestionGroupId: string;
  /** Null for source notes; 1..5 for angle notes. */
  anglePosition: number | null;
};

type LoadedNote = {
  contentJson: unknown;
  contentHtml: string;
  updatedAt: string;
};

type RowNotePencilProps = {
  /** Note's stored identity — must be derivable from the list row.
   *  For ANGLE rows: parent's question_group_id + angle's
   *  display_order. For SOURCE rows: questionGroupId + null. */
  identity: NoteIdentityPayload;
  /** True when the user already has a note for this identity
   *  (driven by the server-side `getNotedIdentities` set). */
  initiallyHasNote: boolean;
  /** True for archived rows where the identity isn't derivable;
   *  trigger renders disabled. */
  disabled?: boolean;
  /** Hebrew label shown in the editor sheet header. */
  questionContextLabel: string;
};

export function RowNotePencil({
  identity,
  initiallyHasNote,
  disabled,
  questionContextLabel,
}: RowNotePencilProps) {
  const [hasNote, setHasNote] = useState(initiallyHasNote);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadedNote, setLoadedNote] = useState<LoadedNote | null>(null);

  async function handleClick(e: React.MouseEvent): Promise<void> {
    // The pencil sits inside a row that may itself be a Link /
    // clickable; swallow the bubble so opening the editor doesn't
    // navigate away.
    e.stopPropagation();
    e.preventDefault();
    if (disabled || loading) return;

    setLoading(true);
    const result = await loadNoteByIdentity(identity);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLoadedNote(result.note);
    setSheetOpen(true);
  }

  async function handleSave(payload: NoteSavePayload) {
    const result = await saveNoteFromBank({
      questionType: identity.questionType,
      sourceQuestionGroupId: identity.sourceQuestionGroupId,
      anglePosition: identity.anglePosition,
      contentJson: payload.contentJson,
      contentHtml: payload.contentHtml,
    });
    if (result.ok) setHasNote(true);
    return result;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        title="הערה אישית"
        aria-label="הערה אישית"
        aria-pressed={hasNote}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-colors",
          "hover:border-[var(--color-gold)]/60 hover:bg-[var(--color-gold-tint)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          (disabled || loading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <Pencil
          className={cn(
            "size-4",
            hasNote
              ? "fill-[var(--color-gold)] text-[var(--color-gold-deep)]"
              : "text-foreground"
          )}
          aria-hidden
        />
      </button>

      {sheetOpen ? (
        <NoteEditorSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          questionContextLabel={questionContextLabel}
          initialNote={loadedNote}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}
