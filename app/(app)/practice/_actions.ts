"use server";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";
import {
  createPracticeSessionSchema,
  getAvailableQuestionCountSchema,
  type CreatePracticeSessionInput,
  type GetAvailableQuestionCountInput,
} from "@/lib/validators/practice";

// =============================================================================
// Types
// =============================================================================

type ActionResult = { ok: true } | { ok: false; error: string };

type AvailableCountResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

type CreateSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Fisher-Yates in-place shuffle. Used to randomize the source-question
 * pool client-side after a non-random Supabase SELECT. Supabase's
 * PostgREST surface doesn't expose `ORDER BY random()`; a dedicated
 * SECURITY DEFINER RPC would be the alternative but adds DB-layer
 * complexity for a small-array operation that runs once per session
 * creation.
 *
 * Math.random() is good enough for picking practice questions — we are
 * not running a lottery. Cryptographic randomness would be overkill.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Question-list item stored in practice_sessions.question_list (jsonb).
 * Explicit `position` is included for stable rendering on resume — the
 * idx URL segment and this field stay in lock-step. See plan review Part
 * 3 decision #1 (positional explicit > implicit array index).
 */
type QuestionListItem =
  | { type: "source"; id: string; position: number }
  | { type: "angle"; id: string; position: number };

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Reactive availability lookup powering the "כרגע יש N שאלות זמינות"
 * subtitle and the disabled-state of the source-count buttons. Called
 * from the client every time the user toggles a chapter or subtopic
 * (debounced via React useTransition on the form side).
 *
 * Auth: gated by requireActiveSubscription() — the source_questions RLS
 * already requires has_active_subscription(), but gating here yields a
 * cleaner Hebrew error than letting the SELECT return 0 rows for an
 * expired user (which would misleadingly read as "no questions").
 */
