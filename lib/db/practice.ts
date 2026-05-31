/**
 * Shared DB query helpers for the Phase 3 practice flow. Server-only —
 * always invoked from Server Components or Server Actions with the SSR
 * Supabase client. Never uses the admin client; every read goes through
 * RLS, which is why archived questions surface as a distinct
 * `{kind:"archived"}` state rather than just "missing".
 *
 * Caller is responsible for `requireActiveSubscription()` before invoking
 * any of these. None of the helpers re-check subscription — they rely
 * on RLS (`has_active_subscription()`) for defense in depth.
 */

import {
  type Learning360Item,
  type Learning360Payload,
  resolveChoicesForList,
  resolveLearning360ForList,
} from "@/lib/db/learning360";
import type { createClient } from "@/lib/supabase/server";

// Mirrors the SSR client type used everywhere in Slice 1 + Phase 2.
type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// Types
// =============================================================================

export type QuestionListItem =
  | { type: "source"; id: string; position: number }
  | { type: "angle"; id: string; position: number };

export type PracticeSessionRow = {
  id: string;
  user_id: string;
  selected_chapters: string[];
  selected_subtopics: string[];
  source_count_target: number;
  angles_per_source: number;
  time_per_question_seconds: number;
  /** Slice 24 — per-session timer budget. 0 = no timer; remaining
   *  is wall-clock derived from started_at on each play-page render. */
  session_duration_seconds: number;
  question_list: QuestionListItem[];
  status: "active" | "completed" | "abandoned";
  questions_answered: number;
  questions_correct: number;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
};

export type Choice = {
  id: string;
  letter: "א" | "ב" | "ג" | "ד";
  choice_text: string;
  is_correct: boolean;
  distractor_analysis: string | null;
  display_order: number;
};

/**
 * The 7 × 360° fields shared by source_questions and angle_questions.
 * `concepts_and_skills` and `references_list` are jsonb arrays of strings
 * (validated by the seed schema; we don't re-validate at read time).
 *
 * Exported so the exam-results aggregate (Slice 17 B-2) can compose its
 * Learning360Payload from the same shape.
 */
export type Source360 = {
  legal_topic_analysis: string;
  full_explanation: string;
  common_pitfall: string;
  concepts_and_skills: string[];
  quick_thinking_360: string;
  summary_for_memory: string;
  references_list: string[];
};

/**
 * Minimal structural type for `<Learning360Panel>`'s `question` prop.
 * Both `SourceQuestionRow` and `AngleQuestionRow` structurally satisfy
 * this (each is `Source360` + `choices: Choice[]` plus extra metadata
 * the panel doesn't read). Narrowing the panel's prop to this lets the
 * exam-results aggregate pass a minimal payload without dragging
 * chapter_title / subtopic_title / question_group_id / angle_letter /
 * etc. through the wire — none of which the panel reads (Slice 17 B-2).
 */
export type Question360 = Source360 & {
  choices: Choice[];
};

export type SourceQuestionRow = {
  id: string;
  question_group_id: string;
  external_id: string;
  question_text: string;
  chapter_id: string;
  subtopic_id: string;
  chapter_title: string;
  subtopic_title: string;
  choices: Choice[];
} & Source360;

export type AngleQuestionRow = {
  id: string;
  source_question_id: string;
  angle_letter: "א" | "ב" | "ג" | "ד" | "ה";
  angle_title: string | null;
  display_order: number;
  question_text: string;
  choices: Choice[];
} & Source360;

export type ResolvedQuestion =
  | { kind: "source"; question: SourceQuestionRow; session: PracticeSessionRow }
  | {
      kind: "angle";
      question: AngleQuestionRow;
      parentSource: SourceQuestionRow;
      session: PracticeSessionRow;
    }
  | { kind: "archived"; session: PracticeSessionRow; position: number }
  | { kind: "out_of_range"; session: PracticeSessionRow };

export type AttemptRow = {
  id: string;
  question_type: "source" | "angle";
  source_question_id: string | null;
  angle_question_id: string | null;
  selected_choice_id: string | null;
  selected_letter: "א" | "ב" | "ג" | "ד" | null;
  is_correct: boolean | null;
  duration_seconds: number | null;
  was_skipped: boolean;
  attempted_at: string;
};

/**
 * Slice 21 — per-question review row for the practice-summary page,
 * mirroring the shape of `ExamReviewRow` on the exam side. Built by
 * iterating `session.question_list` in position order and joining
 * each item to its attempt (if any).
 *
 * `learning` is `null` when the 360° payload OR the correct choice
 * can't be resolved (archived row): the UI then skips the 360°
 * toggle on that row, same as the exam-results archived branch.
 *
 * Note: there is intentionally no source/angle label on this row —
 * source/angle was removed from the user-facing UI in Slice 18.
 * `questionType` is kept for grouping/debugging only.
 */
export type PracticeReviewRow = {
  position: number;
  questionType: "source" | "angle";
  questionId: string;
  /** Truncated question_text for the collapsed row header. */
  excerpt: string;
  /** Full question_text for the expanded panel. */
  questionText: string;
  choices: Choice[];
  selectedLetter: "א" | "ב" | "ג" | "ד" | null;
  /** True/false when an attempt was recorded; null when none was. */
  isCorrect: boolean | null;
  wasSkipped: boolean;
  /** Pulled from attempts row. Null when no attempt was recorded. */
  attemptedAt: string | null;
  learning: Learning360Payload | null;
};

export type SummaryAggregate = {
  session: PracticeSessionRow;
  totalAnswered: number;
  totalCorrect: number;
  sourceAnswered: number;
  sourceCorrect: number;
  angleAnswered: number;
  angleCorrect: number;
  /** Slice 21 — per-question review in `question_list` position
   *  order. Empty array when question_list is empty (legacy session). */
  byPosition: PracticeReviewRow[];
  byBucket: Array<{
    chapterTitle: string | null;
    subtopicTitle: string | null;
    answered: number;
    correct: number;
  }>;
  archivedSkipped: number;
};

// =============================================================================
// Internal — narrow / parse JSONB columns
// =============================================================================

/**
 * `question_list` is typed as Json by supabase-js. Narrow it defensively;
 * a malformed value is treated as empty (caller redirects to setup).
 */
