/**
 * Slice 26 — Notes bank ("/notes").
 *
 * Server component. Mirrors the bookmarks/mistakes list-page
 * architecture: auth gate → resolve list rows server-side →
 * pre-fetch the per-question 360 + choices payload via the shared
 * Slice 17 B-2 resolvers → hand off to a client list component.
 *
 * Empty state is the rendered fallback when the user has no notes
 * (or every note resolves to an archived question).
 */

import { Pencil } from "lucide-react";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  type Learning360Item,
  resolveChoicesForList,
  resolveLearning360ForList,
} from "@/lib/db/learning360";
import { getUserNotes } from "@/lib/db/notes";
import { createClient } from "@/lib/supabase/server";

import { NotesList } from "./_components/notes-list";

export default async function NotesPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const notes = await getUserNotes(supabase, user.id);

  // Build the resolver item list from the resolved current question
  // ids. Notes whose underlying question was archived (questionId
  // null) are excluded from the resolver fan-out — the per-row
  // archived branch renders without the 360 panel.
  const learningItems: Learning360Item[] = [];
  for (const n of notes) {
    if (n.questionId) {
      learningItems.push({
        question_type: n.questionType,
        question_id: n.questionId,
      });
    }
  }

  // Pre-fetch 360 + choices in parallel. Mirrors the exam-results
  // aggregate's Promise.all shape. Empty list = no DB calls (the
  // resolvers short-circuit).
  const [choicesByItem, learning360ByItem] = await Promise.all([
    resolveChoicesForList(supabase, learningItems),
    resolveLearning360ForList(supabase, learningItems),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold-tint)] px-3 py-1 text-xs font-semibold text-[var(--color-gold-deep)]">
          <Pencil className="size-3.5" aria-hidden />
          הערות אישיות
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ההערות שלי
        </h1>
        <p className="text-sm text-muted-foreground">
          כל ההערות שכתבת על שאלות, ממוינות לפי השאלה האחרונה שערכת.
        </p>
      </header>

      <NotesList
        notes={notes}
        choicesByItem={mapToPlainObject(choicesByItem)}
        learning360ByItem={mapToPlainObject(learning360ByItem)}
      />
    </div>
  );
}

// Server → client component handoff: client components can't accept
// Map instances as props (they aren't serializable). Project to a
// plain object keyed by the same `${type}:${id}` strings the
// resolvers use.
function mapToPlainObject<T>(m: Map<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of m) out[k] = v;
  return out;
}