export async function getAvailableQuestionCount(
  input: GetAvailableQuestionCountInput
): Promise<AvailableCountResult> {
  const parsed = getAvailableQuestionCountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "קלט לא תקין",
    };
  }

  await requireActiveSubscription();
  const supabase = await createClient();

  let query = supabase
    .from("source_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("is_current", true)
    .in("chapter_id", parsed.data.chapterIds);

  if (parsed.data.subtopicId) {
    query = query.eq("subtopic_id", parsed.data.subtopicId);
  }

  const { count, error } = await query;
  if (error) {
    console.error(
      `[practice] available_count FAILED code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  return { ok: true, count: count ?? 0 };
}

/**
 * Creates a new practice_session row and returns the URL of its first
 * question. Validates input, abandons any pre-existing active session
 * for this user (UI normally guards against this, but a stale tab could
 * race), random-samples source questions, expands each with its angles
 * in display_order, and builds the question_list jsonb with explicit
 * positions.
 *
 * Return shape mirrors Slice 1's cross-layout-redirect convention
 * (verifyOtpAction, completeGoogleOAuthSignup): the client takes the
 * returned url and runs window.location.assign so the navigation to
 * /practice/play/0 forces a fresh RSC render rather than reusing a
 * cached /practice segment.
 *
 * If the random sample returns fewer rows than sourceCountTarget (e.g.,
 * admin archived questions between the UI's availability check and the
 * submit), the action proceeds with what's available rather than
 * failing — better to start a shorter session than to bounce.
 */
export async function createPracticeSession(
  input: CreatePracticeSessionInput
): Promise<CreateSessionResult> {
  const parsed = createPracticeSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    // Defensive: abandon any active session for this user before creating
    // a new one. The UI's resume-prompt path normally prevents two
    // overlapping active sessions, but a stale tab or a race between two
    // submissions could create one.
    await supabase
      .from("practice_sessions")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    // Step 1 — fetch all source-question ids matching the filters. RLS
    // already enforces status='active' AND is_current=true; we add the
    // same predicates here so a future RLS relaxation doesn't silently
    // include drafts/archived. Random sampling is done client-side via
    // Fisher-Yates (see helper above).
    let pool = supabase
      .from("source_questions")
      .select("id")
      .eq("status", "active")
      .eq("is_current", true)
      .in("chapter_id", data.selectedChapterIds);
    if (data.selectedSubtopicId) {
      pool = pool.eq("subtopic_id", data.selectedSubtopicId);
    }
    const { data: poolRows, error: poolError } = await pool;
    if (poolError) throw poolError;

    const allIds = (poolRows ?? []).map((r) => r.id);
    const sourceIds = shuffle([...allIds]).slice(0, data.sourceCountTarget);
    if (sourceIds.length === 0) {
      return {
        ok: false,
        error: "אין שאלות זמינות לפרקים שנבחרו",
      };
    }

    // Step 2 — fetch up to N angle questions per source in a single
    // round-trip, then bucket them in TS. We don't trust LIMIT-per-row
    // here; PostgREST lacks it and a window-function trick would require
    // a view. Bucket-and-slice is O(angles · sources) which is fine for
    // a 50-source session with 4 angles each.
    let angleMap = new Map<string, string[]>();
    if (data.anglesPerSource > 0) {
      const { data: angleRows, error: angleError } = await supabase
        .from("angle_questions")
        .select("id, source_question_id, display_order")
        .in("source_question_id", sourceIds)
        .order("display_order", { ascending: true });
      if (angleError) throw angleError;

      angleMap = new Map(sourceIds.map((sid) => [sid, [] as string[]]));
      for (const row of angleRows ?? []) {
        const bucket = angleMap.get(row.source_question_id);
        if (bucket && bucket.length < data.anglesPerSource) {
          bucket.push(row.id);
        }
      }
    }

    // Step 3 — build the question_list jsonb. Each source is followed
    // immediately by its angles in display_order; positions are dense
    // and start at 0.
    const questionList: QuestionListItem[] = [];
    let pos = 0;
    for (const sid of sourceIds) {
      questionList.push({ type: "source", id: sid, position: pos++ });
      const angles = angleMap.get(sid) ?? [];
      for (const aid of angles) {
        questionList.push({ type: "angle", id: aid, position: pos++ });
      }
    }

    // Step 4 — insert the session row. selected_subtopics stays empty
    // when no subtopic is picked (matches the prototype's "all subtopics
    // of the chapter" semantics).
    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: data.selectedChapterIds,
        selected_subtopics: data.selectedSubtopicId
          ? [data.selectedSubtopicId]
          : [],
        source_count_target: data.sourceCountTarget,
        angles_per_source: data.anglesPerSource,
        time_per_question_seconds: data.timePerQuestionSeconds,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    // TODO(slice-7): structured logger.
    console.info(
      `[practice] create_session OK user=${user.id} session=${inserted.id} items=${questionList.length}`
    );

    // Sidebar layout query may grow to surface an active-session badge
    // later; revalidate now so the convention is established (matches
    // Slice 1's pattern after every auth/sub-state mutation).
    revalidatePath("/", "layout");

    return {
      ok: true,
      url: `/practice/play/0?session=${inserted.id}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[practice] create_session FAILED user=${user.id} code=${
        code ?? "unknown"
      } message=${message}`
    );
    return { ok: false, error: "הסשן לא נוצר, נסה שוב" };
  }
}

/**
 * Marks the user's current active practice_session as abandoned. Called
 * from the resume prompt's "התחל מחדש" CTA. After the update, the
 * /practice page is revalidated so the next render no longer shows the
 * prompt and the user lands directly on the setup form.
 *
 * Idempotent — runs the UPDATE regardless of whether an active session
 * exists; the WHERE clause is the gate.
 */
export async function abandonActiveSession(): Promise<ActionResult> {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("practice_sessions")
    .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error(
      `[practice] abandon_session FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה. נסה שוב" };
  }

  console.info(`[practice] abandon_session OK user=${user.id}`);
  revalidatePath("/practice", "page");
  return { ok: true };
}