function parseQuestionList(value: unknown): QuestionListItem[] {
  if (!Array.isArray(value)) return [];
  const out: QuestionListItem[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      "id" in item &&
      "position" in item &&
      (item.type === "source" || item.type === "angle") &&
      typeof item.id === "string" &&
      typeof item.position === "number"
    ) {
      out.push({ type: item.type, id: item.id, position: item.position });
    }
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// =============================================================================
// getResumableSessionForUser — Slice 5 Phase P2
// =============================================================================

/**
 * 24-hour cutoff for silent abandon. A session older than this is
 * treated as stale on the next /practice or /practice/resume visit —
 * flipped to abandoned and the user lands on the builder rather than a
 * resume prompt for a session they no longer remember. Aligned with the
 * dashboard hero card's `HERO_STALE_SESSION_MS`.
 */
const RESUME_STALE_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves the user's resumable active practice session for the
 * /practice and /practice/resume route gates.
 *
 *  - Returns the full session row if an active session exists AND its
 *    `last_activity_at` is within the 24h staleness window.
 *  - If an active session exists but is past the window, silently flips
 *    it to `abandoned` (write side-effect) and returns `null`.
 *  - Returns `null` when no active session exists.
 *
 * The write side-effect is intentional: keeping it inside one helper
 * means /practice and /practice/resume share a single source of truth
 * — neither route renders against a stale row, and the row only gets
 * abandoned once per request.
 */
export async function getResumableSessionForUser(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<PracticeSessionRow | null> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(
      "id, user_id, selected_chapters, selected_subtopics, source_count_target, angles_per_source, time_per_question_seconds, session_duration_seconds, question_list, status, questions_answered, questions_correct, started_at, completed_at, last_activity_at"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const lastActivityMs = new Date(data.last_activity_at).getTime();
  if (Date.now() - lastActivityMs > RESUME_STALE_SESSION_MS) {
    await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return null;
  }

  return {
    id: data.id,
    user_id: data.user_id,
    selected_chapters: asStringArray(data.selected_chapters),
    selected_subtopics: asStringArray(data.selected_subtopics),
    source_count_target: data.source_count_target,
    angles_per_source: data.angles_per_source,
    time_per_question_seconds: data.time_per_question_seconds,
    session_duration_seconds:
      typeof data.session_duration_seconds === "number"
        ? data.session_duration_seconds
        : 0,
    question_list: parseQuestionList(data.question_list),
    status: "active",
    questions_answered: data.questions_answered,
    questions_correct: data.questions_correct,
    started_at: data.started_at,
    completed_at: data.completed_at,
    last_activity_at: data.last_activity_at,
  };
}

// =============================================================================
// getSessionForUser
// =============================================================================

export async function getSessionForUser(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string
): Promise<PracticeSessionRow | null> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(
      "id, user_id, selected_chapters, selected_subtopics, source_count_target, angles_per_source, time_per_question_seconds, session_duration_seconds, question_list, status, questions_answered, questions_correct, started_at, completed_at, last_activity_at"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const status = data.status as PracticeSessionRow["status"];
  if (status !== "active" && status !== "completed" && status !== "abandoned") {
    return null;
  }

  return {
    id: data.id,
    user_id: data.user_id,
    selected_chapters: asStringArray(data.selected_chapters),
    selected_subtopics: asStringArray(data.selected_subtopics),
    source_count_target: data.source_count_target,
    angles_per_source: data.angles_per_source,
    time_per_question_seconds: data.time_per_question_seconds,
    session_duration_seconds:
      typeof data.session_duration_seconds === "number"
        ? data.session_duration_seconds
        : 0,
    question_list: parseQuestionList(data.question_list),
    status,
    questions_answered: data.questions_answered,
    questions_correct: data.questions_correct,
    started_at: data.started_at,
    completed_at: data.completed_at,
    last_activity_at: data.last_activity_at,
  };
}

// =============================================================================
// getQuestionForPosition + helpers
// =============================================================================

const SOURCE_QUESTION_SELECT = `
  id, question_group_id, external_id, question_text, chapter_id, subtopic_id,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_QUESTION_SELECT = `
  id, source_question_id, angle_letter, angle_title, display_order, question_text,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list
`;

const SOURCE_CHOICE_SELECT =
  "id, letter, choice_text, is_correct, distractor_analysis, display_order";
const ANGLE_CHOICE_SELECT = SOURCE_CHOICE_SELECT;

type SourceRow = {
  id: string;
  question_group_id: string;
  external_id: string;
  question_text: string;
  chapter_id: string;
  subtopic_id: string;
  legal_topic_analysis: string;
  full_explanation: string;
  common_pitfall: string;
  concepts_and_skills: unknown;
  quick_thinking_360: string;
  summary_for_memory: string;
  references_list: unknown;
  chapter: { title: string } | { title: string }[] | null;
  subtopic: { title: string } | { title: string }[] | null;
};

type AngleRow = {
  id: string;
  source_question_id: string;
  angle_letter: string;
  angle_title: string | null;
  display_order: number;
  question_text: string;
  legal_topic_analysis: string;
  full_explanation: string;
  common_pitfall: string;
  concepts_and_skills: unknown;
  quick_thinking_360: string;
  summary_for_memory: string;
  references_list: unknown;
};

type ChoiceRow = {
  id: string;
  letter: string;
  choice_text: string;
  is_correct: boolean;
  distractor_analysis: string | null;
  display_order: number;
};

/**
 * Supabase's embedded relation fields are typed as either a single object
 * or an array depending on the FK cardinality. Normalize.
 */
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function isValidLetter(s: string): s is "א" | "ב" | "ג" | "ד" {
  return s === "א" || s === "ב" || s === "ג" || s === "ד";
}

function isValidAngleLetter(
  s: string
): s is "א" | "ב" | "ג" | "ד" | "ה" {
  return isValidLetter(s) || s === "ה";
}

function mapChoices(rows: ChoiceRow[]): Choice[] {
  return rows
    .filter((r): r is ChoiceRow & { letter: "א" | "ב" | "ג" | "ד" } =>
      isValidLetter(r.letter)
    )
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => ({
      id: r.id,
      letter: r.letter,
      choice_text: r.choice_text,
      is_correct: r.is_correct,
      distractor_analysis: r.distractor_analysis,
      display_order: r.display_order,
    }));
}

function mapSource(
  row: SourceRow,
  choices: Choice[]
): SourceQuestionRow {
  const chapter = pickOne(row.chapter);
  const subtopic = pickOne(row.subtopic);
  return {
    id: row.id,
    question_group_id: row.question_group_id,
    external_id: row.external_id,
    question_text: row.question_text,
    chapter_id: row.chapter_id,
    subtopic_id: row.subtopic_id,
    chapter_title: chapter?.title ?? "",
    subtopic_title: subtopic?.title ?? "",
    legal_topic_analysis: row.legal_topic_analysis,
    full_explanation: row.full_explanation,
    common_pitfall: row.common_pitfall,
    concepts_and_skills: asStringArray(row.concepts_and_skills),
    quick_thinking_360: row.quick_thinking_360,
    summary_for_memory: row.summary_for_memory,
    references_list: asStringArray(row.references_list),
    choices,
  };
}

function mapAngle(row: AngleRow, choices: Choice[]): AngleQuestionRow | null {
  if (!isValidAngleLetter(row.angle_letter)) return null;
  return {
    id: row.id,
    source_question_id: row.source_question_id,
    angle_letter: row.angle_letter,
    angle_title: row.angle_title,
    display_order: row.display_order,
    question_text: row.question_text,
    legal_topic_analysis: row.legal_topic_analysis,
    full_explanation: row.full_explanation,
    common_pitfall: row.common_pitfall,
    concepts_and_skills: asStringArray(row.concepts_and_skills),
    quick_thinking_360: row.quick_thinking_360,
    summary_for_memory: row.summary_for_memory,
    references_list: asStringArray(row.references_list),
    choices,
  };
}

/**
 * Resolves the question at `position` in `session.question_list`. Returns
 * one of four kinds:
 *   - "source" — populated source question + choices + chapter/subtopic
 *   - "angle"  — populated angle question + choices + parent source
 *   - "archived" — entry exists in question_list but RLS hides the row
 *                  (status='archived' or is_current=false). Caller
 *                  should toast + advance with skip semantics.
 *   - "out_of_range" — position >= question_list.length
 *
 * RLS already filters `source_questions` and `angle_questions` for
 * `status='active' AND is_current=true`. We never bypass that — the
 * "archived" return is what callers consume to handle the rare
 * admin-archived-mid-session case (plan §6 Phase 3, plan-review Part 2
 * risk #2). MVP behavior: skip the position, no attempt row.
 */
export async function getQuestionForPosition(
  supabase: SupabaseSsrClient,
  session: PracticeSessionRow,
  position: number
): Promise<ResolvedQuestion> {
  if (position < 0 || position >= session.question_list.length) {
    return { kind: "out_of_range", session };
  }

  const item = session.question_list[position];

  if (item.type === "source") {
    const [questionResult, choicesResult] = await Promise.all([
      supabase
        .from("source_questions")
        .select(SOURCE_QUESTION_SELECT)
        .eq("id", item.id)
        .maybeSingle<SourceRow>(),
      supabase
        .from("source_choices")
        .select(SOURCE_CHOICE_SELECT)
        .eq("source_question_id", item.id)
        .returns<ChoiceRow[]>(),
    ]);

    if (questionResult.error || !questionResult.data) {
      return { kind: "archived", session, position };
    }
    const choices = mapChoices(choicesResult.data ?? []);
    return {
      kind: "source",
      session,
      question: mapSource(questionResult.data, choices),
    };
  }

  // Angle: fetch the angle, its choices, then the parent source (for
  // breadcrumbs + chapter context).
  const [angleResult, angleChoicesResult] = await Promise.all([
    supabase
      .from("angle_questions")
      .select(ANGLE_QUESTION_SELECT)
      .eq("id", item.id)
      .maybeSingle<AngleRow>(),
    supabase
      .from("angle_choices")
      .select(ANGLE_CHOICE_SELECT)
      .eq("angle_question_id", item.id)
      .returns<ChoiceRow[]>(),
  ]);

  if (angleResult.error || !angleResult.data) {
    return { kind: "archived", session, position };
  }

  const angleChoices = mapChoices(angleChoicesResult.data ?? []);
  const angle = mapAngle(angleResult.data, angleChoices);
  if (!angle) {
    return { kind: "archived", session, position };
  }

  // Parent source — same RLS, so if it's archived the angle is unreachable
  // and we surface as archived too.
  const [parentResult, parentChoicesResult] = await Promise.all([
    supabase
      .from("source_questions")
      .select(SOURCE_QUESTION_SELECT)
      .eq("id", angle.source_question_id)
      .maybeSingle<SourceRow>(),
    supabase
      .from("source_choices")
      .select(SOURCE_CHOICE_SELECT)
      .eq("source_question_id", angle.source_question_id)
      .returns<ChoiceRow[]>(),
  ]);

  if (parentResult.error || !parentResult.data) {
    return { kind: "archived", session, position };
  }

  const parentChoices = mapChoices(parentChoicesResult.data ?? []);
  const parentSource = mapSource(parentResult.data, parentChoices);

  return { kind: "angle", session, question: angle, parentSource };
}

// =============================================================================
// Bookmark + attempt lookups (replay-mode + bookmark icon state)
// =============================================================================

/**
 * Returns true iff the current user has a bookmark on this resolved
 * question. Per B1:
 *   - source questions bookmark by `source_question_group_id`
 *   - angle questions bookmark by `angle_question_id`
 */
export async function getBookmarkState(
  supabase: SupabaseSsrClient,
  userId: string,
  resolved: ResolvedQuestion
): Promise<boolean> {
  if (resolved.kind === "source") {
    const { data } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("question_type", "source")
      .eq("source_question_group_id", resolved.question.question_group_id)
      .maybeSingle();
    return data !== null;
  }
  if (resolved.kind === "angle") {
    const { data } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("question_type", "angle")
      .eq("angle_question_id", resolved.question.id)
      .maybeSingle();
    return data !== null;
  }
  return false;
}

/**
 * Returns the user's prior attempt for this (session, question) pair, or
 * null. Used by /practice/play/[idx] to render replay mode.
 */
export async function getExistingAttempt(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string,
  resolved: ResolvedQuestion
): Promise<AttemptRow | null> {
  if (resolved.kind !== "source" && resolved.kind !== "angle") return null;

  const query = supabase
    .from("attempts")
    .select(
      "id, question_type, source_question_id, angle_question_id, selected_choice_id, selected_letter, is_correct, duration_seconds, was_skipped, attempted_at"
    )
    .eq("user_id", userId)
    .eq("practice_session_id", sessionId);

  if (resolved.kind === "source") {
    query.eq("question_type", "source").eq(
      "source_question_id",
      resolved.question.id
    );
  } else {
    query.eq("question_type", "angle").eq(
      "angle_question_id",
      resolved.question.id
    );
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  // Letter type-narrowing: the DB CHECK guarantees the set, but TS sees
  // string. Coerce defensively.
  const letter =
    data.selected_letter && isValidLetter(data.selected_letter)
      ? data.selected_letter
      : null;

  return {
    id: data.id,
    question_type: data.question_type as "source" | "angle",
    source_question_id: data.source_question_id,
    angle_question_id: data.angle_question_id,
    selected_choice_id: data.selected_choice_id,
    selected_letter: letter,
    is_correct: data.is_correct,
    duration_seconds: data.duration_seconds,
    was_skipped: data.was_skipped,
    attempted_at: data.attempted_at,
  };
}

// =============================================================================
// Security helper — strip `is_correct` + `distractor_analysis` before send
// =============================================================================

/**
 * Returns the question + choices stripped of fields that would reveal
 * the answer to a curious user inspecting the RSC payload before they
 * submit. Used by the page Server Component when there's no
 * `existingAttempt` (i.e., fresh question, not replay mode).
 *
 * After submit, the Server Action returns `correctChoiceId` +
 * `correctLetter`, and `advanceToNext` reloads with the next position.
 */
export function stripAnswerFromChoices<
  Q extends { choices: Choice[] }
>(q: Q): Q {
  return {
    ...q,
    choices: q.choices.map((c) => ({
      ...c,
      is_correct: false,
      distractor_analysis: null,
    })),
  };
}

// =============================================================================
// Summary aggregation
// =============================================================================

type AttemptForSummary = {
  question_type: "source" | "angle";
  source_question_id: string | null;
  angle_question_id: string | null;
  is_correct: boolean | null;
  selected_letter: "א" | "ב" | "ג" | "ד" | null;
  was_skipped: boolean;
  attempted_at: string | null;
};

// Slice 21 — same shape + threshold used by the exam-results
// aggregate (lib/db/exam.ts:802) for parity. Kept inline rather
// than re-exported so the two aggregates stay independent.
const PRACTICE_REVIEW_EXCERPT_MAX_CHARS = 70;
function makeExcerpt(text: string | null | undefined): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= PRACTICE_REVIEW_EXCERPT_MAX_CHARS) return t;
  return t.slice(0, PRACTICE_REVIEW_EXCERPT_MAX_CHARS).trimEnd() + "…";
}

/**
 * Slice 21 — batched question_text fetch for the practice-summary
 * review. Mirrors the inline text resolver pattern from
 * `lib/db/exam.ts` rather than moving it into the shared learning360
 * module (text isn't part of the 360° payload semantics there).
 */
async function resolveQuestionTextsForList(
  supabase: SupabaseSsrClient,
  items: Learning360Item[]
): Promise<Map<string, string>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of items) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const map = new Map<string, string>();
  const [srcRes, angRes] = await Promise.all([
    sourceIds.length > 0
      ? supabase
          .from("source_questions")
          .select("id, question_text")
          .in("id", sourceIds)
      : Promise.resolve({ data: null as unknown }),
    angleIds.length > 0
      ? supabase
          .from("angle_questions")
          .select("id, question_text")
          .in("id", angleIds)
      : Promise.resolve({ data: null as unknown }),
  ]);

  for (const row of (srcRes.data ?? []) as Array<{
    id: string;
    question_text: string | null;
  }>) {
    if (row.question_text) map.set(`source:${row.id}`, row.question_text);
  }
  for (const row of (angRes.data ?? []) as Array<{
    id: string;
    question_text: string | null;
  }>) {
    if (row.question_text) map.set(`angle:${row.id}`, row.question_text);
  }
  return map;
}

/**
 * Build the summary aggregate for a session. Bucket by (chapter,
 * subtopic). Questions whose source row is hidden by RLS (archived
 * after the attempt was recorded) are bucketed under
 * `{chapterTitle: null, subtopicTitle: null}` — the page renders this
 * as the "—" row rather than dropping the data point. Total / source /
 * angle counts are computed from the raw attempts table so they remain
 * correct regardless of archival.
 */
export async function getSummary(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string
): Promise<SummaryAggregate | null> {
  const session = await getSessionForUser(supabase, userId, sessionId);
  if (!session) return null;

  // Slice 21 — build the item list used by the shared 360°/choice
  // resolvers from `session.question_list`. This becomes the ordering
  // source for `byPosition`. The shape adapts practice's
  // {id,type,position} list to the resolver's {question_id,question_type}
  // contract.
  const reviewItems: Learning360Item[] = session.question_list.map((it) => ({
    question_type: it.type,
    question_id: it.id,
  }));

  // Slice 21 — fetch the attempts row + the three batched per-question
  // payloads (choices, 360° fields, question text) IN PARALLEL. The
  // attempts query is what gates the existing aggregate logic below,
  // so we await Promise.all and unwrap after. No extra serial round-trip
  // is added vs. the pre-Slice-21 path — the resolvers are pure adds
  // alongside the existing attempts query.
  const [
    attemptsRes,
    choicesByItem,
    learning360ByItem,
    textsByItem,
  ] = await Promise.all([
    supabase
      .from("attempts")
      .select(
        "question_type, source_question_id, angle_question_id, is_correct, selected_letter, was_skipped, attempted_at"
      )
      .eq("user_id", userId)
      .eq("practice_session_id", sessionId),
    resolveChoicesForList(supabase, reviewItems),
    resolveLearning360ForList(supabase, reviewItems),
    resolveQuestionTextsForList(supabase, reviewItems),
  ]);

  const { data: attemptRows, error: attemptsError } = attemptsRes;
  if (attemptsError) return null;

  const attempts: AttemptForSummary[] = (attemptRows ?? []).map((r) => {
    const rawLetter = r.selected_letter as string | null;
    const letter: "א" | "ב" | "ג" | "ד" | null =
      rawLetter === "א" ||
      rawLetter === "ב" ||
      rawLetter === "ג" ||
      rawLetter === "ד"
        ? rawLetter
        : null;
    return {
      question_type: r.question_type as "source" | "angle",
      source_question_id: r.source_question_id,
      angle_question_id: r.angle_question_id,
      is_correct: r.is_correct,
      selected_letter: letter,
      was_skipped: Boolean(r.was_skipped),
      attempted_at: (r.attempted_at as string | null) ?? null,
    };
  });

  // Top-line counters from raw attempts (immune to archival).
  let sourceAnswered = 0,
    sourceCorrect = 0,
    angleAnswered = 0,
    angleCorrect = 0;
  for (const a of attempts) {
    if (a.question_type === "source") {
      sourceAnswered++;
      if (a.is_correct) sourceCorrect++;
    } else {
      angleAnswered++;
      if (a.is_correct) angleCorrect++;
    }
  }

  // Bucket lookup: source_question_id → {subtopic_title, chapter_title}.
  // RLS-hidden archived questions return no row → bucketed as null/null.
  const sourceIds = new Set<string>();
  for (const a of attempts) {
    if (a.question_type === "source" && a.source_question_id) {
      sourceIds.add(a.source_question_id);
    }
  }

  // For angle attempts, we need the parent source's subtopic. Fetch the
  // angle → source mapping first, then resolve sources.
  const angleIds = new Set<string>();
  for (const a of attempts) {
    if (a.question_type === "angle" && a.angle_question_id) {
      angleIds.add(a.angle_question_id);
    }
  }

  const angleToSource = new Map<string, string>();
  if (angleIds.size > 0) {
    const { data: angleRows } = await supabase
      .from("angle_questions")
      .select("id, source_question_id")
      .in("id", Array.from(angleIds));
    for (const row of angleRows ?? []) {
      angleToSource.set(row.id, row.source_question_id);
      sourceIds.add(row.source_question_id);
    }
  }

  type BucketKey = string;
  const sourceMeta = new Map<
    string,
    { chapter_title: string; subtopic_title: string }
  >();
  if (sourceIds.size > 0) {
    const { data: srcRows } = await supabase
      .from("source_questions")
      .select(
        `id,
         chapter:chapters!source_questions_chapter_id_fkey(title),
         subtopic:subtopics!source_questions_subtopic_id_fkey(title)`
      )
      .in("id", Array.from(sourceIds));
    for (const row of srcRows ?? []) {
      const chapter = pickOne(row.chapter);
      const subtopic = pickOne(row.subtopic);
      sourceMeta.set(row.id, {
        chapter_title: chapter?.title ?? "",
        subtopic_title: subtopic?.title ?? "",
      });
    }
  }

  function bucketKey(
    chapterTitle: string | null,
    subtopicTitle: string | null
  ): BucketKey {
    return `${chapterTitle ?? "_archived"}::${subtopicTitle ?? "_archived"}`;
  }

  const buckets = new Map<
    BucketKey,
    {
      chapterTitle: string | null;
      subtopicTitle: string | null;
      answered: number;
      correct: number;
    }
  >();
  let archivedSkipped = 0;

  for (const a of attempts) {
    let sourceId: string | null = null;
    if (a.question_type === "source") sourceId = a.source_question_id;
    else if (a.angle_question_id) {
      sourceId = angleToSource.get(a.angle_question_id) ?? null;
    }
    const meta = sourceId ? sourceMeta.get(sourceId) : undefined;
    const chapterTitle = meta?.chapter_title ?? null;
    const subtopicTitle = meta?.subtopic_title ?? null;
    if (!meta) archivedSkipped++;

    const key = bucketKey(chapterTitle, subtopicTitle);
    const existing = buckets.get(key) ?? {
      chapterTitle,
      subtopicTitle,
      answered: 0,
      correct: 0,
    };
    existing.answered++;
    if (a.is_correct) existing.correct++;
    buckets.set(key, existing);
  }

  // Sort: real buckets alphabetically by chapter then subtopic; archived
  // bucket last.
  const byBucket = Array.from(buckets.values()).sort((a, b) => {
    const aArchived = a.chapterTitle === null && a.subtopicTitle === null;
    const bArchived = b.chapterTitle === null && b.subtopicTitle === null;
    if (aArchived && !bArchived) return 1;
    if (!aArchived && bArchived) return -1;
    const chapterCmp = (a.chapterTitle ?? "").localeCompare(
      b.chapterTitle ?? "",
      "he"
    );
    if (chapterCmp !== 0) return chapterCmp;
    return (a.subtopicTitle ?? "").localeCompare(b.subtopicTitle ?? "", "he");
  });

  // Slice 21 — assemble per-question review rows in `question_list`
  // position order. For each item we join its attempt (if any), the
  // resolved Choice[], and the 360° payload (with server-derived
  // correctChoice from the choice list). When EITHER the 360° fields
  // OR the choices can't be resolved (archived row), `learning` is
  // null and the UI skips the 360° toggle.
  const attemptByKey = new Map<
    string,
    {
      is_correct: boolean | null;
      selected_letter: "א" | "ב" | "ג" | "ד" | null;
      was_skipped: boolean;
      attempted_at: string | null;
    }
  >();
  for (const a of attempts) {
    const id =
      a.question_type === "source" ? a.source_question_id : a.angle_question_id;
    if (!id) continue;
    attemptByKey.set(`${a.question_type}:${id}`, {
      is_correct: a.is_correct,
      selected_letter: a.selected_letter,
      was_skipped: a.was_skipped,
      attempted_at: a.attempted_at,
    });
  }

  const orderedList = [...session.question_list].sort(
    (a, b) => a.position - b.position
  );
  const byPosition: PracticeReviewRow[] = orderedList.map((it) => {
    const key = `${it.type}:${it.id}`;
    const att = attemptByKey.get(key);
    const choices = choicesByItem.get(key) ?? [];
    const fields360 = learning360ByItem.get(key);
    const text = textsByItem.get(key);
    const learning: Learning360Payload | null = fields360
      ? {
          ...fields360,
          correctChoice: choices.find((c) => c.is_correct) ?? null,
        }
      : null;
    return {
      position: it.position,
      questionType: it.type,
      questionId: it.id,
      excerpt: makeExcerpt(text),
      questionText: text ?? "",
      choices,
      selectedLetter: att?.selected_letter ?? null,
      isCorrect: att?.is_correct ?? null,
      wasSkipped: att?.was_skipped ?? false,
      attemptedAt: att?.attempted_at ?? null,
      learning,
    };
  });

  return {
    session,
    totalAnswered: sourceAnswered + angleAnswered,
    totalCorrect: sourceCorrect + angleCorrect,
    sourceAnswered,
    sourceCorrect,
    angleAnswered,
    angleCorrect,
    byBucket,
    archivedSkipped,
    byPosition,
  };
}

// =============================================================================
// Phase 4 — bookmarks + mistakes list helpers
// =============================================================================

const PREVIEW_MAX_CHARS = 200;

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_MAX_CHARS) return text;
  return text.slice(0, PREVIEW_MAX_CHARS).trimEnd() + "…";
}

type AngleLetter = "א" | "ב" | "ג" | "ד" | "ה";

function angleLetterOrNull(s: string): AngleLetter | null {
  if (s === "א" || s === "ב" || s === "ג" || s === "ד" || s === "ה") return s;
  return null;
}

export type BookmarkSourcePreview = {
  id: string;
  questionGroupId: string;
  externalId: string;
  questionText: string;
  chapterId: string;
  chapterTitle: string;
  subtopicTitle: string;
  isArchived: boolean;
};

export type BookmarkAnglePreview = {
  id: string;
  angleLetter: AngleLetter;
  angleTitle: string | null;
  questionText: string;
  parentSourceExternalId: string;
  chapterId: string;
  chapterTitle: string;
  subtopicTitle: string;
  isArchived: boolean;
};

export type BookmarkListRow =
  | {
      bookmarkId: string;
      questionType: "source";
      createdAt: string;
      sourceQuestion: BookmarkSourcePreview;
    }
  | {
      bookmarkId: string;
      questionType: "angle";
      createdAt: string;
      angleQuestion: BookmarkAnglePreview;
    };

export type MistakeListRow =
  | {
      mistakeId: string;
      questionType: "source";
      mistakesCount: number;
      lastMistakeAt: string;
      firstMistakeAt: string;
      sourceQuestion: BookmarkSourcePreview;
    }
  | {
      mistakeId: string;
      questionType: "angle";
      mistakesCount: number;
      lastMistakeAt: string;
      firstMistakeAt: string;
      angleQuestion: BookmarkAnglePreview;
    };

type SourceMetaRow = {
  id: string;
  question_group_id: string;
  external_id: string;
  question_text: string;
  chapter_id: string;
  chapter: { title: string } | { title: string }[] | null;
  subtopic: { title: string } | { title: string }[] | null;
};

type AngleSourceParent = {
  id: string;
  question_group_id: string;
  external_id: string;
  chapter_id: string;
  chapter: { title: string } | { title: string }[] | null;
  subtopic: { title: string } | { title: string }[] | null;
};

type AngleMetaRow = {
  id: string;
  angle_letter: string;
  angle_title: string | null;
  question_text: string;
  source_question: AngleSourceParent | AngleSourceParent[] | null;
};

const SOURCE_PREVIEW_SELECT = `
  id, question_group_id, external_id, question_text, chapter_id,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_PREVIEW_SELECT = `
  id, angle_letter, angle_title, question_text,
  source_question:source_questions!angle_questions_source_question_id_fkey(
    id, question_group_id, external_id, chapter_id,
    chapter:chapters!source_questions_chapter_id_fkey(title),
    subtopic:subtopics!source_questions_subtopic_id_fkey(title)
  )
`;

function mapSourcePreview(
  row: SourceMetaRow | undefined,
  questionGroupId: string
): BookmarkSourcePreview {
  if (!row) {
    return {
      id: "",
      questionGroupId,
      externalId: "",
      questionText: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
    };
  }
  const chapter = pickOne(row.chapter);
  const subtopic = pickOne(row.subtopic);
  return {
    id: row.id,
    questionGroupId: row.question_group_id,
    externalId: row.external_id,
    questionText: truncatePreview(row.question_text),
    chapterId: row.chapter_id,
    chapterTitle: chapter?.title ?? "",
    subtopicTitle: subtopic?.title ?? "",
    isArchived: false,
  };
}

function mapAnglePreview(
  row: AngleMetaRow | undefined,
  angleQuestionId: string
): BookmarkAnglePreview {
  if (!row) {
    return {
      id: angleQuestionId,
      angleLetter: "א",
      angleTitle: null,
      questionText: "",
      parentSourceExternalId: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
    };
  }
  const letter = angleLetterOrNull(row.angle_letter) ?? "א";
  const parent = pickOne(row.source_question);
  if (!parent) {
    return {
      id: row.id,
      angleLetter: letter,
      angleTitle: row.angle_title,
      questionText: truncatePreview(row.question_text),
      parentSourceExternalId: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
    };
  }
  const chapter = pickOne(parent.chapter);
  const subtopic = pickOne(parent.subtopic);
  return {
    id: row.id,
    angleLetter: letter,
    angleTitle: row.angle_title,
    questionText: truncatePreview(row.question_text),
    parentSourceExternalId: parent.external_id,
    chapterId: parent.chapter_id,
    chapterTitle: chapter?.title ?? "",
    subtopicTitle: subtopic?.title ?? "",
    isArchived: false,
  };
}

type BookmarkRawRow = {
  id: string;
  question_type: string;
  source_question_group_id: string | null;
  angle_question_id: string | null;
  created_at: string;
};

type MistakeRawRow = {
  id: string;
  question_type: string;
  source_question_group_id: string | null;
  angle_question_id: string | null;
  mistakes_count: number;
  last_mistake_at: string;
  first_mistake_at: string;
};

/**
 * Joint loader for source-preview + angle-preview metadata. Given a set
 * of question_group_ids and angle_question_ids, fetches the current
 * source_questions row per group (RLS hides archived) and the
 * angle_questions row per id (RLS hides via parent). Returns two Maps
 * keyed for the caller to assemble per-row.
 */
async function loadPreviewMaps(
  supabase: SupabaseSsrClient,
  groupIds: string[],
  angleIds: string[]
): Promise<{
  sources: Map<string, SourceMetaRow>;
  angles: Map<string, AngleMetaRow>;
}> {
  const sources = new Map<string, SourceMetaRow>();
  const angles = new Map<string, AngleMetaRow>();

  const sourcesPromise =
    groupIds.length > 0
      ? supabase
          .from("source_questions")
          .select(SOURCE_PREVIEW_SELECT)
          .in("question_group_id", groupIds)
          .eq("is_current", true)
      : null;

  const anglesPromise =
    angleIds.length > 0
      ? supabase
          .from("angle_questions")
          .select(ANGLE_PREVIEW_SELECT)
          .in("id", angleIds)
      : null;

  const [sourcesResult, anglesResult] = await Promise.all([
    sourcesPromise,
    anglesPromise,
  ]);

  if (sourcesResult?.data) {
    for (const row of sourcesResult.data as unknown as SourceMetaRow[]) {
      sources.set(row.question_group_id, row);
    }
  }
  if (anglesResult?.data) {
    for (const row of anglesResult.data as unknown as AngleMetaRow[]) {
      angles.set(row.id, row);
    }
  }

  return { sources, angles };
}

// =============================================================================
// Slice 6 cluster — auto-resolve on a correct answer
// =============================================================================

/**
 * Given a user and the universe of (source group_ids, angle ids) they
 * have mistaked or bookmarked, returns the subset that is currently
 * "resolved" — i.e. the user's most recent attempt on that question
 * was correct.
 *
 * Why this helper exists (Slice 6 bug cluster, fix 1):
 *   - record_mistake / record_bookmark_toggle never auto-clear rows
 *     when a later attempt is correct. We compute that at read time
 *     instead, so the UI hides resolved rows without any schema or
 *     write-path change.
 *   - Source-type rows store `source_question_group_id` (the version-
 *     stable id), but `attempts.source_question_id` references the
 *     current `source_questions.id`. We translate via source_questions
 *     before matching. Angle-type rows match directly on
 *     `angle_questions.id`.
 *
 * Performance: callers that already loaded source_questions for the
 * preview maps can pass a pre-built `sourceGroupToCurrentId` map to
 * skip the redundant lookup. The (app)/layout.tsx count path doesn't
 * need previews, so it pays for one source_questions read.
 *
 * Cost: at most three round trips —
 *   1. source_questions group→id resolution (skipped if map supplied)
 *   2. attempts filtered by source_question_id (parallel with 3)
 *   3. attempts filtered by angle_question_id (parallel with 2)
 */
export async function findResolvedQuestions(
  supabase: SupabaseSsrClient,
  userId: string,
  groupIds: string[],
  angleIds: string[],
  options?: { sourceGroupToCurrentId?: Map<string, string> }
): Promise<{ resolvedGroupIds: Set<string>; resolvedAngleIds: Set<string> }> {
  const resolvedGroupIds = new Set<string>();
  const resolvedAngleIds = new Set<string>();

  // Empty-input fast path: nothing to resolve.
  if (groupIds.length === 0 && angleIds.length === 0) {
    return { resolvedGroupIds, resolvedAngleIds };
  }

  // Step 1 — resolve source group_id → current source_questions.id.
  // The mistake/bookmark loaders already fetched this; they can hand
  // us the map to skip the round trip.
  let groupToId = options?.sourceGroupToCurrentId;
  if (!groupToId) {
    groupToId = new Map<string, string>();
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from("source_questions")
        .select("id, question_group_id")
        .in("question_group_id", groupIds)
        .eq("is_current", true);
      for (const row of (data ?? []) as Array<{
        id: string;
        question_group_id: string;
      }>) {
        groupToId.set(row.question_group_id, row.id);
      }
    }
  }
  const currentSourceIds = Array.from(groupToId.values());
  const idToGroup = new Map<string, string>();
  for (const [g, id] of groupToId) idToGroup.set(id, g);

  // Step 2 — fetch attempts for the relevant question ids, sorted
  // newest-first so the first row we see per question is the most
  // recent one. RLS on `attempts` enforces user_id = auth.uid()
  // but we also pin .eq("user_id", userId) defensively.
  const [sourceAttemptsRes, angleAttemptsRes] = await Promise.all([
    currentSourceIds.length > 0
      ? supabase
          .from("attempts")
          .select("source_question_id, is_correct, attempted_at")
          .eq("user_id", userId)
          .eq("question_type", "source")
          .in("source_question_id", currentSourceIds)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown }),
    angleIds.length > 0
      ? supabase
          .from("attempts")
          .select("angle_question_id, is_correct, attempted_at")
          .eq("user_id", userId)
          .eq("question_type", "angle")
          .in("angle_question_id", angleIds)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown }),
  ]);

  // Step 3 — walk newest-first; first row per question id is the
  // latest. If correct, that question is resolved.
  const seenSourceIds = new Set<string>();
  for (const a of (sourceAttemptsRes.data ?? []) as Array<{
    source_question_id: string | null;
    is_correct: boolean | null;
  }>) {
    if (!a.source_question_id) continue;
    if (seenSourceIds.has(a.source_question_id)) continue;
    seenSourceIds.add(a.source_question_id);
    if (a.is_correct === true) {
      const groupId = idToGroup.get(a.source_question_id);
      if (groupId) resolvedGroupIds.add(groupId);
    }
  }

  const seenAngleIds = new Set<string>();
  for (const a of (angleAttemptsRes.data ?? []) as Array<{
    angle_question_id: string | null;
    is_correct: boolean | null;
  }>) {
    if (!a.angle_question_id) continue;
    if (seenAngleIds.has(a.angle_question_id)) continue;
    seenAngleIds.add(a.angle_question_id);
    if (a.is_correct === true) {
      resolvedAngleIds.add(a.angle_question_id);
    }
  }

  return { resolvedGroupIds, resolvedAngleIds };
}

