"use client";

/**
 * Slice 26 — Notes-bank list. Renders the empty state when the
 * user has no notes; otherwise an ordered list (updated_at DESC,
 * as returned by `getUserNotes`).
 */

import { Pencil } from "lucide-react";

import type { Choice } from "@/lib/db/practice";
import type { Learning360FieldsOnly } from "@/lib/db/learning360";
import type { NoteListItem } from "@/lib/db/notes";

import { NoteRow } from "./note-row";

type NotesListProps = {
  notes: NoteListItem[];
  /** Per-question choice list, keyed by `${question_type}:${question_id}`. */
  choicesByItem: Record<string, Choice[]>;
  /** Per-question 360° fields payload, same key shape. */
  learning360ByItem: Record<string, Learning360FieldsOnly>;
};

export function NotesList({
  notes,
  choicesByItem,
  learning360ByItem,
}: NotesListProps) {
  if (notes.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Pencil className="size-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          עדיין אין לך הערות
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          תוכל לכתוב הערה אישית על שאלה כשהיא פתוחה לפניך — לחץ על
          סמל העיפרון בראש המסך.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <ul>
        {notes.map((note, idx) => {
          const isLast = idx === notes.length - 1;
          const key =
            note.questionId !== null
              ? `${note.questionType}:${note.questionId}`
              : null;
          const choices = key ? (choicesByItem[key] ?? []) : [];
          const learning360 = key ? learning360ByItem[key] : undefined;
          return (
            <li
              key={note.noteId}
              className={
                isLast ? undefined : "border-b border-border/70"
              }
            >
              <NoteRow
                note={note}
                choices={choices}
                learning360={learning360}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
