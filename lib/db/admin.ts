/**
 * Slice 6 admin-panel DB helpers. Server-only.
 *
 * Convention (matches lib/db/dashboard.ts):
 *   - SSR Supabase client is the first argument; caller hands it in
 *     from a Server Component or Server Action.
 *   - `requireAdmin()` runs BEFORE any of these — admin RLS is defense
 *     in depth, but the gate is the primary auth boundary.
 *   - Reads return raw values (no { ok, value } wrapper). Aggregations
 *     happen in TS — current dataset (147 source / 586 angle) is too
 *     small to justify pushing aggregates into SQL or new RPCs, and
 *     this file is meant to stay zero-migration.
 *
 * No service-role client is needed for Phase A: cross-user reads against
 * profiles / subscriptions / source_questions / angle_questions all pass
 * through the `public.is_admin()` companion RLS policies.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = SupabaseClient;

// =============================================================================
// Types
// =============================================================================

export type ChapterTrack = "procedural" | "substantive";

export type SourceQuestionStatus = "draft" | "active" | "archived";

export type ContentFilters = {
  /** ISO year ("2019", "2024", …) or null for "all". */
  year: string | null;
  /** Chapter track or null for "all". */
  track: ChapterTrack | null;
};

/** Stats summary for the top row of /admin. */
export type AdminStats = {
  totalUsers: number;
  totalSourceQuestions: number;
  /** Plan-type -> count of currently-active subscriptions. */
  activeSubscriptionsByPlan: Record<string, number>;
};

/** Per-chapter row for the content table. */
export type ChapterContentRow = {
  chapterId: string;
  chapterCode: string;
  chapterTitle: string;
  track: ChapterTrack;
  sourceQuestionCount: number;
  angleQuestionCount: number;
  /** Source questions whose angle count is not exactly 4 (after year filter). */
  sourcesWithWrongAngleCount: number;
  /** Source questions whose status is not 'active' (after year filter). */
  sourcesNotActive: number;
};

/** One row in the /admin/users table. */
export type AdminUserRow = {
  userId: string;
  fullName: string;
  email: string | null;
  signedUpAt: string; // ISO timestamp from profiles.created_at
  examDatePlanned: string | null; // YYYY-MM-DD or null
  lastSignInAt: string | null; // ISO timestamp or null
  activeSubscription:
    | { planType: string; endsAt: string }
    | null;
};

/** Full payload for the /admin/users/[userId] detail page. */
export type AdminUserDetail = {
  userId: string;
  profile: {
    fullName: string;
    phone: string | null;
    gender: string;
    birthDate: string; // YYYY-MM-DD
    examDatePlanned: string | null;
    signupSource: string;
    createdAt: string;
  };
  auth: {
    email: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
  };
  activeSubscription:
    | { planType: string; endsAt: string }
    | null;
  recentAttempts: AdminAttemptRow[];
};

export type AdminAttemptRow = {
  id: string;
  attemptedAt: string;
  questionType: "source" | "angle";
  mode: "practice" | "exam";
  isCorrect: boolean | null;
  wasSkipped: boolean;
  durationSeconds: number | null;
};

/** Drill-down row for a single chapter's source-question list. */
export type ChapterDrillRow = {
  sourceId: string;
  externalId: string;
  snippet: string;
  subtopicTitle: string;
  examYear: number | null;
  status: SourceQuestionStatus;
  angleCount: number;
  difficultyLevel: number | null;
};

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Extract `exam_year` from a `source_questions.source_metadata` JSONB
 * value. The seed migrations stamp this as a JSON number, but the
 * column is typed as `unknown` from PostgREST so we defensively coerce.
 */
function extractExamYear(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as Record<string, unknown>).exam_year;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function isChapterTrack(v: unknown): v is ChapterTrack {
  return v === "procedural" || v === "substantive";
}

function isSourceStatus(v: unknown): v is SourceQuestionStatus {
  return v === "draft" || v === "active" || v === "archived";
}

const SNIPPET_MAX_CHARS = 80;
function makeSnippet(text: string | null | undefined): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= SNIPPET_MAX_CHARS) return t;
  return t.slice(0, SNIPPET_MAX_CHARS).trimEnd() + "…";
}

// =============================================================================
// Public API — stats summary
// =============================================================================

