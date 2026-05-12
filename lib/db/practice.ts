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
 */
type Source360 = {
  legal_topic_analysis: string;
  full_explanation: string;
  common_pitfall: string;
  concepts_and_skills: string[];
  quick_thinking_360: string;
  summary_for_memory: string;
  references_list: string[];
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

export type SummaryAggregate = {
  session: PracticeSessionRow;
  totalAnswered: number;
  totalCorrect: number;
  sourceAnswered: number;
  sourceCorrect: number;
  angleAnswered: number;
  angleCorrect: number;
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
      "id, user_id, selected_chapters, selected_subtopics, source_count_target, angles_per_source, time_per_question_seconds, question_list, status, questions_answered, questions_correct, started_at, completed_at, last_activity_at"
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
};

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

  const { data: attemptRows, error: attemptsError } = await supabase
    .from("attempts")
    .select(
      "question_type, source_question_id, angle_question_id, is_correct"
    )
    .eq("user_id", userId)
    .eq("practice_session_id", sessionId);

  if (attemptsError) return null;

  const attempts: AttemptForSummary[] = (attemptRows ?? []).map((r) => ({
    question_type: r.question_type as "source" | "angle",
    source_question_id: r.source_question_id,
    angle_question_id: r.angle_question_id,
    is_correct: r.is_correct,
  }));

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
  chapter: { title: string } | { title: string }[] | null;
  subtopic: { title: string } | { title: string }[] | null;
};

type AngleMetaRow = {
  id: string;
  angle_letter: string;
  angle_title: string | null;
  question_text: string;
  source_question:
    | {
        id: string;
        question_group_id: string;
        external_id: string;
        chapter: { title: string } | { title: string }[] | null;
        subtopic: { title: string } | { title: string }[] | null;
      }
    | {
        id: string;
        question_group_id: string;
        external_id: string;
        chapter: { title: string } | { title: string }[] | null;
        subtopic: { title: string } | { title: string }[] | null;
      }[]
    | null;
};

const SOURCE_PREVIEW_SELECT = `
  id, question_group_id, external_id, question_text,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_PREVIEW_SELECT = `
  id, angle_letter, angle_title, question_text,
  source_question:source_questions!angle_questions_source_question_id_fkey(
    id, question_group_id, external_id,
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

/**
 * Lists the user's active bookmarks, newest first. RLS on the bookmarks
 * table already filters by user_id. RLS on source_questions /
 * angle_questions further hides archived content — those bookmarks
 * still appear in the returned list but are flagged `isArchived=true`
 * with empty preview fields so the UI can render a "הוסר זמנית" badge
 * rather than a clickable row.
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

  const out: BookmarkListRow[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
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

  const out: MistakeListRow[] = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
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
