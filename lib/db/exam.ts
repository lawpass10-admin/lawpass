/**
 * Slice 3 — Exam-mode DB helpers + sampling. Server-only.
 * Slice 9 — Multi-mode (procedural / substantive / combined).
 *
 * Mirrors the shape of `lib/db/practice.ts`: caller is responsible for
 * `requireActiveSubscription()` before any of these run. Every read
 * goes through RLS; we never use the admin client.
 *
 * The cluster-weighted sampling logic is split in two layers:
 *   - `sampleExamQuestions(supabase, mode)` — thin DB shim that fetches
 *     the eligible pool (source + angle) for the requested mode and
 *     projects each row into a `PoolItem` carrying its chapter code.
 *   - `bucketAndShuffleExamPool(pool, clusters)` — PURE function. No
 *     supabase, no I/O. Unit-tested with fixtures in
 *     `tests/exam-sampling.test.ts`. Lives here for colocation but
 *     stays import-free of anything async.
 *
 * The pure helper does three passes:
 *   1. Per-cluster pick (in cluster order — depends on mode).
 *   2. Global padding from leftovers if any cluster underflowed.
 *   3. Final shuffle of the assembled 40 so the user doesn't see
 *      cluster grouping in the question stream.
 */

import {
  EXAM_TOTAL_QUESTIONS,
  type ExamCluster,
  type ExamMode,
  EXAM_CLUSTERS,
  clustersForMode,
} from "@/lib/exam/clusters";
import type { createClient } from "@/lib/supabase/server";

// Reused from practice — the same shape works for exam questions.
// Re-exported below for `app/(app)/exam/**` consumers so they don't
// reach into the practice module.
import type {
  AngleQuestionRow,
  AttemptRow,
  Choice,
  SourceQuestionRow,
} from "@/lib/db/practice";
import { stripAnswerFromChoices } from "@/lib/db/practice";

export type { AngleQuestionRow, AttemptRow, Choice, SourceQuestionRow };
export { stripAnswerFromChoices };

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// Types
// =============================================================================

export type ExamQuestionType = "source" | "angle";

export type ExamQuestionListItem = {
  /** Discriminates source vs angle. Same shape as DB jsonb per spec §8.4.3. */
  question_type: ExamQuestionType;
  question_id: string;
  /** 1..40, dense, assigned post-shuffle. */
  display_order: number;
};

export type ExamSessionStatus = "active" | "paused" | "completed" | "abandoned";

export type ExamSessionRow = {
  id: string;
  user_id: string;
  question_list: ExamQuestionListItem[];
  total_duration_seconds: number;
  time_used_seconds: number;
  status: ExamSessionStatus;
  questions_answered: number;
  questions_correct: number;
  final_score: number | null;
  passed: boolean | null;
  active_window_token: string;
  started_at: string;
  paused_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  /** Slice 9 — which sampling pool was used for this session. Pre-Slice-9
   *  rows are backfilled by the migration to 'procedural'. */
  mode: ExamMode;
};

/**
 * Internal pool-item shape used during sampling. Carries the chapter
 * code so the bucketer can split by cluster without re-joining. Slice 9
 * adds the optional `track` field — informational for combined-mode
 * diagnostics; bucketing keys off `chapter_code`, so cluster picks
 * never depend on `track`.
 */
export type ExamPoolItem = {
  question_type: ExamQuestionType;
  question_id: string;
  chapter_code: string;
  track?: string;
};

// =============================================================================
// Pure helpers (unit-testable; no I/O)
// =============================================================================

/**
 * Fisher-Yates in place. Math.random is fine for picking exam questions
 * — same call we already make in createPracticeSession.
 */
export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function itemKey(it: ExamPoolItem): string {
  return `${it.question_type}:${it.question_id}`;
}

/**
 * Pure bucketing + shuffling. Takes the full eligible pool + cluster
 * config; returns exactly EXAM_TOTAL_QUESTIONS items after a final
 * cross-cluster shuffle.
 *
 * Algorithm:
 *   - For each cluster: build the cluster pool (items whose chapter_code
 *     is in cluster.chapter_codes), shuffle, take cluster.target items
 *     (or all if pool < target).
 *   - Padding pass: if total < EXAM_TOTAL_QUESTIONS, shuffle remaining
 *     items (cross-cluster), fill until total = EXAM_TOTAL_QUESTIONS.
 *   - Final shuffle of the assembled 40.
 *
 * Throws `Error('exam_pool_insufficient')` when the total pool can't
 * cover 40 items even after global padding.
 */