/**
 * Sidebar-badge counts for /(app)/layout.tsx. Applies the same
 * compute-at-read auto-resolve filter as getUserBookmarks /
 * getUserMistakes so the badges match what the list pages show.
 *
 * One SELECT per table (rows + their question references — small
 * payload), then a shared `findResolvedQuestions` call against the
 * union of ids. Replaces the prior `count: exact, head: true`
 * queries: those couldn't express the "latest attempt not correct"
 * predicate without an RPC.
 */
export async function getActiveBookmarkAndMistakeCounts(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<{ bookmarksCount: number; mistakesCount: number }> {
  const [bookmarksRes, mistakesRes] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("question_type, source_question_group_id, angle_question_id")
      .eq("user_id", userId),
    supabase
      .from("mistakes")
      .select("question_type, source_question_group_id, angle_question_id")
      .eq("user_id", userId)
      .eq("manually_removed", false),
  ]);

  const bookmarkRows = (bookmarksRes.data ?? []) as Array<{
    question_type: string;
    source_question_group_id: string | null;
    angle_question_id: string | null;
  }>;
  const mistakeRows = (mistakesRes.data ?? []) as Array<{
    question_type: string;
    source_question_group_id: string | null;
    angle_question_id: string | null;
  }>;

  // Union the ids — one resolve pass covers both lists.
  const groupIdSet = new Set<string>();
  const angleIdSet = new Set<string>();
  for (const r of bookmarkRows.concat(mistakeRows)) {
    if (r.question_type === "source" && r.source_question_group_id) {
      groupIdSet.add(r.source_question_group_id);
    } else if (r.question_type === "angle" && r.angle_question_id) {
      angleIdSet.add(r.angle_question_id);
    }
  }

  const { resolvedGroupIds, resolvedAngleIds } = await findResolvedQuestions(
    supabase,
    userId,
    Array.from(groupIdSet),
    Array.from(angleIdSet)
  );

  function isActive(r: {
    question_type: string;
    source_question_group_id: string | null;
    angle_question_id: string | null;
  }): boolean {
    if (r.question_type === "source" && r.source_question_group_id) {
      return !resolvedGroupIds.has(r.source_question_group_id);
    }
    if (r.question_type === "angle" && r.angle_question_id) {
      return !resolvedAngleIds.has(r.angle_question_id);
    }
    return false;
  }

  return {
    bookmarksCount: bookmarkRows.filter(isActive).length,
    mistakesCount: mistakeRows.filter(isActive).length,
  };
}