/**
 * Top-line counts for the /admin stats row. Three parallel queries:
 *   - profiles (head-only count)
 *   - source_questions (head-only count)
 *   - subscriptions (rows — we need plan_type to group)
 *
 * Plan-type breakdown filters in TS to the canonical "active" definition:
 * is_current AND status='active' AND ends_at > now. Mirrors every other
 * subscription read in the app.
 */
export async function getAdminStats(
  supabase: SupabaseSsrClient
): Promise<AdminStats> {
  const nowIso = new Date().toISOString();

  const [profilesRes, sourceRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("source_questions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("plan_type")
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", nowIso),
  ]);

  const activeSubscriptionsByPlan: Record<string, number> = {};
  const subRows = (subsRes.data ?? []) as Array<{ plan_type: string }>;
  for (const r of subRows) {
    if (typeof r.plan_type !== "string") continue;
    activeSubscriptionsByPlan[r.plan_type] =
      (activeSubscriptionsByPlan[r.plan_type] ?? 0) + 1;
  }

  return {
    totalUsers: profilesRes.count ?? 0,
    totalSourceQuestions: sourceRes.count ?? 0,
    activeSubscriptionsByPlan,
  };
}

// =============================================================================
// Public API — content table
// =============================================================================

/**
 * Distinct `exam_year` values found across all source questions, sorted
 * ascending. Used to populate the year filter dropdown. Reads
 * `source_metadata` for every row — fine at current scale (147 source
 * questions). When the dataset grows past a few thousand, push this to
 * a SQL view or RPC.
 */
