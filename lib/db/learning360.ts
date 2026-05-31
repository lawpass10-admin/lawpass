/**
 * Slice 21 — shared module for the per-question review payload used
 * by both the exam-results page and the practice-summary page.
 *
 * Lifted verbatim from `lib/db/exam.ts`:
 *   - `SOURCE_SELECT_FULL` / `ANGLE_SELECT_FULL` column constants
 *     (previously L444/L452)
 *   - `Learning360Payload` type (previously L771)
 *   - `Learning360FieldsOnly` type (previously L1187)
 *   - `resolveChoicesForList` (previously L1068)
 *   - `resolveLearning360ForList` (previously L1189)
 *
 * The two resolvers accept a generic `Learning360Item` shape rather
 * than the exam-specific `ExamQuestionListItem` — both `ExamQuestionListItem`
 * AND the practice-side equivalents satisfy it structurally, so the
 * exam aggregate can pass its own list type and the practice
 * aggregate can pass a list it builds from `practice_sessions.question_list`.
 *
 * No behavior change vs. Slice 17 B-2: the SQL projections, the
 * `Promise.all` shape, the result-Map keys, the archived-RLS branch
 * (item omitted from Map), and the `correctChoice` derivation
 * downstream are all preserved verbatim. The exam aggregate now
 * imports these from here; everything observable at /exam/results is
 * unchanged.
 */

import type { Choice, Source360 } from "@/lib/db/practice";
import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// SELECT column lists
// =============================================================================

export const SOURCE_SELECT_FULL = `
  id, question_group_id, external_id, question_text, chapter_id, subtopic_id,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

export const ANGLE_SELECT_FULL = `
  id, source_question_id, angle_letter, angle_title, display_order, question_text,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list