/**
 * Lists the user's active bookmarks, newest first. RLS on the bookmarks
 * table already filters by user_id. RLS on source_questions /
 * angle_questions further hides archived content — those bookmarks
 * still appear in the returned list but are flagged `isArchived=true`
 * with empty preview fields so the UI can render a "הוסר זמנית" badge
 * rather than a clickable row.
 *
 * Slice 6 cluster fix 1: rows are also hidden when the user's most
 * recent attempt on that question is correct (see
 * findResolvedQuestions for the source group_id↔id translation).
 */
export async function getUserBookmarks(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<BookmarkListRow[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      "id, question_type, source_question_group_id, angle_question_id, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as BookmarkRawRow[];
  const groupIds: string[] = [];
  const angleIds: string[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      groupIds.push(r.source_question_group_id);
    } else if (r.question_type === "angle" && r.angle_question_id) {
      angleIds.push(r.angle_question_id);
    }
  }

  const { sources, angles } = await loadPreviewMaps(
    supabase,
    groupIds,
    angleIds
  );

  // Slice 6 fix 1 — hide bookmarks the user has since answered
  // correctly. Reuse the loadPreviewMaps source_questions data so the
  // helper doesn't re-fetch group→id.
  const sourceGroupToCurrentId = new Map<string, string>();
  for (const [groupId, row] of sources) {
    sourceGroupToCurrentId.set(groupId, row.id);
  }
  const { resolvedGroupIds, resolvedAngleIds } = await findResolvedQuestions(
    supabase,
    userId,
    groupIds,
    angleIds,
    { sourceGroupToCurrentId }
  );

  const out: BookmarkListRow[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      if (resolvedGroupIds.has(r.source_question_group_id)) continue;
      out.push({
        bookmarkId: r.id,
        questionType: "source",
        createdAt: r.created_at,
        sourceQuestion: mapSourcePreview(
          sources.get(r.source_question_group_id),
          r.source_question_group_id
        ),
      });
    } else if (r.question_type === "angle" && r.angle_question_id) {
      if (resolvedAngleIds.has(r.angle_question_id)) continue;
      out.push({
        bookmarkId: r.id,
        questionType: "angle",
        createdAt: r.created_at,
        angleQuestion: mapAnglePreview(
          angles.get(r.angle_question_id),
          r.angle_question_id
        ),
      });
    }
  }
  return out;
}