export async function getAvailableExamYears(
  supabase: SupabaseSsrClient
): Promise<number[]> {
  const { data } = await supabase
    .from("source_questions")
    .select("source_metadata");
  const set = new Set<number>();
  for (const row of (data ?? []) as Array<{ source_metadata: unknown }>) {
    const y = extractExamYear(row.source_metadata);
    if (y !== null) set.add(y);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Per-chapter content rows for the admin content table. Filters narrow
 * the counts in-place: a year filter restricts which source questions
 * are tallied; a track filter restricts which chapters appear.
 *
 * Three parallel reads, then everything aggregates in TS:
 *   - chapters: id, code, title, display_order, track
 *   - source_questions: id, chapter_id, status, source_metadata
 *   - angle_questions: source_question_id (one row per angle)
 *
 * Admin RLS makes all three readable; the SSR client (RLS-scoped to the
 * caller) is sufficient.
 */
export async function getChapterContentRows(
  supabase: SupabaseSsrClient,
  filters: ContentFilters
): Promise<ChapterContentRow[]> {
  const [chaptersRes, sourcesRes, anglesRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, display_order, track")
      .order("display_order", { ascending: true }),
    supabase
      .from("source_questions")
      .select("id, chapter_id, status, source_metadata"),
    supabase.from("angle_questions").select("source_question_id"),
  ]);

  const rawChapters = (chaptersRes.data ?? []) as Array<{
    id: string;
    code: string;
    title: string;
    display_order: number;
    track: string | null;
  }>;
  const rawSources = (sourcesRes.data ?? []) as Array<{
    id: string;
    chapter_id: string;
    status: string | null;
    source_metadata: unknown;
  }>;
  const rawAngles = (anglesRes.data ?? []) as Array<{
    source_question_id: string;
  }>;

  // angle_questions tally per source_question_id.
  const anglesBySource = new Map<string, number>();
  for (const a of rawAngles) {
    if (!a.source_question_id) continue;
    anglesBySource.set(
      a.source_question_id,
      (anglesBySource.get(a.source_question_id) ?? 0) + 1
    );
  }

  // Pre-filter source questions by the year filter. Track filter is
  // applied later via the chapter loop.
  const yearFilter = filters.year === null ? null : Number(filters.year);
  const yearIsFinite =
    yearFilter !== null && Number.isFinite(yearFilter) && yearFilter > 0;
  const sourcesAfterYearFilter = rawSources.filter((s) => {
    if (!yearIsFinite) return true;
    return extractExamYear(s.source_metadata) === yearFilter;
  });

  // Bucket pre-filtered sources by chapter for O(1) lookup.
  const sourcesByChapter = new Map<
    string,
    Array<(typeof sourcesAfterYearFilter)[number]>
  >();
  for (const s of sourcesAfterYearFilter) {
    const arr = sourcesByChapter.get(s.chapter_id) ?? [];
    arr.push(s);
    sourcesByChapter.set(s.chapter_id, arr);
  }

  const rows: ChapterContentRow[] = [];
  for (const c of rawChapters) {
    if (!isChapterTrack(c.track)) continue;
    if (filters.track !== null && c.track !== filters.track) continue;

    const chapSources = sourcesByChapter.get(c.id) ?? [];
    let angleCount = 0;
    let sourcesWithWrongAngleCount = 0;
    let sourcesNotActive = 0;
    for (const s of chapSources) {
      const aCount = anglesBySource.get(s.id) ?? 0;
      angleCount += aCount;
      if (aCount !== 4) sourcesWithWrongAngleCount++;
      if (!isSourceStatus(s.status) || s.status !== "active") {
        sourcesNotActive++;
      }
    }
    rows.push({
      chapterId: c.id,
      chapterCode: c.code,
      chapterTitle: c.title,
      track: c.track,
      sourceQuestionCount: chapSources.length,
      angleQuestionCount: angleCount,
      sourcesWithWrongAngleCount,
      sourcesNotActive,
    });
  }
  return rows;
}

// =============================================================================
// Public API — chapter drill-down
// =============================================================================

/**
 * Source questions for a single chapter, enriched with subtopic title,
 * exam year, angle count, status and difficulty level. Respects the
 * caller's year filter so drilling in from a filtered table stays
 * consistent.
 *
 * Chapter title + track are returned alongside the rows so the page
 * Server Component can render the header without a separate lookup.
 */
export async function getChapterDrillDown(
  supabase: SupabaseSsrClient,
  chapterId: string,
  filters: ContentFilters
): Promise<{
  chapter:
    | {
        id: string;
        code: string;
        title: string;
        track: ChapterTrack;
      }
    | null;
  rows: ChapterDrillRow[];
}> {
  const [chapterRes, sourcesRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, track")
      .eq("id", chapterId)
      .maybeSingle(),
    supabase
      .from("source_questions")
      .select(
        "id, external_id, question_text, status, source_metadata, difficulty_level, subtopic:subtopics!source_questions_subtopic_id_fkey(title)"
      )
      .eq("chapter_id", chapterId),
  ]);

  const chapterRow = chapterRes.data as {
    id: string;
    code: string;
    title: string;
    track: string | null;
  } | null;

  const chapter =
    chapterRow && isChapterTrack(chapterRow.track)
      ? {
          id: chapterRow.id,
          code: chapterRow.code,
          title: chapterRow.title,
          track: chapterRow.track,
        }
      : null;

  const rawSources = (sourcesRes.data ?? []) as Array<{
    id: string;
    external_id: string;
    question_text: string | null;
    status: string | null;
    source_metadata: unknown;
    difficulty_level: number | null;
    subtopic: { title: string } | { title: string }[] | null;
  }>;

  const yearFilter = filters.year === null ? null : Number(filters.year);
  const yearIsFinite =
    yearFilter !== null && Number.isFinite(yearFilter) && yearFilter > 0;

  const filteredSources = rawSources.filter((s) => {
    if (!yearIsFinite) return true;
    return extractExamYear(s.source_metadata) === yearFilter;
  });

  // Single batched angle-count lookup for this chapter's sources.
  const sourceIds = filteredSources.map((s) => s.id);
  const anglesBySource = new Map<string, number>();
  if (sourceIds.length > 0) {
    const { data: angleData } = await supabase
      .from("angle_questions")
      .select("source_question_id")
      .in("source_question_id", sourceIds);
    for (const a of (angleData ?? []) as Array<{
      source_question_id: string;
    }>) {
      anglesBySource.set(
        a.source_question_id,
        (anglesBySource.get(a.source_question_id) ?? 0) + 1
      );
    }
  }

  const rows: ChapterDrillRow[] = filteredSources
    .map((s) => {
      const subtopic = Array.isArray(s.subtopic) ? s.subtopic[0] : s.subtopic;
      return {
        sourceId: s.id,
        externalId: s.external_id,
        snippet: makeSnippet(s.question_text),
        subtopicTitle: subtopic?.title ?? "—",
        examYear: extractExamYear(s.source_metadata),
        status: isSourceStatus(s.status) ? s.status : "draft",
        angleCount: anglesBySource.get(s.id) ?? 0,
        difficultyLevel:
          typeof s.difficulty_level === "number" ? s.difficulty_level : null,
      };
    })
    .sort((a, b) => a.externalId.localeCompare(b.externalId, "he"));

  return { chapter, rows };
}

