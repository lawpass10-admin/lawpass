/**
 * Slice 3 — Exam-mode DB helpers + sampling. Server-only.
 *
 * Mirrors the shape of `lib/db/practice.ts`: caller is responsible for
 * `requireActiveSubscription()` before any of these run. Every read
 * goes through RLS; we never use the admin client.
 *
 * The cluster-weighted sampling logic is split in two layers:
 *   - `sampleExamQuestions(supabase)` — thin DB shim that fetches the
 *     full eligible pool (source + angle) and projects each row into a
 *     `PoolItem` carrying its chapter code.
 *   - `bucketAndShuffleExamPool(pool, clusters)` — PURE function. No
 *     supabase, no I/O. Unit-tested with fixtures in
 *     `tests/exam-sampling.test.ts`. Lives here for colocation but
 *     stays import-free of anything async.
 *
 * The pure helper does three passes:
 *   1. Per-cluster pick (in `EXAM_CLUSTERS` order: א, ב, ג).
 *   2. Global padding from leftovers if any cluster underflowed.
 *   3. Final shuffle of the assembled 40 so the user doesn't see
 *      cluster grouping in the question stream.
 */

import {
  EXAM_TOTAL_QUESTIONS,
  type ExamCluster,
  EXAM_CLUSTERS,
} from "@/lib/exam/clusters";
import type { createClient } from "@/lib/supabase/server";

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
};

/**
 * Internal pool-item shape used during sampling. Carries the chapter
 * code so the bucketer can split by cluster without re-joining.
 */
export type ExamPoolItem = {
  question_type: ExamQuestionType;
  question_id: string;
  chapter_code: string;
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
  "active_window_token, started_at, paused_at, completed_at, last_activity_at";

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

/**
 * Build the 40-question list for a new exam session. Returns items in
 * the order they will be presented (post-final-shuffle), with
 * `display_order` assigned 1..40 densely.
 *
 * RLS-aware: every read goes through the SSR client. Archived /
 * non-current source questions are hidden by RLS, and angles whose
 * parent is RLS-hidden are also filtered out.
 */
export async function sampleExamQuestions(
  supabase: SupabaseSsrClient
): Promise<ExamQuestionListItem[]> {
  // Step 1 — fetch all active+current source questions with their
  // chapter codes. PostgREST's embedded select gives us the chapter
  // code via the FK relation.
  const { data: srcRows, error: srcErr } = await supabase
    .from("source_questions")
    .select("id, chapter:chapters!source_questions_chapter_id_fkey(code)")
    .eq("is_current", true)
    .eq("status", "active");
  if (srcErr) throw srcErr;

  const sourceById = new Map<string, SourceRow>();
  for (const row of (srcRows ?? []) as Array<{
    id: string;
    chapter: { code: string } | { code: string }[] | null;
  }>) {
    const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
    if (!chapter?.code) continue;
    sourceById.set(row.id, { id: row.id, chapter_code: chapter.code });
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
    });
  }
  for (const ang of (angleRows ?? []) as AngleRow[]) {
    const parent = sourceById.get(ang.source_question_id);
    if (!parent) continue;
    pool.push({
      question_type: "angle",
      question_id: ang.id,
      chapter_code: parent.chapter_code,
    });
  }

  // Step 4 — bucket + shuffle (pure).
  const sampled = bucketAndShuffleExamPool(pool);

  // Step 5 — project to ExamQuestionListItem with display_order 1..40.
  return sampled.map((it, idx) => ({
    question_type: it.question_type,
    question_id: it.question_id,
    display_order: idx + 1,
  }));
}