export function bucketAndShuffleExamPool(
  pool: ExamPoolItem[],
  clusters: readonly ExamCluster[] = EXAM_CLUSTERS,
  totalTarget: number = EXAM_TOTAL_QUESTIONS
): ExamPoolItem[] {
  const picked = new Set<string>();
  const result: ExamPoolItem[] = [];

  for (const cluster of clusters) {
    const clusterPool = pool.filter((p) =>
      cluster.chapter_codes.includes(p.chapter_code)
    );
    shuffleInPlace(clusterPool);
    let taken = 0;
    for (const item of clusterPool) {
      if (taken >= cluster.target) break;
      const k = itemKey(item);
      if (picked.has(k)) continue;
      picked.add(k);
      result.push(item);
      taken++;
    }
  }

  // Global padding pass: any cluster underflow is absorbed from the
  // global leftover pool.
  if (result.length < totalTarget) {
    const leftover = pool.filter((p) => !picked.has(itemKey(p)));
    shuffleInPlace(leftover);
    for (const item of leftover) {
      if (result.length >= totalTarget) break;
      picked.add(itemKey(item));
      result.push(item);
    }
  }

  if (result.length < totalTarget) {
    throw new Error("exam_pool_insufficient");
  }

  // Final cross-cluster shuffle so the user doesn't get cluster
  // grouping (e.g., 14 civil_proc in a row, then 11 criminal_proc, …).
  shuffleInPlace(result);
  return result;
}

// =============================================================================
// DB fetches
// =============================================================================

const EXAM_SESSION_SELECT =
  "id, user_id, question_list, total_duration_seconds, time_used_seconds, " +
  "status, questions_answered, questions_correct, final_score, passed, " +
  "active_window_token, started_at, paused_at, completed_at, " +
  "last_activity_at, mode";

function parseQuestionList(v: unknown): ExamQuestionListItem[] {
  if (!Array.isArray(v)) return [];
  const out: ExamQuestionListItem[] = [];
  for (const item of v) {
    if (
      item &&
      typeof item === "object" &&
      "question_type" in item &&
      "question_id" in item &&
      "display_order" in item &&
      (item.question_type === "source" || item.question_type === "angle") &&
      typeof item.question_id === "string" &&
      typeof item.display_order === "number"
    ) {
      out.push({
        question_type: item.question_type,
        question_id: item.question_id,
        display_order: item.display_order,
      });
    }
  }
  return out;
}

function parseExamMode(v: unknown): ExamMode {
  if (v === "procedural" || v === "substantive" || v === "combined") return v;
  // Defensive fallback for any pre-Slice-9 row that somehow lost the
  // backfilled value. The migration sets DEFAULT 'procedural' so this
  // branch shouldn't fire in practice.
  return "procedural";
}

function mapExamSession(data: Record<string, unknown>): ExamSessionRow {
  const status = data.status as ExamSessionStatus;
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    question_list: parseQuestionList(data.question_list),
    total_duration_seconds: data.total_duration_seconds as number,
    time_used_seconds: data.time_used_seconds as number,
    status,
    questions_answered: data.questions_answered as number,
    questions_correct: data.questions_correct as number,
    final_score: (data.final_score as number | null) ?? null,
    passed: (data.passed as boolean | null) ?? null,
    active_window_token: data.active_window_token as string,
    started_at: data.started_at as string,
    paused_at: (data.paused_at as string | null) ?? null,
    completed_at: (data.completed_at as string | null) ?? null,
    last_activity_at: data.last_activity_at as string,
    mode: parseExamMode(data.mode),
  };
}

/**
 * Returns the user's active or paused exam session, or null.
 *
 * "Active" = status IN ('active', 'paused'). Phase 2 surfaces this via
 * the resume modal on `/exam`. Phase 1 only needs it for the assertion
 * that `createExamSession` correctly abandons any prior one.
 */