// =============================================================================
// Public API — users list (Phase B)
// =============================================================================

/** Cap on /admin/users page size. The brief asks for 50; the dataset is
 *  ~10 users today. */
export const ADMIN_USERS_PAGE_SIZE = 50;

/**
 * Build one page of /admin/users rows.
 *
 * Implementation note (fix-admin-users, May 2026): the Supabase Auth
 * Admin API's `listUsers()` endpoint is currently broken for this
 * project's gotrue version — it returns HTTP 500 with the underlying
 * Go error "sql: Scan error on column index 8, name \"email_change\":
 * converting NULL to string is unsupported". The list endpoint's
 * scanner can't handle NULL in `auth.users.email_change`, which is
 * NULL for every user who has never requested an email change (the
 * default). Confirmed via the Supabase auth-service logs.
 *
 * Workaround: drive pagination from `profiles` (admin RLS lets us
 * read all rows ordered by created_at) and fan out per-user
 * `getUserById()` calls in parallel for the auth columns we need.
 * The single-user gotrue endpoint uses a different code path and is
 * NOT affected by the bug.
 *
 * Trade-off: N+1 HTTP calls to gotrue per page (capped at perPage,
 * default 50). All issued in parallel via Promise.all, so the wall-
 * clock cost is ~one gotrue round-trip. With ~10 users today this is
 * imperceptible; at the page cap of 50 users it's still under a
 * second.
 *
 * SSR client (admin RLS) for profiles + subscriptions. Service-role
 * client ONLY for the per-user auth fetch, and only the documented
 * columns (id, email, last_sign_in_at, created_at) — never
 * encrypted_password or any token column.
 *
 * Caller must invoke requireAdmin() BEFORE creating the admin client.
 */
