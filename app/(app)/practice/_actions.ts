"use server";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getUserBookmarks, getUserMistakes } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { practicePlayUrl } from "@/lib/urls";
import {
  createBatchReviewSessionSchema,
  createPracticeSessionSchema,
  createReviewSessionSchema,
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

    // Slice 61 — explicit target item-count drives the streaming
    // question_list build. The hook sends `totalQuestions` (the
    // user's literal pick); legacy callers (review-session helpers,
    // pre-Slice-61 tests) omit it and fall back to the historical
    // `sourceCountTarget × (1 + anglesPerSource)` derivation, which
    // matches their prior behavior verbatim.
    const targetTotal =
      data.totalQuestions ??
      data.sourceCountTarget * (1 + data.anglesPerSource);

    // Step 1 — fetch all source-question candidates matching the filters.
    // RLS already enforces status='active' AND is_current=true; we add
    // the same predicates here so a future RLS relaxation doesn't
    // silently include drafts/archived.
    //
    // Slice 65 — also project `question_group_id` so the three-pass
    // assembly below can match the user's prior attempts at the GROUP
    // level (stable identity across content versions, same approach
    // as bookmarks/mistakes use).
    let pool = supabase
      .from("source_questions")
      .select("id, question_group_id")
      .eq("status", "active")
      .eq("is_current", true)
      .in("chapter_id", data.selectedChapterIds);
    if (data.selectedSubtopicId) {
      pool = pool.eq("subtopic_id", data.selectedSubtopicId);
    }
    const { data: poolRows, error: poolError } = await pool;
    if (poolError) throw poolError;

    const poolSources = (poolRows ?? []).map((r) => ({
      id: r.id as string,
      question_group_id: r.question_group_id as string,
    }));
    if (poolSources.length === 0) {
      return {
        ok: false,
        error: "אין שאלות זמינות לפרקים שנבחרו",
      };
    }

    // Slice 65 — build the user's "seen" sets so the three-pass
    // assembly below can prefer UNSEEN items first and recycle SEEN
    // ones only as fill.
    //
    // Seen scope (PM-locked):
    //   • mode='practice' only — exam attempts do NOT count toward
    //     practice "seen".
    //   • Per-item granularity: a source attempt and each angle
    //     attempt are tracked independently. A seen source does NOT
    //     exclude its unseen angles, and vice-versa.
    //   • `was_skipped` is intentionally NOT filtered: skips would
    //     count as seen if any were written. Practice today has no
    //     skip write path (the UI exposes no skip action and
    //     submit_attempt always writes was_skipped=false), so this
    //     is moot until a future skip feature appears.
    //
    // Identity strategy:
    //   • Angles — `angle_question_id` is the stable identity
    //     (`angle_questions` has no versioning); match directly.
    //   • Sources — `attempts.source_question_id` references the row
    //     the user attempted (specific version). We resolve it to
    //     `question_group_id` via a separate lookup so a republished
    //     version of the same conceptual question still counts as
    //     seen. CAVEAT: RLS hides rows where is_current=false from
    //     the user's client, so an attempt that referenced an
    //     outdated version won't join — the new version reads as
    //     unseen to that user. Accepted as-is (rare admin path; no
    //     DB/RPC work in this slice).
    const [seenSrcAttemptsResult, seenAngleAttemptsResult] = await Promise.all(
      [
        supabase
          .from("attempts")
          .select("source_question_id, attempted_at")
          .eq("user_id", user.id)
          .eq("mode", "practice")
          .eq("question_type", "source"),
        supabase
          .from("attempts")
          .select("angle_question_id, attempted_at")
          .eq("user_id", user.id)
          .eq("mode", "practice")
          .eq("question_type", "angle"),
      ]
    );
    if (seenSrcAttemptsResult.error) throw seenSrcAttemptsResult.error;
    if (seenAngleAttemptsResult.error) throw seenAngleAttemptsResult.error;

    const angleLastAt = new Map<string, string>();
    for (const a of (seenAngleAttemptsResult.data ?? []) as Array<{
      angle_question_id: string | null;
      attempted_at: string;
    }>) {
      if (!a.angle_question_id) continue;
      const prev = angleLastAt.get(a.angle_question_id);
      if (!prev || a.attempted_at > prev) {
        angleLastAt.set(a.angle_question_id, a.attempted_at);
      }
    }

    const groupLastAt = new Map<string, string>();
    const seenSrcAttempts = (seenSrcAttemptsResult.data ?? []) as Array<{
      source_question_id: string | null;
      attempted_at: string;
    }>;
    if (seenSrcAttempts.length > 0) {
      const distinctSrcIds = Array.from(
        new Set(
          seenSrcAttempts
            .map((a) => a.source_question_id)
            .filter((v): v is string => Boolean(v))
        )
      );
      if (distinctSrcIds.length > 0) {
        const { data: srcRows, error: srcLookupError } = await supabase
          .from("source_questions")
          .select("id, question_group_id")
          .in("id", distinctSrcIds);
        if (srcLookupError) throw srcLookupError;
        const srcToGroup = new Map<string, string>();
        for (const r of (srcRows ?? []) as Array<{
          id: string;
          question_group_id: string;
        }>) {
          srcToGroup.set(r.id, r.question_group_id);
        }
        for (const a of seenSrcAttempts) {
          if (!a.source_question_id) continue;
          const g = srcToGroup.get(a.source_question_id);
          if (!g) continue; // RLS-hidden non-current row → version-bump caveat
          const prev = groupLastAt.get(g);
          if (!prev || a.attempted_at > prev) {
            groupLastAt.set(g, a.attempted_at);
          }
        }
      }
    }

    // Step 2 — fetch up to N angle questions per source for the ENTIRE
    // pool (not just a pre-sampled subset, as before Slice 65). The
    // three-pass assembly needs the angle map for every candidate
    // source so it can evaluate per-item seen/unseen at assembly time.
    // We don't trust LIMIT-per-row here; PostgREST lacks it and a
    // window-function trick would require a view. Bucket-and-slice is
    // O(angles · sources) which is fine even at full-catalog scale
    // (currently ~290 sources × 4 angles).
    const allPoolSourceIds = poolSources.map((s) => s.id);
    let angleMap = new Map<string, string[]>();
    if (data.anglesPerSource > 0) {
      const { data: angleRows, error: angleError } = await supabase
        .from("angle_questions")
        .select("id, source_question_id, display_order")
        .in("source_question_id", allPoolSourceIds)
        .order("display_order", { ascending: true });
      if (angleError) throw angleError;

      angleMap = new Map(allPoolSourceIds.map((sid) => [sid, [] as string[]]));
      for (const row of angleRows ?? []) {
        const bucket = angleMap.get(row.source_question_id);
        if (bucket && bucket.length < data.anglesPerSource) {
          bucket.push(row.id);
        }
      }
    }

    // Slice 65 — Step 3: three-pass assembly that ALWAYS reaches
    // targetTotal as long as the pool can produce it.
    //
    //   Pass 1 — UNSEEN FIRST (per-item, source-anchored).
    //     Walk shuffled pool sources. For each source: push only items
    //     whose identity is NOT in groupLastAt / angleLastAt, in
    //     canonical [source, angle_1, …] order, dropping seen items.
    //     Skip a source entirely if all its items are seen. An unseen
    //     angle whose source was seen appears STANDALONE (no re-anchor
    //     of the seen source — PM-locked).
    //   Pass 2 — TOP-UP from SEEN (whole-unit, LRU, APPENDED).
    //     If short of N: take sources NOT touched in Pass 1 (= fully
    //     seen units), order by least-recently-seen (max across the
    //     unit's group + angles, ASC), and push each as a whole unit
    //     [source, all bucketed angles]. APPEND — no interleave with
    //     Pass 1's unseen items (PM-locked).
    //   Pass 3 — SAFETY FILL from PARTIAL units.
    //     If STILL short: iterate touched units in LRU order and fill
    //     their remaining (previously-skipped seen) items.
    //
    // Slice 61's exact-N invariant is preserved by the `>= targetTotal`
    // guard on every push. Three passes together always push every
    // item the pool can produce (every pool item belongs to exactly
    // one pass), so when targetTotal ≤ pool size we always reach N.
    // If somehow targetTotal > pool size (upstream availability guard
    // prevents it), the graceful "proceed with what's available"
    // behaviour from before Slice 65 still applies.
    const shuffledPool = shuffle([...poolSources]);

    const questionList: QuestionListItem[] = [];
    const usedItemIds = new Set<string>();
    const touchedSources = new Set<string>();
    let pos = 0;

    const pushItem = (type: "source" | "angle", id: string): boolean => {
      if (questionList.length >= targetTotal) return false;
      if (usedItemIds.has(id)) return questionList.length < targetTotal;
      usedItemIds.add(id);
      questionList.push({ type, id, position: pos++ });
      return questionList.length < targetTotal;
    };

    const maxAngleAt = (angleIds: string[]): string | null => {
      let m: string | null = null;
      for (const aid of angleIds) {
        const t = angleLastAt.get(aid);
        if (t && (!m || t > m)) m = t;
      }
      return m;
    };

    const unitLastAt = (source: {
      id: string;
      question_group_id: string;
    }): string => {
      const g = groupLastAt.get(source.question_group_id) ?? null;
      const a = maxAngleAt(angleMap.get(source.id) ?? []);
      if (g && a) return g > a ? g : a;
      return g ?? a ?? "";
    };

    // --- Pass 1: UNSEEN FIRST (per-item, source-anchored) ---
    let pass1Pushed = 0;
    for (const src of shuffledPool) {
      if (questionList.length >= targetTotal) break;
      const angleIds = angleMap.get(src.id) ?? [];
      const sourceUnseen = !groupLastAt.has(src.question_group_id);
      const unseenAngles = angleIds.filter((aid) => !angleLastAt.has(aid));
      if (!sourceUnseen && unseenAngles.length === 0) continue;

      const lenBefore = questionList.length;
      let canContinue = true;
      if (sourceUnseen) {
        if (!pushItem("source", src.id)) {
          canContinue = false;
        }
      }
      if (canContinue) {
        for (const aid of unseenAngles) {
          if (!pushItem("angle", aid)) {
            canContinue = false;
            break;
          }
        }
      }
      if (questionList.length > lenBefore) touchedSources.add(src.id);
      pass1Pushed += questionList.length - lenBefore;
      if (!canContinue) break;
    }

    // --- Pass 2: TOP-UP from SEEN (whole-unit, LRU, appended) ---
    let pass2Pushed = 0;
    if (questionList.length < targetTotal) {
      const recycleCandidates = shuffledPool
        .filter((s) => !touchedSources.has(s.id))
        .map((s) => ({ src: s, lastAt: unitLastAt(s) }))
        .sort((a, b) => {
          if (a.lastAt === b.lastAt) return 0;
          return a.lastAt < b.lastAt ? -1 : 1;
        });
      for (const { src } of recycleCandidates) {
        if (questionList.length >= targetTotal) break;
        const lenBefore = questionList.length;
        let canContinue = pushItem("source", src.id);
        if (canContinue) {
          for (const aid of angleMap.get(src.id) ?? []) {
            if (!pushItem("angle", aid)) {
              canContinue = false;
              break;
            }
          }
        }
        if (questionList.length > lenBefore) touchedSources.add(src.id);
        pass2Pushed += questionList.length - lenBefore;
        if (!canContinue) break;
      }
    }

    // --- Pass 3: SAFETY FILL — leftover items from partial units ---
    let pass3Pushed = 0;
    if (questionList.length < targetTotal) {
      const leftoverCandidates = shuffledPool
        .filter((s) => touchedSources.has(s.id))
        .map((s) => ({ src: s, lastAt: unitLastAt(s) }))
        .sort((a, b) => {
          if (a.lastAt === b.lastAt) return 0;
          return a.lastAt < b.lastAt ? -1 : 1;
        });
      for (const { src } of leftoverCandidates) {
        if (questionList.length >= targetTotal) break;
        const lenBefore = questionList.length;
        let canContinue = true;
        if (!usedItemIds.has(src.id)) {
          if (!pushItem("source", src.id)) canContinue = false;
        }
        if (canContinue) {
          for (const aid of angleMap.get(src.id) ?? []) {
            if (usedItemIds.has(aid)) continue;
            if (!pushItem("angle", aid)) {
              canContinue = false;
              break;
            }
          }
        }
        pass3Pushed += questionList.length - lenBefore;
        if (!canContinue) break;
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
        // Slice 24 — `time_per_question_seconds` stays NOT NULL on
        // the DB; keep writing the legacy default so the column
        // validates. The play UI no longer reads it. The new
        // `session_duration_seconds` field is the per-session timer
        // budget (0 = no timer).
        time_per_question_seconds: data.timePerQuestionSeconds,
        session_duration_seconds: data.sessionDurationSeconds,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    // TODO(slice-7): structured logger.
    // Slice 65 — pass attribution surfaces how often the unseen-first
    // path satisfies a session vs. how often we fall back to LRU
    // recycle. Useful when tuning content coverage per chapter.
    console.info(
      `[practice] create_session OK user=${user.id} session=${inserted.id} items=${questionList.length} pass1=${pass1Pushed} pass2=${pass2Pushed} pass3=${pass3Pushed}`
    );

    // Sidebar layout query may grow to surface an active-session badge
    // later; revalidate now so the convention is established (matches
    // Slice 1's pattern after every auth/sub-state mutation).
    revalidatePath("/", "layout");

    return {
      ok: true,
      url: practicePlayUrl(inserted.id, 0),
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

// =============================================================================
// createReviewSession — single-question review from /bookmarks or /mistakes
// =============================================================================

/**
 * Creates a single-question "review" practice_session for the given
 * bookmark or mistake target. Same `practice_sessions` table — the
 * review-flavour distinction is implicit:
 *   - source_count_target = 1
 *   - angles_per_source   = 0
 *   - selected_chapters   = []
 *   - selected_subtopics  = []
 *   - question_list       = [{type, id, position: 0}]
 *
 * Phase 3's /practice/play/[idx] page handles the rest. After answer +
 * 360°, the "השאלה הבאה" CTA advances past the only item and lands on
 * /practice/summary.
 *
 * Why we don't just deep-link to the existing session: the Phase 3
 * replay-mode pre-reveals the user's prior choice (auto-expand 360°),
 * which defeats the purpose of reviewing. A fresh session forces a
 * fresh attempt with timer, lets the user see if they've improved, and
 * the original mistake history stays intact (record_mistake increments
 * rather than overwrites).
 */
export async function createReviewSession(
  input: unknown
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = createReviewSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "פרמטרים לא תקינים",
    };
  }
  const data = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    // Resolve target → the question id that goes into question_list.
    // Source path: question_group_id → current source_questions row.
    // RLS hides status='archived' rows; treat missing as archived.
    let targetId: string | null = null;
    if (data.questionType === "source") {
      const { data: srcRow } = await supabase
        .from("source_questions")
        .select("id")
        .eq("question_group_id", data.sourceQuestionGroupId!)
        .eq("is_current", true)
        .eq("status", "active")
        .maybeSingle();
      targetId = srcRow?.id ?? null;
    } else {
      const { data: angleRow } = await supabase
        .from("angle_questions")
        .select("id")
        .eq("id", data.angleQuestionId!)
        .maybeSingle();
      targetId = angleRow?.id ?? null;
    }

    if (!targetId) {
      console.info(
        `[practice] create_review_session ARCHIVED user=${user.id} target_type=${data.questionType}`
      );
      return { ok: false, error: "השאלה כבר אינה זמינה" };
    }

    // Same defensive abandon-active-session as createPracticeSession.
    await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "active");

    const questionList: QuestionListItem[] = [
      { type: data.questionType, id: targetId, position: 0 },
    ];

    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: [],
        selected_subtopics: [],
        source_count_target: 1,
        angles_per_source: 0,
        time_per_question_seconds: 150,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    console.info(
      `[practice] create_review_session OK user=${user.id} session=${inserted.id} target_type=${data.questionType} target_id=${targetId}`
    );
    revalidatePath("/", "layout");
    return { ok: true, url: practicePlayUrl(inserted.id, 0) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[practice] create_review_session FAILED user=${user.id} code=${
        code ?? "unknown"
      } message=${message}`
    );
    return { ok: false, error: "לא ניתן לפתוח את השאלה. נסה שוב" };
  }
}

// =============================================================================
// createBatchReviewSession — multi-question review from /bookmarks or /mistakes
// =============================================================================

const BATCH_SIZE_MAX = 50;

/**
 * Builds a multi-question practice_session from the user's bookmarks or
 * mistakes (most-recent first, capped at BATCH_SIZE_MAX). Optional
 * chapter filter applies the same way it does in the client filter
 * chips — items whose underlying question belongs to a different chapter
 * are excluded. Archived items are excluded silently (they're already
 * RLS-hidden upstream in getUserBookmarks/getUserMistakes).
 *
 * Same `practice_sessions` table as createPracticeSession; the
 * batch-review flavour is implicit:
 *   - selected_chapters: []
 *   - selected_subtopics: []
 *   - source_count_target: <count of source items in batch>
 *   - angles_per_source: 0
 *   - question_list: built array of up to N items in source order
 *
 * Returns `{ok:false, error:"empty_list"}` when the filtered set is
 * empty; the caller surfaces a Hebrew toast.
 */
export async function createBatchReviewSession(
  input: unknown
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = createBatchReviewSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "פרמטרים לא תקינים",
    };
  }
  const { source, chapterIdFilter } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    // Pull the full list using the existing helpers — they already
    // filter by user_id (RLS) and resolve archived/non-current rows
    // into `isArchived=true` markers we can drop here.
    const rows =
      source === "bookmarks"
        ? await getUserBookmarks(supabase, user.id)
        : await getUserMistakes(supabase, user.id);

    type BatchItem = { type: "source" | "angle"; id: string };
    const items: BatchItem[] = [];
    for (const r of rows) {
      const isArchived =
        r.questionType === "source"
          ? r.sourceQuestion.isArchived
          : r.angleQuestion.isArchived;
      if (isArchived) continue;

      const chapterId =
        r.questionType === "source"
          ? r.sourceQuestion.chapterId
          : r.angleQuestion.chapterId;
      if (chapterIdFilter && chapterId !== chapterIdFilter) continue;

      if (r.questionType === "source") {
        // sourceQuestion.id is the current source_questions.id resolved
        // from the bookmark/mistake's question_group_id by the loader.
        items.push({ type: "source", id: r.sourceQuestion.id });
      } else {
        items.push({ type: "angle", id: r.angleQuestion.id });
      }

      if (items.length >= BATCH_SIZE_MAX) break;
    }

    if (items.length === 0) {
      console.info(
        `[practice] create_batch_review_session EMPTY user=${user.id} source=${source} chapter=${chapterIdFilter ?? "*"}`
      );
      return { ok: false, error: "empty_list" };
    }

    // Abandon any active session for this user before swapping in the
    // new one (same pattern as createPracticeSession / createReviewSession).
    await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "active");

    const questionList = items.map((it, idx) => ({
      type: it.type,
      id: it.id,
      position: idx,
    }));

    const sourceCount = items.filter((it) => it.type === "source").length;

    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: [],
        selected_subtopics: [],
        // source_count_target reflects only the source-typed items so the
        // summary page's "source vs angle" breakdown stays sensible even
        // for batches dominated by angle picks (mostly mistakes lists).
        source_count_target: sourceCount,
        angles_per_source: 0,
        time_per_question_seconds: 150,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    console.info(
      `[practice] create_batch_review_session OK user=${user.id} session=${inserted.id} count=${items.length} source=${source} chapter=${chapterIdFilter ?? "*"}`
    );
    revalidatePath("/", "layout");
    return { ok: true, url: practicePlayUrl(inserted.id, 0) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[practice] create_batch_review_session FAILED user=${user.id} code=${
        code ?? "unknown"
      } message=${message}`
    );
    return { ok: false, error: "לא ניתן לפתוח את התרגול. נסה שוב" };
  }
}