export async function getActiveExamSessionForUser(
  supabase: SupabaseSsrClient,
  userId: string
): Promise<ExamSessionRow | null> {
  const { data, error } = await supabase
    .from("exam_sessions")
    .select(EXAM_SESSION_SELECT)
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapExamSession(data as unknown as Record<string, unknown>);
}

/**
 * Fetch a specific session for the caller. RLS already filters by
 * user_id; the explicit `.eq` matches the practice helper's defense
 * in depth so an RLS relaxation doesn't silently widen the lookup.
 */
export async function getExamSessionById(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string
): Promise<ExamSessionRow | null> {
  const { data, error } = await supabase
    .from("exam_sessions")
    .select(EXAM_SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapExamSession(data as unknown as Record<string, unknown>);
}

// =============================================================================
// Sampling
// =============================================================================

type SourceRow = { id: string; chapter_code: string };
type AngleRow = { id: string; source_question_id: string };

type SourceRowWithTrack = SourceRow & { track: string };

/**
 * Build the 40-question list for a new exam session. Returns items in
 * the order they will be presented (post-final-shuffle), with
 * `display_order` assigned 1..40 densely.
 *
 * RLS-aware: every read goes through the SSR client. Archived /
 * non-current source questions are hidden by RLS, and angles whose
 * parent is RLS-hidden are also filtered out.
 *
 * Slice 9 — mode-aware. The track allowlist + cluster config are both
 * derived from `mode`:
 *   - procedural: track must be 'procedural'. 3 clusters (א/ב/ג).
 *   - substantive: track must be 'substantive'. 1 cluster (מ).
 *   - combined: track ∈ {procedural, substantive}. 4 clusters
 *     (7/6/7 procedural + 20 substantive = 40).
 */
export async function sampleExamQuestions(
  supabase: SupabaseSsrClient,
  mode: ExamMode = "procedural"
): Promise<ExamQuestionListItem[]> {
  // Track allowlist for the current mode. Drives both the DB filter
  // (single-track modes use `.eq`, combined uses `.in`) AND the JS-side
  // defense-in-depth guard that drops any row whose `track` falls
  // outside the allowlist.
  const allowedTracks: string[] =
    mode === "procedural"
      ? ["procedural"]
      : mode === "substantive"
        ? ["substantive"]
        : ["procedural", "substantive"];
  const allowedTrackSet = new Set(allowedTracks);

  // Step 1 — fetch active+current source questions with their chapter
  // codes, restricted to the mode's allowed track(s). Two layers of
  // defense, same pattern as Slice 3:
  //   1. DB-side: `!inner` makes the chapter embed an INNER join and
  //      `.eq("chapter.track", ...)` (or `.in(...)` for combined)
  //      filters at PostgREST.
  //   2. JS-side: the loop below also drops any row whose `track` is
  //      not in `allowedTrackSet`, in case the embedded-resource
  //      filter is ever bypassed (FK schema change, PostgREST upgrade
  //      semantics, etc.).
  const baseQuery = supabase
    .from("source_questions")
    .select(
      "id, chapter:chapters!source_questions_chapter_id_fkey!inner(code, track)"
    )
    .eq("is_current", true)
    .eq("status", "active");
  const filteredQuery =
    allowedTracks.length === 1
      ? baseQuery.eq("chapter.track", allowedTracks[0])
      : baseQuery.in("chapter.track", allowedTracks);
  const { data: srcRows, error: srcErr } = await filteredQuery;
  if (srcErr) throw srcErr;

  const sourceById = new Map<string, SourceRowWithTrack>();
  for (const row of (srcRows ?? []) as Array<{
    id: string;
    chapter:
      | { code: string; track: string | null }
      | { code: string; track: string | null }[]
      | null;
  }>) {
    const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
    if (!chapter?.code) continue;
    if (!chapter.track || !allowedTrackSet.has(chapter.track)) continue;
    sourceById.set(row.id, {
      id: row.id,
      chapter_code: chapter.code,
      track: chapter.track,
    });
  }

  // Step 2 — fetch every angle whose parent source is in the
  // accessible pool. RLS already filters by parent accessibility; we
  // intersect with sourceById in TS to be safe against stale rows.
  const { data: angleRows, error: angleErr } = await supabase
    .from("angle_questions")
    .select("id, source_question_id")
    .in("source_question_id", Array.from(sourceById.keys()));
  if (angleErr) throw angleErr;

  // Step 3 — assemble the unified pool.
  const pool: ExamPoolItem[] = [];
  for (const src of sourceById.values()) {
    pool.push({
      question_type: "source",
      question_id: src.id,
      chapter_code: src.chapter_code,
      track: src.track,
    });
  }
  for (const ang of (angleRows ?? []) as AngleRow[]) {
    const parent = sourceById.get(ang.source_question_id);
    if (!parent) continue;
    pool.push({
      question_type: "angle",
      question_id: ang.id,
      chapter_code: parent.chapter_code,
      track: parent.track,
    });
  }

  // Step 4 — bucket + shuffle (pure). Pass the mode-specific cluster
  // config so the bucketer slots items into the right buckets.
  const sampled = bucketAndShuffleExamPool(pool, clustersForMode(mode));

  // Step 5 — project to ExamQuestionListItem with display_order 1..40.
  return sampled.map((it, idx) => ({
    question_type: it.question_type,
    question_id: it.question_id,
    display_order: idx + 1,
  }));
}

// =============================================================================
// Phase 3 — per-position question + attempt + bookmark resolution
// =============================================================================

/**
 * Question resolved at a given position in `exam_sessions.question_list`.
 * `archived` covers the rare case where a question was active when the
 * session was sampled but has since been RLS-hidden (status='archived'
 * or is_current=false). The page Server Component handles `archived` by
 * redirecting back to `/exam` — exam scope is more strict than practice
 * (no "skip the archived one and keep going" — the session is treated
 * as broken).
 */
export type ResolvedExamQuestion =
  | { kind: "source"; question: SourceQuestionRow }
  | { kind: "angle"; question: AngleQuestionRow; parentQuestionGroupId: string }
  | { kind: "archived" };

const SOURCE_SELECT_FULL = `
  id, question_group_id, external_id, question_text, chapter_id, subtopic_id,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_SELECT_FULL = `
  id, source_question_id, angle_letter, angle_title, display_order, question_text,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list
`;

const CHOICE_SELECT = `id, letter, choice_text, is_correct, distractor_analysis, display_order`;

type RawSource = {
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

type RawAngle = {
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

type RawChoice = {
  id: string;
  letter: string;
  choice_text: string;
  is_correct: boolean;
  distractor_analysis: string | null;
  display_order: number;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function isValidLetter(s: string): s is "א" | "ב" | "ג" | "ד" {
  return s === "א" || s === "ב" || s === "ג" || s === "ד";
}

function isValidAngleLetter(s: string): s is "א" | "ב" | "ג" | "ד" | "ה" {
  return isValidLetter(s) || s === "ה";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function mapChoices(rows: RawChoice[]): Choice[] {
  return rows
    .filter((r): r is RawChoice & { letter: "א" | "ב" | "ג" | "ד" } =>
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

/**
 * Fetch the question payload (+ choices) for a single item from
 * `exam_sessions.question_list`. Returns `kind='archived'` if RLS hid
 * the row mid-flight; the caller (page Server Component) redirects.
 *
 * NOTE: choices carry `is_correct` here — the page strips it before
 * shipping to the client via `stripAnswerFromChoices`. The Server
 * Actions reload the question independently to derive correctness;
 * they never trust client-sent answers.
 */
export async function getQuestionForExamPosition(
  supabase: SupabaseSsrClient,
  item: ExamQuestionListItem
): Promise<ResolvedExamQuestion> {
  if (item.question_type === "source") {
    const [qRes, cRes] = await Promise.all([
      supabase
        .from("source_questions")
        .select(SOURCE_SELECT_FULL)
        .eq("id", item.question_id)
        .maybeSingle<RawSource>(),
      supabase
        .from("source_choices")
        .select(CHOICE_SELECT)
        .eq("source_question_id", item.question_id)
        .returns<RawChoice[]>(),
    ]);
    if (qRes.error || !qRes.data) return { kind: "archived" };
    const row = qRes.data;
    const chapter = pickOne(row.chapter);
    const subtopic = pickOne(row.subtopic);
    return {
      kind: "source",
      question: {
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
        concepts_and_skills: toStringArray(row.concepts_and_skills),
        quick_thinking_360: row.quick_thinking_360,
        summary_for_memory: row.summary_for_memory,
        references_list: toStringArray(row.references_list),
        choices: mapChoices(cRes.data ?? []),
      },
    };
  }

  // Angle path: fetch the angle, its choices, then the parent source
  // (for the question_group_id used in bookmarks).
  const [aRes, acRes] = await Promise.all([
    supabase
      .from("angle_questions")
      .select(ANGLE_SELECT_FULL)
      .eq("id", item.question_id)
      .maybeSingle<RawAngle>(),
    supabase
      .from("angle_choices")
      .select(CHOICE_SELECT)
      .eq("angle_question_id", item.question_id)
      .returns<RawChoice[]>(),
  ]);
  if (aRes.error || !aRes.data) return { kind: "archived" };
  const ang = aRes.data;
  if (!isValidAngleLetter(ang.angle_letter)) return { kind: "archived" };

  const { data: parent } = await supabase
    .from("source_questions")
    .select("question_group_id")
    .eq("id", ang.source_question_id)
    .maybeSingle();
  if (!parent) return { kind: "archived" };

  return {
    kind: "angle",
    parentQuestionGroupId: parent.question_group_id,
    question: {
      id: ang.id,
      source_question_id: ang.source_question_id,
      angle_letter: ang.angle_letter,
      angle_title: ang.angle_title,
      display_order: ang.display_order,
      question_text: ang.question_text,
      legal_topic_analysis: ang.legal_topic_analysis,
      full_explanation: ang.full_explanation,
      common_pitfall: ang.common_pitfall,
      concepts_and_skills: toStringArray(ang.concepts_and_skills),
      quick_thinking_360: ang.quick_thinking_360,
      summary_for_memory: ang.summary_for_memory,
      references_list: toStringArray(ang.references_list),
      choices: mapChoices(acRes.data ?? []),
    },
  };
}

/**
 * The user's prior attempt for this (exam_session, question) pair, or
 * null. Used by the page Server Component to pre-fill the selected
 * letter on backward navigation.
 */
export async function getExistingExamAttempt(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string,
  item: ExamQuestionListItem
): Promise<AttemptRow | null> {
  const query = supabase
    .from("attempts")
    .select(
      "id, question_type, source_question_id, angle_question_id, selected_choice_id, selected_letter, is_correct, duration_seconds, was_skipped, attempted_at"
    )
    .eq("user_id", userId)
    .eq("exam_session_id", sessionId)
    .eq("question_type", item.question_type);

  if (item.question_type === "source") {
    query.eq("source_question_id", item.question_id);
  } else {
    query.eq("angle_question_id", item.question_id);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;
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

/**
 * Returns true iff the caller has a bookmark on the resolved exam
 * question. Bookmarks key on `source_question_group_id` for source
 * questions (so the bookmark survives version bumps) and on the angle
 * id directly. Same `bookmarks` table the practice flow uses.
 */
export async function getExamBookmarkState(
  supabase: SupabaseSsrClient,
  userId: string,
  resolved: ResolvedExamQuestion
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

// =============================================================================
// Phase 4 — per-position status + results aggregate
// =============================================================================

export type ExamPositionStatus = "correct" | "wrong" | "skipped" | "unanswered";

export type ExamLetter = "א" | "ב" | "ג" | "ד";

export type ExamByPosition = {
  position: number;
  status: ExamPositionStatus;
  /**
   * Slice 7.6 — letter the user actually picked, when they answered.
   * `null` for skipped / unanswered / no-letter-recorded. The progress
   * strip ignores this; the results-page review uses it to highlight
   * the user's wrong-choice pick.
   */
  selectedLetter: ExamLetter | null;
};

export type ExamByCluster = {
  /** Identifier for the bucket. For procedural/combined this is the
   *  cluster code (א / ב / ג / מ). For substantive results, where the
   *  byCluster array is dynamic-per-chapter, this is the chapter code
   *  (contracts, torts, …). */
  code: import("@/lib/exam/clusters").ExamClusterCode;
  /** Slice 9 — display label. Optional: procedural/combined cards render
   *  from the cluster code in the UI; substantive cards need a label
   *  (the chapter title) since the code itself is not user-facing. */
  label?: string;
  correct: number;
  total: number;
};

export type ExamReviewChoice = {
  letter: ExamLetter;
  choiceText: string;
  isCorrect: boolean;
  distractorAnalysis: string | null;
  displayOrder: number;
};

/**
 * Results-page row. Extends the base `ExamByPosition` with the data
 * the review list needs:
 *  - excerpt (truncated question_text for the collapsed row)
 *  - questionText (full text for the expanded panel)
 *  - choices (4 entries with distractor analyses) — Slice 7.6
 *
 * The play page's progress strip uses only `ExamByPosition.status`;
 * the extra fields here cost nothing for it.
 */
export type ExamReviewRow = ExamByPosition & {
  excerpt: string;
  questionText: string;
  choices: ExamReviewChoice[];
};

export type ExamResultsAggregate = {
  session: ExamSessionRow;
  byPosition: ExamReviewRow[];
  byCluster: ExamByCluster[];
};

/** First N chars of a question's text, ellipsis if truncated. */
const REVIEW_EXCERPT_MAX_CHARS = 70;
function makeExcerpt(text: string | null | undefined): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= REVIEW_EXCERPT_MAX_CHARS) return t;
  return t.slice(0, REVIEW_EXCERPT_MAX_CHARS).trimEnd() + "…";
}

/**
 * Pure mapper from a session's question_list + the raw attempts rows
 * to a position-aligned status array. Shared by the play page (lights
 * up the progress strip + fills the submit-confirm dialog's count) and
 * the results page (drives the 40-row review list).
 *
 * No I/O — caller fetches `attempts` once and threads them in.
 */
export function computePositionStatuses(
  questionList: ExamQuestionListItem[],
  attempts: Array<{
    question_type: "source" | "angle";
    source_question_id: string | null;
    angle_question_id: string | null;
    is_correct: boolean | null;
    was_skipped: boolean;
    selected_letter?: string | null;
  }>
): ExamByPosition[] {
  const attemptByKey = new Map<
    string,
    {
      is_correct: boolean | null;
      was_skipped: boolean;
      selected_letter: ExamLetter | null;
    }
  >();
  for (const a of attempts) {
    const id =
      a.question_type === "source" ? a.source_question_id : a.angle_question_id;
    if (!id) continue;
    const letter: ExamLetter | null =
      a.selected_letter === "א" ||
      a.selected_letter === "ב" ||
      a.selected_letter === "ג" ||
      a.selected_letter === "ד"
        ? a.selected_letter
        : null;
    attemptByKey.set(`${a.question_type}:${id}`, {
      is_correct: a.is_correct,
      was_skipped: a.was_skipped,
      selected_letter: letter,
    });
  }
  return questionList.map((item, position) => {
    const key = `${item.question_type}:${item.question_id}`;
    const a = attemptByKey.get(key);
    if (!a) return { position, status: "unanswered", selectedLetter: null };
    if (a.was_skipped) {
      return { position, status: "skipped", selectedLetter: a.selected_letter };
    }
    if (a.is_correct === true) {
      return { position, status: "correct", selectedLetter: a.selected_letter };
    }
    return { position, status: "wrong", selectedLetter: a.selected_letter };
  });
}

/**
 * Shared lightweight fetch: returns the position-aligned status array
 * for a session. Used by both `app/(app)/exam/play/[idx]/page.tsx` (to
 * hydrate the progress strip + submit-confirm dialog) and the results
 * aggregate. Cheap — one SELECT scoped to the session.
 */
export async function getExamPositionStatuses(
  supabase: SupabaseSsrClient,
  sessionId: string,
  questionList: ExamQuestionListItem[]
): Promise<ExamByPosition[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "question_type, source_question_id, angle_question_id, is_correct, was_skipped, selected_letter"
    )
    .eq("exam_session_id", sessionId);
  if (error || !data) {
    // Treat a failed read as all-unanswered. Either RLS hid the rows
    // (impossible — RLS only filters by user, and the session is
    // already gated) or transient. The progress strip stays useful;
    // the submit-confirm dialog over-reports unanswered which is the
    // safer direction.
    return questionList.map((_, position) => ({
      position,
      status: "unanswered" as const,
      selectedLetter: null,
    }));
  }
  return computePositionStatuses(
    questionList,
    data as Array<{
      question_type: "source" | "angle";
      source_question_id: string | null;
      angle_question_id: string | null;
      is_correct: boolean | null;
      was_skipped: boolean;
      selected_letter: string | null;
    }>
  );
}

/**
 * Resolve the chapter code (and title — Slice 9) for each item in
 * `questionList`. Returns a Map keyed by
 * `${question_type}:${question_id}`. JOINs at read time per PM decision
 * #3 (no denormalisation onto the attempts row).
 *
 * The title is needed by the substantive-mode results page, which
 * renders one card per chapter (vs the static 3-cluster card layout of
 * procedural mode).
 */
type ChapterInfo = { code: string; title: string };
async function resolveChapterCodesForList(
  supabase: SupabaseSsrClient,
  questionList: ExamQuestionListItem[]
): Promise<Map<string, ChapterInfo>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of questionList) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const map = new Map<string, ChapterInfo>();

  if (sourceIds.length > 0) {
    const { data } = await supabase
      .from("source_questions")
      .select(
        "id, chapter:chapters!source_questions_chapter_id_fkey(code, title)"
      )
      .in("id", sourceIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      chapter:
        | { code: string; title: string | null }
        | { code: string; title: string | null }[]
        | null;
    }>) {
      const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
      if (chapter?.code) {
        map.set(`source:${row.id}`, {
          code: chapter.code,
          title: chapter.title ?? chapter.code,
        });
      }
    }
  }

  if (angleIds.length > 0) {
    const { data } = await supabase
      .from("angle_questions")
      .select(
        "id, source_question:source_questions!angle_questions_source_question_id_fkey(chapter:chapters!source_questions_chapter_id_fkey(code, title))"
      )
      .in("id", angleIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      source_question:
        | {
            chapter:
              | { code: string; title: string | null }
              | { code: string; title: string | null }[]
              | null;
          }
        | {
            chapter:
              | { code: string; title: string | null }
              | { code: string; title: string | null }[]
              | null;
          }[]
        | null;
    }>) {
      const parent = Array.isArray(row.source_question)
        ? row.source_question[0]
        : row.source_question;
      const chapter = parent
        ? Array.isArray(parent.chapter)
          ? parent.chapter[0]
          : parent.chapter
        : null;
      if (chapter?.code) {
        map.set(`angle:${row.id}`, {
          code: chapter.code,
          title: chapter.title ?? chapter.code,
        });
      }
    }
  }

  return map;
}

/**
 * Resolve the question_text for each item in `questionList`. Returns a
 * Map keyed by `${question_type}:${question_id}`. Mirrors
 * resolveChapterCodesForList — two batched `.in()` queries, one per
 * question type.
 */
async function resolveQuestionTextsForList(
  supabase: SupabaseSsrClient,
  questionList: ExamQuestionListItem[]
): Promise<Map<string, string>> {
  const sourceIds: string[] = [];
  const angleIds: string[] = [];
  for (const it of questionList) {
    if (it.question_type === "source") sourceIds.push(it.question_id);
    else angleIds.push(it.question_id);
  }

  const map = new Map<string, string>();

  if (sourceIds.length > 0) {
    const { data } = await supabase
      .from("source_questions")
      .select("id, question_text")
      .in("id", sourceIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      question_text: string | null;
    }>) {
      if (row.question_text) map.set(`source:${row.id}`, row.question_text);
    }
  }

  if (angleIds.length > 0) {
    const { data } = await supabase
      .from("angle_questions")
      .select("id, question_text")
      .in("id", angleIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      question_text: string | null;
    }>) {
      if (row.question_text) map.set(`angle:${row.id}`, row.question_text);
    }
  }

  return map;
}

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
 */
async function resolveChoicesForList(
  supabase: SupabaseSsrClient,
  questionList: ExamQuestionListItem[]
): Promise<Map<string, ExamReviewChoice[]>> {
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
            "source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order"
          )
          .in("source_question_id", sourceIds)
      : Promise.resolve({ data: null as unknown }),
    angleIds.length > 0
      ? supabase
          .from("angle_choices")
          .select(
            "angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order"
          )
          .in("angle_question_id", angleIds)
      : Promise.resolve({ data: null as unknown }),
  ]);

  const map = new Map<string, ExamReviewChoice[]>();
  function pushChoice(
    key: string,
    row: {
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
    const choice: ExamReviewChoice = {
      letter: row.letter,
      choiceText: row.choice_text,
      isCorrect: row.is_correct,
      distractorAnalysis: row.distractor_analysis,
      displayOrder: row.display_order,
    };
    const arr = map.get(key) ?? [];
    arr.push(choice);
    map.set(key, arr);
  }

  for (const row of (sourceRes.data ?? []) as Array<{
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
    list.sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return map;
}

/**
 * Full aggregate for the results page: session + per-position status
 * (with question-text excerpt) + mode-aware `byCluster` breakdown.
 *
 * Slice 9 — `byCluster` is mode-aware:
 *   - procedural: 3 cluster cards (א/ב/ג) from PROCEDURAL_CLUSTERS.
 *   - combined: 4 cluster cards (א/ב/ג/מ) from COMBINED_CLUSTERS.
 *   - substantive: dynamic — one card per chapter present in this
 *     session's question_list. Codes are chapter codes, labels are
 *     chapter titles. Chapters with zero questions in the session
 *     (impossible with the current single-cluster config, but
 *     defensive) are omitted.
 *
 * Any question whose chapter doesn't fall under any cluster
 * (defensive) is excluded from the cluster cards but stays in the
 * byPosition list.
 *
 * Slice 7.6 — each byPosition row now also carries the question's
 * full text + its 4 choices with distractor analyses, so the results
 * page can render an inline per-question expansion without a drill-in.
 *
 * Returns null if the session isn't loadable (page redirects).
 */
export async function getExamResultsAggregate(
  supabase: SupabaseSsrClient,
  userId: string,
  sessionId: string
): Promise<ExamResultsAggregate | null> {
  const session = await getExamSessionById(supabase, userId, sessionId);
  if (!session) return null;

  const [statuses, chapterByItem, textByItem, choicesByItem] = await Promise.all(
    [
      getExamPositionStatuses(supabase, sessionId, session.question_list),
      resolveChapterCodesForList(supabase, session.question_list),
      resolveQuestionTextsForList(supabase, session.question_list),
      resolveChoicesForList(supabase, session.question_list),
    ]
  );

  // Enrich the status array with excerpts + full question text +
  // choices in one pass.
  const byPosition: ExamReviewRow[] = statuses.map((s, i) => {
    const item = session.question_list[i];
    const key = `${item.question_type}:${item.question_id}`;
    const text = textByItem.get(key);
    return {
      ...s,
      excerpt: makeExcerpt(text),
      questionText: text ?? "",
      choices: choicesByItem.get(key) ?? [],
    };
  });

  let byCluster: ExamByCluster[];
  if (session.mode === "substantive") {
    // Per-chapter dynamic breakdown — group by chapter code, derive
    // the human label from chapter title. Preserves the order in which
    // chapters first appear in the session's question_list so the cards
    // render in a stable, reproducible order across reloads.
    const bucketByChapter = new Map<
      string,
      { code: string; label: string; correct: number; total: number }
    >();
    for (let i = 0; i < session.question_list.length; i++) {
      const item = session.question_list[i];
      const info = chapterByItem.get(
        `${item.question_type}:${item.question_id}`
      );
      if (!info) continue;
      let bucket = bucketByChapter.get(info.code);
      if (!bucket) {
        bucket = {
          code: info.code,
          label: info.title,
          correct: 0,
          total: 0,
        };
        bucketByChapter.set(info.code, bucket);
      }
      bucket.total++;
      if (byPosition[i]?.status === "correct") bucket.correct++;
    }
    byCluster = Array.from(bucketByChapter.values());
  } else {
    const clusters = clustersForMode(session.mode);
    byCluster = clusters.map((cluster) => {
      let correct = 0;
      let total = 0;
      for (let i = 0; i < session.question_list.length; i++) {
        const item = session.question_list[i];
        const info = chapterByItem.get(
          `${item.question_type}:${item.question_id}`
        );
        if (!info) continue;
        if (!cluster.chapter_codes.includes(info.code)) continue;
        total++;
        if (byPosition[i]?.status === "correct") correct++;
      }
      return { code: cluster.code, correct, total };
    });
  }

  return { session, byPosition, byCluster };
}