export async function getUsersListPage(
  supabase: SupabaseSsrClient,
  admin: SupabaseAdminClient,
  { page, perPage }: { page: number; perPage?: number }
): Promise<{
  rows: AdminUserRow[];
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  const safePerPage = Math.max(1, Math.min(perPage ?? ADMIN_USERS_PAGE_SIZE, 200));
  const safePage = Math.max(1, page);

  // profiles.created_at desc drives the page order. RLS policy
  // admins_view_all_profiles grants cross-user SELECT; the partial
  // unique index isn't needed here since we only ORDER BY.
  // .range is 0-indexed inclusive on both ends.
  const fromIdx = (safePage - 1) * safePerPage;
  const toIdx = fromIdx + safePerPage - 1;
  const { data: profilesPage, count: profilesCount, error: profilesErr } =
    await supabase
      .from("profiles")
      .select("id, full_name, exam_date_planned, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx);

  if (profilesErr) {
    throw new Error(`profiles page query failed: ${profilesErr.message}`);
  }

  const pageProfiles = (profilesPage ?? []) as Array<{
    id: string;
    full_name: string;
    exam_date_planned: string | null;
    created_at: string;
  }>;
  const ids = pageProfiles.map((p) => p.id);

  if (ids.length === 0) {
    return { rows: [], page: safePage, perPage: safePerPage, hasMore: false };
  }

  // Fan-out per-user auth lookups in parallel. Each `getUserById` hits
  // GET /auth/v1/admin/users/{id}, which uses a different gotrue
  // scanner than the list endpoint and tolerates NULL email_change.
  const authPromise = Promise.all(
    ids.map((id) =>
      admin.auth.admin.getUserById(id).then(
        (res) => ({ id, user: res.data?.user ?? null, error: res.error }),
        (err: unknown) => ({
          id,
          user: null,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      )
    )
  );

  const nowIso = new Date().toISOString();
  const [authResults, subsRes] = await Promise.all([
    authPromise,
    supabase
      .from("subscriptions")
      .select("user_id, plan_type, ends_at")
      .in("user_id", ids)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", nowIso),
  ]);

  const authByUser = new Map<
    string,
    { email: string | null; lastSignInAt: string | null; createdAt: string }
  >();
  for (const r of authResults) {
    if (r.error) {
      // Log but don't fail the whole page — a single missing auth row
      // (e.g. the user was deleted from auth but profile orphaned)
      // shouldn't take down the table. The row renders with email="—".
      console.error(
        `[admin] getUserById failed for ${r.id}: ${
          r.error instanceof Error ? r.error.message : "unknown"
        }`
      );
      continue;
    }
    if (!r.user) continue;
    authByUser.set(r.id, {
      email: r.user.email ?? null,
      lastSignInAt: r.user.last_sign_in_at ?? null,
      createdAt: r.user.created_at ?? "",
    });
  }

  const subByUser = new Map<string, { planType: string; endsAt: string }>();
  for (const s of (subsRes.data ?? []) as Array<{
    user_id: string;
    plan_type: string;
    ends_at: string;
  }>) {
    subByUser.set(s.user_id, { planType: s.plan_type, endsAt: s.ends_at });
  }

  const rows: AdminUserRow[] = pageProfiles.map((p) => {
    const auth = authByUser.get(p.id);
    return {
      userId: p.id,
      fullName: p.full_name,
      email: auth?.email ?? null,
      signedUpAt: p.created_at,
      examDatePlanned: p.exam_date_planned,
      lastSignInAt: auth?.lastSignInAt ?? null,
      activeSubscription: subByUser.get(p.id) ?? null,
    };
  });

  // exact count from the head query → reliable hasMore.
  const totalRows = profilesCount ?? rows.length;
  const hasMore = fromIdx + rows.length < totalRows;

  return { rows, page: safePage, perPage: safePerPage, hasMore };
}

// =============================================================================
// Public API — user detail (Phase B)
// =============================================================================

export const ADMIN_USER_RECENT_ATTEMPTS_LIMIT = 10;

/**
 * Fetch all data needed by /admin/users/[userId]: profile row, auth
 * fields (via the Auth Admin API), the user's current active
 * subscription, and the N most recent attempts. Returns null when the
 * user doesn't exist.
 *
 * SSR client for profiles + subscriptions + attempts (admin RLS),
 * admin client ONLY for auth.users (and only the documented columns —
 * never encrypted_password or any token column).
 */
export async function getUserDetail(
  supabase: SupabaseSsrClient,
  admin: SupabaseAdminClient,
  userId: string
): Promise<AdminUserDetail | null> {
  const [authRes, profileRes, subsRes, attemptsRes] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    supabase
      .from("profiles")
      .select(
        "full_name, phone, gender, birth_date, exam_date_planned, signup_source, created_at"
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_type, ends_at")
      .eq("user_id", userId)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle(),
    supabase
      .from("attempts")
      .select(
        "id, attempted_at, question_type, mode, is_correct, was_skipped, duration_seconds"
      )
      .eq("user_id", userId)
      .order("attempted_at", { ascending: false })
      .limit(ADMIN_USER_RECENT_ATTEMPTS_LIMIT),
  ]);

  const authUser = authRes.data?.user ?? null;
  const profile = profileRes.data as
    | {
        full_name: string;
        phone: string | null;
        gender: string;
        birth_date: string;
        exam_date_planned: string | null;
        signup_source: string;
        created_at: string;
      }
    | null;

  if (!authUser && !profile) return null;

  const sub = subsRes.data as
    | { plan_type: string; ends_at: string }
    | null;

  const recentAttempts: AdminAttemptRow[] = [];
  for (const a of (attemptsRes.data ?? []) as Array<{
    id: string;
    attempted_at: string;
    question_type: string;
    mode: string;
    is_correct: boolean | null;
    was_skipped: boolean;
    duration_seconds: number | null;
  }>) {
    if (a.question_type !== "source" && a.question_type !== "angle") continue;
    if (a.mode !== "practice" && a.mode !== "exam") continue;
    recentAttempts.push({
      id: a.id,
      attemptedAt: a.attempted_at,
      questionType: a.question_type,
      mode: a.mode,
      isCorrect: a.is_correct,
      wasSkipped: a.was_skipped,
      durationSeconds: a.duration_seconds,
    });
  }

  return {
    userId,
    profile: {
      fullName: profile?.full_name ?? "—",
      phone: profile?.phone ?? null,
      gender: profile?.gender ?? "—",
      birthDate: profile?.birth_date ?? "",
      examDatePlanned: profile?.exam_date_planned ?? null,
      signupSource: profile?.signup_source ?? "—",
      createdAt: profile?.created_at ?? authUser?.created_at ?? "",
    },
    auth: {
      email: authUser?.email ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      emailConfirmedAt: authUser?.email_confirmed_at ?? null,
    },
    activeSubscription: sub
      ? { planType: sub.plan_type, endsAt: sub.ends_at }
      : null,
    recentAttempts,
  };
}