`;

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal input shape for the batched resolvers below. Both
 * `ExamQuestionListItem` and the practice-side list items satisfy
 * this structurally.
 */
export type Learning360Item = {
  question_type: "source" | "angle";
  question_id: string;
};

/**
 * The full 360° payload the panel-mount path needs. The 7 × 360°
 * fields come straight from `source_questions` / `angle_questions`;
 * `correctChoice` is server-derived via `choices.find(c => c.is_correct)`
 * by the aggregate (not by this module), so the client never has to
 * scan the choices array a second time.
 *
 * `correctChoice` is nullable as a defensive fallback for archived
 * rows: if a question was active at session-creation time but RLS
 * hid it before results render, the choices come back empty and we
 * have nothing to mark "correct". The component null-guards the
 * panel render in that branch.
 */
export type Learning360Payload = Source360 & {
  correctChoice: Choice | null;
};

/**
 * Intermediate shape returned by `resolveLearning360ForList` — just
 * the 7 × 360° fields. Aggregates combine this with the choice list
 * (from `resolveChoicesForList`) to produce a full `Learning360Payload`.
 */
export type Learning360FieldsOnly = Source360;

// =============================================================================
// Internal helper — narrow jsonb arrays defensively
// =============================================================================

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// =============================================================================
// resolveChoicesForList — batched choice fetch
// =============================================================================

/**
 * Slice 7.6 — fetch all choices for every question in `questionList`,
 * returning a Map keyed by `${question_type}:${question_id}` whose
 * value is the choice list sorted by `display_order`. Powers the
 * per-question expansion on the exam-results page (4 choices + their
 * distractor analyses).
 *
 * Two parallel `.in()` queries — one for source_choices, one for
 * angle_choices. Both tables are RLS-gated by the parent question's
 * active+is_current status, which holds for any question the user
 * actually attempted in the session.
 *
 * Slice 17 B-2 — widened to return the full `Choice` shape (adds
 * `id`, uses snake_case throughout) so the same payload feeds both
 * the choice-row renderer and `<Learning360Panel>`'s distractor
 * table. Removes the prior `ExamReviewChoice` camelCase projection.
 *
 * Slice 21 — moved to this shared module so practice-summary can
 * reuse it.
 */
export async function resolveChoicesForList(
  supabase: SupabaseSsrClient,
  questionList: Learning360Item[]
): Promise<Map<string, Choice[]>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of questionList) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const [sourceRes, angleRes] = await Promise.all([
    sourceIds.length > 0
      ? supabase
          .from("source_choices")
          .select(
            "id, source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order"
          )
          .in("source_question_id", sourceIds)
      : Promise.resolve({ data: null as unknown }),
    angleIds.length > 0
      ? supabase
          .from("angle_choices")
          .select(
            "id, angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order"
          )
          .in("angle_question_id", angleIds)
      : Promise.resolve({ data: null as unknown }),
  ]);

  const map = new Map<string, Choice[]>();
  function pushChoice(
    key: string,
    row: {
      id: string;
      letter: string;
      choice_text: string;
      is_correct: boolean;
      distractor_analysis: string | null;
      display_order: number;
    }
  ): void {
    if (
      row.letter !== "א" &&
      row.letter !== "ב" &&
      row.letter !== "ג" &&
      row.letter !== "ד"
    ) {
      return;
    }
    const choice: Choice = {
      id: row.id,
      letter: row.letter,
      choice_text: row.choice_text,
      is_correct: row.is_correct,
      distractor_analysis: row.distractor_analysis,
      display_order: row.display_order,
    };
    const arr = map.get(key) ?? [];
    arr.push(choice);
    map.set(key, arr);
  }

  for (const row of (sourceRes.data ?? []) as Array<{
    id: string;
    source_question_id: string;
    letter: string;
    choice_text: string;
    is_correct: boolean;
    distractor_analysis: string | null;
    display_order: number;
  }>) {
    pushChoice(`source:${row.source_question_id}`, row);
  }
  for (const row of (angleRes.data ?? []) as Array<{
    id: string;
    angle_question_id: string;
    letter: string;
    choice_text: string;
    is_correct: boolean;
    distractor_analysis: string | null;
    display_order: number;
  }>) {
    pushChoice(`angle:${row.angle_question_id}`, row);
  }

  // Sort each bucket by display_order so the renderer can render
  // א/ב/ג/ד in their canonical order regardless of insert order.
  for (const list of map.values()) {
    list.sort((a, b) => a.display_order - b.display_order);
  }
  return map;
}

// =============================================================================
// resolveLearning360ForList — batched 360° payload fetch
// =============================================================================

/**
 * Slice 17 B-2 — fetch the 7 × 360° fields for every question in
 * `questionList`. Powers the inline `<Learning360Panel>` rendered
 * below the choice rows on the exam-results page (and, Slice 21, the
 * practice-summary page).
 *
 * Strategy mirrors `resolveChoicesForList`:
 *   - Two parallel `.in()` queries, one against `source_questions` and
 *     one against `angle_questions`, using the `SOURCE_SELECT_FULL` /
 *     `ANGLE_SELECT_FULL` column lists. Those constants already
 *     enumerate the 7 × 360° fields.
 *   - Returns a Map keyed by `${question_type}:${question_id}` whose
 *     value is the 7 × 360° payload. `correctChoice` is NOT computed
 *     here — the aggregate merges it in once choices are available
 *     from `resolveChoicesForList`, which runs in the same `Promise.all`.
 *
 * RLS: source_questions / angle_questions are gated by status='active'
 * AND is_current=true for normal callers. Any question RLS-hides
 * mid-flight (rare) simply doesn't appear in the result Map and the
 * aggregate's enrichment loop maps that row's `learning` field to null.
 */
export async function resolveLearning360ForList(
  supabase: SupabaseSsrClient,
  questionList: Learning360Item[]
): Promise<Map<string, Learning360FieldsOnly>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of questionList) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const [sourceRes, angleRes] = await Promise.all([
    sourceIds.length > 0
      ? supabase
          .from("source_questions")
          .select(SOURCE_SELECT_FULL)
          .in("id", sourceIds)
      : Promise.resolve({ data: null as unknown }),
    angleIds.length > 0
      ? supabase
          .from("angle_questions")
          .select(ANGLE_SELECT_FULL)
          .in("id", angleIds)
      : Promise.resolve({ data: null as unknown }),
  ]);

  const map = new Map<string, Learning360FieldsOnly>();

  type Raw360Row = {
    id: string;
    legal_topic_analysis: string | null;
    full_explanation: string | null;
    common_pitfall: string | null;
    concepts_and_skills: unknown;
    quick_thinking_360: string | null;
    summary_for_memory: string | null;
    references_list: unknown;
  };

  function project(row: Raw360Row): Learning360FieldsOnly {
    return {
      legal_topic_analysis: row.legal_topic_analysis ?? "",
      full_explanation: row.full_explanation ?? "",
      common_pitfall: row.common_pitfall ?? "",
      concepts_and_skills: toStringArray(row.concepts_and_skills),
      quick_thinking_360: row.quick_thinking_360 ?? "",
      summary_for_memory: row.summary_for_memory ?? "",
      references_list: toStringArray(row.references_list),
    };
  }

  for (const row of (sourceRes.data ?? []) as Raw360Row[]) {
    map.set(`source:${row.id}`, project(row));
  }
  for (const row of (angleRes.data ?? []) as Raw360Row[]) {
    map.set(`angle:${row.id}`, project(row));
  }
  return map;
}