/**
 * Lists the user's active mistakes (WHERE manually_removed = false),
 * most-recent mistake first. Same archived-handling as bookmarks.
 *
 * Slice 6 cluster fix 1: rows are also hidden when the user's most
 * recent attempt on that question is correct.
 */
export async function getUserMistakes(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<MistakeListRow[]> {
  const { data, error } = await supabase
    .from("mistakes")
    .select(
      "id, question_type, source_question_group_id, angle_question_id, mistakes_count, last_mistake_at, first_mistake_at"
    )
    .eq("user_id", userId)
    .eq("manually_removed", false)
    .order("last_mistake_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as MistakeRawRow[];
  const groupIds: string[] = [];
  const angleIds: string[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      groupIds.push(r.source_question_group_id);
    } else if (r.question_type === "angle" && r.angle_question_id) {
      angleIds.push(r.angle_question_id);
    }
  }

  const { sources, angles } = await loadPreviewMaps(
    supabase,
    groupIds,
    angleIds
  );

  // Slice 6 fix 1 — hide mistakes the user has since answered
  // correctly. Same translation strategy as getUserBookmarks: reuse
  // the loadPreviewMaps source_questions data instead of re-fetching.
  const sourceGroupToCurrentId = new Map<string, string>();
  for (const [groupId, row] of sources) {
    sourceGroupToCurrentId.set(groupId, row.id);
  }
  const { resolvedGroupIds, resolvedAngleIds } = await findResolvedQuestions(
    supabase,
    userId,
    groupIds,
    angleIds,
    { sourceGroupToCurrentId }
  );

  const out: MistakeListRow[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      if (resolvedGroupIds.has(r.source_question_group_id)) continue;
      out.push({
        mistakeId: r.id,
        questionType: "source",
        mistakesCount: r.mistakes_count,
        lastMistakeAt: r.last_mistake_at,
        firstMistakeAt: r.first_mistake_at,
        sourceQuestion: mapSourcePreview(
          sources.get(r.source_question_group_id),
          r.source_question_group_id
        ),
      });
    } else if (r.question_type === "angle" && r.angle_question_id) {
      if (resolvedAngleIds.has(r.angle_question_id)) continue;
      out.push({
        mistakeId: r.id,
        questionType: "angle",
        mistakesCount: r.mistakes_count,
        lastMistakeAt: r.last_mistake_at,
        firstMistakeAt: r.first_mistake_at,
        angleQuestion: mapAnglePreview(
          angles.get(r.angle_question_id),
          r.angle_question_id
        ),
      });
    }
  }
  return out;
}

// =============================================================================
// Phase 4 — per-chapter availability for the empty-chapter UX
// =============================================================================

export type ChapterWithCount = {
  id: string;
  code: string;
  title: string;
  display_order: number;
  activeQuestionCount: number;
};

/**
 * Returns all chapters with their count of active+current source questions.
 * Used by the practice setup page to render empty chapters as disabled
 * "(בקרוב)" chips per Phase 4 plan §4. RLS on source_questions filters
 * to `status='active' AND is_current=true AND has_active_subscription()`
 * — so the count reflects what the user can actually practice, and
 * users without subscriptions see all-zero counts (gate redirects
 * before this is called).
 *
 * Implementation note: we issue one query for chapters and one for
 * source_questions (grouped client-side). PostgREST's embed-aggregate
 * shape is fragile across versions, and 6-chapter × ~100-question
 * scale doesn't justify a custom RPC.
 */
export async function getChaptersWithQuestionCount(
  supabase: SupabaseSsrClient
): Promise<ChapterWithCount[]> {
  const [chaptersResult, questionsResult] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("source_questions")
      .select("chapter_id")
      .eq("status", "active")
      .eq("is_current", true),
  ]);

  if (chaptersResult.error || !chaptersResult.data) return [];

  const counts = new Map<string, number>();
  for (const row of questionsResult.data ?? []) {
    const id = (row as { chapter_id: string }).chapter_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return chaptersResult.data.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    display_order: c.display_order,
    activeQuestionCount: counts.get(c.id) ?? 0,
  }));
}
