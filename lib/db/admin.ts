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
  /**
   * Slice 7.5 — computed MAX over four activity sources:
   *   - auth.users.last_sign_in_at
   *   - attempts.attempted_at
   *   - practice_sessions.last_activity_at
   *   - exam_sessions.last_activity_at
   * NULL only when all four are NULL (a user who signed up but never
   * actually used the app).
   */
  lastActivityAt: string | null;
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
    emailConfirmedAt: string | null;
  };
  /**
   * Slice 7.5 — same computed-MAX rule as AdminUserRow.lastActivityAt.
   * Replaces the prior `auth.lastSignInAt` surface on this page: fresh
   * sign-ins are only one of four activity signals, and the panel
   * previously misrepresented active users as inactive.
   */
  lastActivityAt: string | null;
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
// Public API — users list (Phase B + Slice 7.5)
// =============================================================================

/** Cap on /admin/users page size. The brief asks for 50; the dataset is
 *  ~10 users today. */
export const ADMIN_USERS_PAGE_SIZE = 50;

/**
 * Sortable columns on /admin/users. Three are orderable directly on
 * the profiles query (DB ORDER BY); three are computed and sorted in
 * TS after pre-resolving the order key for the full filtered set.
 * Default sort is `activity` desc (slice 7.5 product decision).
 */
export type SortableColumn =
  | "name"
  | "email"
  | "signup"
  | "exam"
  | "subscription"
  | "activity";

export type SortDir = "asc" | "desc";

const DB_ORDERABLE_COLUMNS: ReadonlySet<SortableColumn> = new Set([
  "name",
  "signup",
  "exam",
]);

/**
 * Profiles-column mapping for DB-orderable columns. Hebrew collation
 * on profiles.full_name is set in migration 0003 so .order() handles
 * Hebrew alphabetic sort natively.
 */
const DB_ORDERABLE_PROFILE_COLUMN: Record<
  Extract<SortableColumn, "name" | "signup" | "exam">,
  string
> = {
  name: "full_name",
  signup: "created_at",
  exam: "exam_date_planned",
};

const DEFAULT_SORT: SortableColumn = "activity";
const DEFAULT_DIR: SortDir = "desc";

/**
 * Reads attempts / practice_sessions / exam_sessions + last_sign_in_at
 * for the given user IDs and returns a Map<userId, ISO | null> of the
 * MAX across the four sources.
 *
 * Three batched queries against the activity tables run in parallel
 * with the auth fan-out (per-user `getUserById` — gotrue list endpoint
 * is broken for this project's gotrue version, see fix-admin-users).
 * All three activity tables have composite `(user_id, *)` indexes so
 * the IN(...) scan is index-friendly; we read the rows ordered desc
 * and take the first per user (i.e. MAX) — same pattern as
 * `findResolvedQuestions` in lib/db/practice.ts.
 *
 * At current scale (~10 users, ≤1k attempts total) this is
 * microseconds; at >10k users this would justify a SECURITY DEFINER
 * RPC that computes the GROUP BY MAX in SQL.
 */
async function fetchLastActivityMap(
  supabase: SupabaseSsrClient,
  admin: SupabaseAdminClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (userIds.length === 0) return out;
  for (const id of userIds) out.set(id, null);

  const [attemptsRes, practiceRes, examRes, authResults] = await Promise.all([
    supabase
      .from("attempts")
      .select("user_id, attempted_at")
      .in("user_id", userIds)
      .order("attempted_at", { ascending: false }),
    supabase
      .from("practice_sessions")
      .select("user_id, last_activity_at")
      .in("user_id", userIds)
      .order("last_activity_at", { ascending: false }),
    supabase
      .from("exam_sessions")
      .select("user_id, last_activity_at")
      .in("user_id", userIds)
      .order("last_activity_at", { ascending: false }),
    Promise.all(
      userIds.map((id) =>
        admin.auth.admin.getUserById(id).then(
          (res) => ({
            id,
            lastSignInAt: res.data?.user?.last_sign_in_at ?? null,
          }),
          () => ({ id, lastSignInAt: null as string | null })
        )
      )
    ),
  ]);

  function bump(userId: string, candidate: string | null): void {
    if (!candidate) return;
    const prev = out.get(userId);
    if (!prev || candidate > prev) out.set(userId, candidate);
  }

  // Ordered desc → first per user is the MAX. Walk once with a seen set.
  const seenAttempts = new Set<string>();
  for (const row of (attemptsRes.data ?? []) as Array<{
    user_id: string;
    attempted_at: string;
  }>) {
    if (seenAttempts.has(row.user_id)) continue;
    seenAttempts.add(row.user_id);
    bump(row.user_id, row.attempted_at);
  }

  const seenPractice = new Set<string>();
  for (const row of (practiceRes.data ?? []) as Array<{
    user_id: string;
    last_activity_at: string;
  }>) {
    if (seenPractice.has(row.user_id)) continue;
    seenPractice.add(row.user_id);
    bump(row.user_id, row.last_activity_at);
  }

  const seenExam = new Set<string>();
  for (const row of (examRes.data ?? []) as Array<{
    user_id: string;
    last_activity_at: string;
  }>) {
    if (seenExam.has(row.user_id)) continue;
    seenExam.add(row.user_id);
    bump(row.user_id, row.last_activity_at);
  }

  for (const r of authResults) bump(r.id, r.lastSignInAt);

  return out;
}

/**
 * String-or-null comparator with NULLS LAST in both directions —
 * matches the locked product decision: missing values predictably
 * sink to the bottom whether sort is asc or desc.
 */
function compareNullsLast(
  a: string | null,
  b: string | null,
  ascending: boolean
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a === b) return 0;
  const lt = ascending ? a < b : a > b;
  return lt ? -1 : 1;
}

export type UsersListSubscriptionFilter =
  | "active"
  | "expired"
  | "cancelled"
  | "none";
export type UsersListPlanFilter = "3_months" | "6_months";
export type UsersListSignupFilter = "email" | "google";

export type UsersListFilters = {
  /** Subscription-status filter. "none" means "users with no active sub". */
  subscriptionStatus?: UsersListSubscriptionFilter | null;
  /** Plan-type filter. Combined with subscriptionStatus when both set. */
  planType?: UsersListPlanFilter | null;
  /** Signup-source filter (profiles.signup_source). */
  signupSource?: UsersListSignupFilter | null;
  /**
   * Search string. Always matches against profiles.full_name and
   * profiles.phone (ilike). If the string contains '@', additionally
   * searches auth.users.email via the service-role admin client (per
   * Phase A discovery — direct schema('auth') select avoids the
   * gotrue listUsers email_change bug).
   */
  q?: string | null;
};

/**
 * Build one page of /admin/users rows, optionally narrowed by filters
 * and a search query.
 *
 * Implementation note (fix-admin-users, May 2026): the Supabase Auth
 * Admin API's `listUsers()` endpoint is currently broken for this
 * project's gotrue version — it returns HTTP 500 with the underlying
 * Go error "sql: Scan error on column index 8, name \"email_change\":
 * converting NULL to string is unsupported". So we drive pagination
 * from `profiles` and fan out per-user `getUserById()` calls for the
 * auth columns (the single-user endpoint uses a different scanner).
 *
 * Filter + search pipeline (slice 7 phase B):
 *   1. Compute an "eligible id set" by intersecting:
 *        - subscriptions filter      → user_ids matching the predicate
 *        - profile name/phone search → user_ids ilike on full_name/phone
 *        - email search              → user_ids ilike on auth.users.email
 *          (only when q contains '@')
 *      A null id set means "no constraint" for that axis.
 *   2. Apply signup_source as a direct profiles.eq() predicate.
 *   3. Order by profiles.created_at desc, .range(from, to) with exact
 *      count → reliable hasMore.
 *   4. Per-user getUserById + active-subs lookup against the page's
 *      ids (unchanged from the listUsers workaround).
 *
 * SSR client (admin RLS) handles profiles + subscriptions. Service-
 * role client (a) per-user getUserById for the row auth columns, and
 * (b) bulk auth.users email ilike search when `q` contains '@'. In
 * both cases only documented columns are projected.
 *
 * Caller must invoke requireAdmin() BEFORE creating the admin client.
 */
export async function getUsersListPage(
  supabase: SupabaseSsrClient,
  admin: SupabaseAdminClient,
  {
    page,
    perPage,
    filters,
    sort,
    dir,
  }: {
    page: number;
    perPage?: number;
    filters?: UsersListFilters;
    sort?: SortableColumn;
    dir?: SortDir;
  }
): Promise<{
  rows: AdminUserRow[];
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  const safePerPage = Math.max(1, Math.min(perPage ?? ADMIN_USERS_PAGE_SIZE, 200));
  const safePage = Math.max(1, page);
  const subscriptionStatus = filters?.subscriptionStatus ?? null;
  const planType = filters?.planType ?? null;
  const signupSource = filters?.signupSource ?? null;
  const rawQ = (filters?.q ?? "").trim();
  const q = rawQ.length > 0 ? rawQ : null;
  const sortCol: SortableColumn = sort ?? DEFAULT_SORT;
  const sortDir: SortDir = dir ?? DEFAULT_DIR;
  const isDBOrderable = DB_ORDERABLE_COLUMNS.has(sortCol);

  // --------------------------------------------------------------------
  // Step 1 — build the constrained id set (or null for "all profiles").
  // --------------------------------------------------------------------

  // 1a. Subscription filter.
  let subscriptionIdSet: Set<string> | null = null;
  if (subscriptionStatus !== null || planType !== null) {
    const nowIso = new Date().toISOString();
    if (subscriptionStatus === "none") {
      // "No active subscription" — fetch ALL user_ids that DO have one
      // (active predicate), then we'll later exclude them. The
      // exclusion set is small (current 6 in the live DB).
      const { data, error } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("is_current", true)
        .eq("status", "active")
        .gt("ends_at", nowIso);
      if (error) {
        throw new Error(`subscriptions filter failed: ${error.message}`);
      }
      const exclude = new Set(
        ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
      );
      subscriptionIdSet = exclude; // semantics flipped — handled below
    } else {
      let query = supabase
        .from("subscriptions")
        .select("user_id")
        .eq("is_current", true);
      if (subscriptionStatus === "active") {
        query = query.eq("status", "active").gt("ends_at", nowIso);
      } else if (subscriptionStatus === "expired") {
        query = query.eq("status", "expired");
      } else if (subscriptionStatus === "cancelled") {
        query = query.eq("status", "cancelled");
      }
      if (planType !== null) {
        query = query.eq("plan_type", planType);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`subscriptions filter failed: ${error.message}`);
      }
      subscriptionIdSet = new Set(
        ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
      );
    }
  }

  // 1b. Search — combine profile name/phone hits with auth.users email
  // hits (only when q contains '@').
  let searchIdSet: Set<string> | null = null;
  if (q !== null) {
    // Escape '%' and ',' inside the search term so they don't break
    // the postgrest .or() syntax. PostgREST .ilike accepts "%" as a
    // literal pattern char; users searching for those should be rare,
    // but the escape keeps us safe.
    const safeQ = q.replace(/[%,]/g, "");
    const profileMatchPromise = supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`);

    const emailMatchPromise = q.includes("@")
      ? admin
          .schema("auth")
          .from("users")
          .select("id, email")
          .ilike("email", `%${safeQ}%`)
      : Promise.resolve({ data: [] as unknown });

    const [profileRes, emailRes] = await Promise.all([
      profileMatchPromise,
      emailMatchPromise,
    ]);

    if (profileRes.error) {
      throw new Error(`profile search failed: ${profileRes.error.message}`);
    }

    const ids = new Set<string>();
    for (const r of (profileRes.data ?? []) as Array<{ id: string }>) {
      ids.add(r.id);
    }
    for (const r of (emailRes.data ?? []) as Array<{ id: string }>) {
      ids.add(r.id);
    }
    searchIdSet = ids;
  }

  // 1c. Intersect.
  let eligibleIds: string[] | null = null;
  if (subscriptionStatus === "none" && subscriptionIdSet) {
    // Exclude semantics — postgrest doesn't have a clean NOT IN with
    // a large UUID set, so we materialize: fetch the candidate id set
    // (search result OR all profiles) and exclude.
    if (searchIdSet) {
      eligibleIds = Array.from(searchIdSet).filter(
        (id) => !subscriptionIdSet!.has(id)
      );
    } else {
      // No search → no candidate set yet. We need to enumerate all
      // profile ids and exclude. At current scale (~10 users) this is
      // free. For 10k+ users this would need an RPC.
      const { data, error } = await supabase
        .from("profiles")
        .select("id");
      if (error) {
        throw new Error(`profiles enum failed: ${error.message}`);
      }
      eligibleIds = ((data ?? []) as Array<{ id: string }>)
        .map((r) => r.id)
        .filter((id) => !subscriptionIdSet!.has(id));
    }
  } else {
    const candidateSets: Set<string>[] = [];
    if (subscriptionIdSet) candidateSets.push(subscriptionIdSet);
    if (searchIdSet) candidateSets.push(searchIdSet);
    if (candidateSets.length > 0) {
      // Intersect smallest first.
      candidateSets.sort((a, b) => a.size - b.size);
      const [first, ...rest] = candidateSets;
      eligibleIds = Array.from(first).filter((id) =>
        rest.every((s) => s.has(id))
      );
    }
  }

  // Empty constrained set → empty page, fast path.
  if (eligibleIds !== null && eligibleIds.length === 0) {
    return {
      rows: [],
      page: safePage,
      perPage: safePerPage,
      hasMore: false,
    };
  }

  // --------------------------------------------------------------------
  // Step 2 — paginate the (filtered) profiles set, with sort branching.
  //
  // DB-orderable columns (name, signup, exam date) take the cheap
  // path: one .order().range() query against profiles. TS-orderable
  // columns (email, subscription, activity) need to pre-resolve the
  // sort key across the entire filtered set before slicing — same
  // pattern as the existing "subscriptionStatus === 'none'" branch.
  // --------------------------------------------------------------------

  const fromIdx = (safePage - 1) * safePerPage;
  const toIdx = fromIdx + safePerPage - 1;
  const nowIso = new Date().toISOString();

  type ProfileRow = {
    id: string;
    full_name: string;
    exam_date_planned: string | null;
    created_at: string;
  };

  let pageProfiles: ProfileRow[] = [];
  let totalRows = 0;
  // Pre-resolved activity map for the page (and, in the sort=activity
  // branch, the full eligible set). Used to render the column AND to
  // sort by it.
  let activityMap: Map<string, string | null> | null = null;

  if (isDBOrderable) {
    // --- DB-orderable branch ---
    // Single paginated profiles query with .order + .range. The
    // composite filters (eligibleIds + signup_source) ride along as
    // .in() / .eq() — count: 'exact' still gives reliable hasMore.
    const orderCol =
      DB_ORDERABLE_PROFILE_COLUMN[
        sortCol as "name" | "signup" | "exam"
      ];
    let profilesQuery = supabase
      .from("profiles")
      .select("id, full_name, exam_date_planned, created_at", {
        count: "exact",
      })
      .order(orderCol, {
        ascending: sortDir === "asc",
        // NULLS LAST in BOTH directions — matches the locked product
        // decision that missing values predictably sink. PostgREST
        // .order honours nullsFirst when set explicitly.
        nullsFirst: false,
      })
      .range(fromIdx, toIdx);
    if (eligibleIds !== null) {
      profilesQuery = profilesQuery.in("id", eligibleIds);
    }
    if (signupSource !== null) {
      profilesQuery = profilesQuery.eq("signup_source", signupSource);
    }
    const { data, count, error } = await profilesQuery;
    if (error) {
      throw new Error(`profiles page query failed: ${error.message}`);
    }
    pageProfiles = (data ?? []) as ProfileRow[];
    totalRows = count ?? pageProfiles.length;
  } else {
    // --- TS-orderable branch (email / subscription / activity) ---
    // Step 2a — materialize the full filtered candidate set (apply
    // eligibleIds + signupSource at SELECT-id time). At current scale
    // (~10 users) this is cheap; at >10k users a SECURITY DEFINER RPC
    // would carry the sort into SQL.
    let candidateQuery = supabase.from("profiles").select("id");
    if (eligibleIds !== null) {
      candidateQuery = candidateQuery.in("id", eligibleIds);
    }
    if (signupSource !== null) {
      candidateQuery = candidateQuery.eq("signup_source", signupSource);
    }
    const { data: candidateData, error: candidateErr } = await candidateQuery;
    if (candidateErr) {
      throw new Error(`candidates query failed: ${candidateErr.message}`);
    }
    const candidateIds = ((candidateData ?? []) as Array<{ id: string }>).map(
      (r) => r.id
    );

    if (candidateIds.length === 0) {
      return {
        rows: [],
        page: safePage,
        perPage: safePerPage,
        hasMore: false,
      };
    }

    // Step 2b — resolve the sort key per candidate.
    let sortKey: Map<string, string | null>;
    if (sortCol === "email") {
      const { data: emailData, error: emailErr } = await admin
        .schema("auth")
        .from("users")
        .select("id, email")
        .in("id", candidateIds);
      if (emailErr) {
        throw new Error(`email sort key fetch failed: ${emailErr.message}`);
      }
      sortKey = new Map<string, string | null>();
      for (const id of candidateIds) sortKey.set(id, null);
      for (const r of (emailData ?? []) as Array<{
        id: string;
        email: string | null;
      }>) {
        sortKey.set(r.id, r.email ?? null);
      }
    } else if (sortCol === "subscription") {
      // Order key = active sub's ends_at. Users without an active
      // sub get null (→ NULLS LAST per locked decision).
      const { data: subData, error: subErr } = await supabase
        .from("subscriptions")
        .select("user_id, ends_at")
        .in("user_id", candidateIds)
        .eq("is_current", true)
        .eq("status", "active")
        .gt("ends_at", nowIso);
      if (subErr) {
        throw new Error(`subscription sort key fetch failed: ${subErr.message}`);
      }
      sortKey = new Map<string, string | null>();
      for (const id of candidateIds) sortKey.set(id, null);
      for (const r of (subData ?? []) as Array<{
        user_id: string;
        ends_at: string;
      }>) {
        sortKey.set(r.user_id, r.ends_at);
      }
    } else {
      // sortCol === "activity"
      activityMap = await fetchLastActivityMap(
        supabase,
        admin,
        candidateIds
      );
      sortKey = activityMap;
    }

    // Step 2c — sort the candidate ids by their key (stable, NULLS LAST).
    const ascending = sortDir === "asc";
    const sorted = [...candidateIds].sort((a, b) =>
      compareNullsLast(sortKey.get(a) ?? null, sortKey.get(b) ?? null, ascending)
    );

    // Step 2d — slice the page and load the actual profile rows. The
    // .in() returns in arbitrary order; we re-order into the sorted
    // slice via a Map lookup.
    totalRows = sorted.length;
    const pageIds = sorted.slice(fromIdx, toIdx + 1);
    if (pageIds.length === 0) {
      return {
        rows: [],
        page: safePage,
        perPage: safePerPage,
        hasMore: false,
      };
    }
    const { data: pageProfilesData, error: pageProfilesErr } = await supabase
      .from("profiles")
      .select("id, full_name, exam_date_planned, created_at")
      .in("id", pageIds);
    if (pageProfilesErr) {
      throw new Error(
        `profiles page query failed: ${pageProfilesErr.message}`
      );
    }
    const profileById = new Map<string, ProfileRow>();
    for (const p of (pageProfilesData ?? []) as ProfileRow[]) {
      profileById.set(p.id, p);
    }
    pageProfiles = pageIds
      .map((id) => profileById.get(id))
      .filter((p): p is ProfileRow => p !== undefined);
  }

  const ids = pageProfiles.map((p) => p.id);

  if (ids.length === 0) {
    return { rows: [], page: safePage, perPage: safePerPage, hasMore: false };
  }

  // --------------------------------------------------------------------
  // Step 3 — per-page lookups: auth fan-out + subscriptions + activity.
  // The activity map may already be populated from the sort branch;
  // skip the redundant fetch in that case.
  // --------------------------------------------------------------------

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

  const subsPromise = supabase
    .from("subscriptions")
    .select("user_id, plan_type, ends_at")
    .in("user_id", ids)
    .eq("is_current", true)
    .eq("status", "active")
    .gt("ends_at", nowIso);

  // Reuse the precomputed map when sorting by activity — its candidate
  // set is a superset of the page ids. Otherwise fetch just for the
  // page.
  const activityPromise: Promise<Map<string, string | null>> =
    activityMap !== null
      ? Promise.resolve(activityMap)
      : fetchLastActivityMap(supabase, admin, ids);

  const [authResults, subsRes, resolvedActivityMap] = await Promise.all([
    authPromise,
    subsPromise,
    activityPromise,
  ]);

  const authByUser = new Map<
    string,
    { email: string | null; createdAt: string }
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
      lastActivityAt: resolvedActivityMap.get(p.id) ?? null,
      activeSubscription: subByUser.get(p.id) ?? null,
    };
  });

  // Reliable hasMore: DB branch gets the count from postgrest's exact
  // header; TS branch gets it from candidateIds.length.
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
  // Slice 7.5 — two extra parallel reads (practice_sessions MAX,
  // exam_sessions MAX) so we can compute lastActivityAt the same way
  // the table does. attempts MAX comes for free from attemptsRes[0]
  // (already ordered desc), and auth.users.last_sign_in_at from
  // authRes.
  const [authRes, profileRes, subsRes, attemptsRes, practiceMaxRes, examMaxRes] =
    await Promise.all([
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
      supabase
        .from("practice_sessions")
        .select("last_activity_at")
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("exam_sessions")
        .select("last_activity_at")
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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

  // Slice 7.5 — compute the same MAX-over-four-sources used by the
  // table. attempts[0]?.attempted_at is the per-user MAX from
  // attemptsRes (already ordered desc, limit 10 — first row is the
  // MAX regardless of limit). practice/exam MAX from the dedicated
  // limit-1-ordered-desc subqueries above. last_sign_in_at from auth.
  const practiceMax =
    (practiceMaxRes.data as { last_activity_at: string } | null)
      ?.last_activity_at ?? null;
  const examMax =
    (examMaxRes.data as { last_activity_at: string } | null)
      ?.last_activity_at ?? null;
  const attemptsMax = recentAttempts[0]?.attemptedAt ?? null;
  const signInMax = authUser?.last_sign_in_at ?? null;
  let lastActivityAt: string | null = null;
  for (const candidate of [practiceMax, examMax, attemptsMax, signInMax]) {
    if (!candidate) continue;
    if (!lastActivityAt || candidate > lastActivityAt) {
      lastActivityAt = candidate;
    }
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
      emailConfirmedAt: authUser?.email_confirmed_at ?? null,
    },
    lastActivityAt,
    activeSubscription: sub
      ? { planType: sub.plan_type, endsAt: sub.ends_at }
      : null,
    recentAttempts,
  };
}

// =============================================================================
// Public API — question content editor (Slice 7)
// =============================================================================

export type QuestionEditorChoice = {
  id: string;
  letter: "א" | "ב" | "ג" | "ד";
  choiceText: string;
  isCorrect: boolean;
  displayOrder: number;
};

export type QuestionEditorSource = {
  id: string;
  externalId: string;
  status: SourceQuestionStatus;
  questionText: string;
  legalTopicAnalysis: string;
  fullExplanation: string;
  commonPitfall: string;
  summaryForMemory: string;
  quickThinking360: string;
  notesForAdmin: string;
  conceptsAndSkills: string[];
  referencesList: string[];
  choices: QuestionEditorChoice[];
};

export type QuestionEditorAngle = {
  id: string;
  angleLetter: "א" | "ב" | "ג" | "ד" | "ה";
  angleTitle: string | null;
  displayOrder: number;
  questionText: string;
  legalTopicAnalysis: string;
  fullExplanation: string;
  commonPitfall: string;
  summaryForMemory: string;
  quickThinking360: string;
  conceptsAndSkills: string[];
  referencesList: string[];
  choices: QuestionEditorChoice[];
};

export type QuestionEditorPayload = {
  chapter: { id: string; code: string; title: string; track: ChapterTrack };
  source: QuestionEditorSource;
  angles: QuestionEditorAngle[];
};

function toChoice(row: {
  id: string;
  letter: string;
  choice_text: string;
  is_correct: boolean;
  display_order: number;
}): QuestionEditorChoice | null {
  if (
    row.letter !== "א" &&
    row.letter !== "ב" &&
    row.letter !== "ג" &&
    row.letter !== "ד"
  ) {
    return null;
  }
  return {
    id: row.id,
    letter: row.letter,
    choiceText: row.choice_text,
    isCorrect: row.is_correct,
    displayOrder: row.display_order,
  };
}

function toAngleLetter(
  s: string
): "א" | "ב" | "ג" | "ד" | "ה" | null {
  return s === "א" || s === "ב" || s === "ג" || s === "ד" || s === "ה"
    ? s
    : null;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Loads everything the question editor needs in one batched call:
 *  - chapter metadata for the header
 *  - the source question + its 4 choices
 *  - every angle for that source + their choices
 *
 * Returns null when the source isn't found (or doesn't belong to the
 * caller-supplied chapter — defense in depth against URL tampering).
 * RLS via `admins_full_access_*` on the content tables grants the
 * admin SSR client SELECT across all rows.
 */
export async function getQuestionEditorPayload(
  supabase: SupabaseSsrClient,
  chapterId: string,
  sourceQuestionId: string
): Promise<QuestionEditorPayload | null> {
  const [chapterRes, sourceRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, track")
      .eq("id", chapterId)
      .maybeSingle(),
    supabase
      .from("source_questions")
      .select(
        "id, chapter_id, external_id, status, question_text, legal_topic_analysis, full_explanation, common_pitfall, summary_for_memory, quick_thinking_360, notes_for_admin, concepts_and_skills, references_list"
      )
      .eq("id", sourceQuestionId)
      .maybeSingle(),
  ]);

  const chapterRow = chapterRes.data as
    | { id: string; code: string; title: string; track: string | null }
    | null;
  const sourceRow = sourceRes.data as
    | {
        id: string;
        chapter_id: string;
        external_id: string;
        status: string;
        question_text: string;
        legal_topic_analysis: string;
        full_explanation: string;
        common_pitfall: string;
        summary_for_memory: string;
        quick_thinking_360: string;
        notes_for_admin: string | null;
        concepts_and_skills: unknown;
        references_list: unknown;
      }
    | null;

  if (!chapterRow || !sourceRow) return null;
  if (sourceRow.chapter_id !== chapterRow.id) return null;
  if (!isChapterTrack(chapterRow.track)) return null;

  // Choices for the source, every angle for the source, and choices for
  // each angle — issued together so the editor's blocking time is one
  // round-trip past the parallel pair above.
  const [sourceChoicesRes, anglesRes] = await Promise.all([
    supabase
      .from("source_choices")
      .select("id, letter, choice_text, is_correct, display_order")
      .eq("source_question_id", sourceQuestionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("angle_questions")
      .select(
        "id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, summary_for_memory, quick_thinking_360, concepts_and_skills, references_list"
      )
      .eq("source_question_id", sourceQuestionId)
      .order("display_order", { ascending: true }),
  ]);

  const sourceChoices = ((sourceChoicesRes.data ?? []) as Array<{
    id: string;
    letter: string;
    choice_text: string;
    is_correct: boolean;
    display_order: number;
  }>)
    .map(toChoice)
    .filter((c): c is QuestionEditorChoice => c !== null);

  type AngleRow = {
    id: string;
    angle_letter: string;
    angle_title: string | null;
    display_order: number;
    question_text: string;
    legal_topic_analysis: string;
    full_explanation: string;
    common_pitfall: string;
    summary_for_memory: string;
    quick_thinking_360: string;
    concepts_and_skills: unknown;
    references_list: unknown;
  };
  const angleRows = (anglesRes.data ?? []) as AngleRow[];

  // Bulk-fetch angle choices in one query, then bucket by angle id.
  const angleIds = angleRows.map((a) => a.id);
  const anglesChoicesByAngle = new Map<string, QuestionEditorChoice[]>();
  if (angleIds.length > 0) {
    const { data: angleChoicesData } = await supabase
      .from("angle_choices")
      .select(
        "id, angle_question_id, letter, choice_text, is_correct, display_order"
      )
      .in("angle_question_id", angleIds)
      .order("display_order", { ascending: true });
    for (const row of (angleChoicesData ?? []) as Array<{
      id: string;
      angle_question_id: string;
      letter: string;
      choice_text: string;
      is_correct: boolean;
      display_order: number;
    }>) {
      const choice = toChoice(row);
      if (!choice) continue;
      const arr = anglesChoicesByAngle.get(row.angle_question_id) ?? [];
      arr.push(choice);
      anglesChoicesByAngle.set(row.angle_question_id, arr);
    }
  }

  const angles: QuestionEditorAngle[] = [];
  for (const a of angleRows) {
    const letter = toAngleLetter(a.angle_letter);
    if (!letter) continue;
    angles.push({
      id: a.id,
      angleLetter: letter,
      angleTitle: a.angle_title,
      displayOrder: a.display_order,
      questionText: a.question_text,
      legalTopicAnalysis: a.legal_topic_analysis,
      fullExplanation: a.full_explanation,
      commonPitfall: a.common_pitfall,
      summaryForMemory: a.summary_for_memory,
      quickThinking360: a.quick_thinking_360,
      conceptsAndSkills: toStringArray(a.concepts_and_skills),
      referencesList: toStringArray(a.references_list),
      choices: anglesChoicesByAngle.get(a.id) ?? [],
    });
  }

  return {
    chapter: {
      id: chapterRow.id,
      code: chapterRow.code,
      title: chapterRow.title,
      track: chapterRow.track,
    },
    source: {
      id: sourceRow.id,
      externalId: sourceRow.external_id,
      status: isSourceStatus(sourceRow.status) ? sourceRow.status : "draft",
      questionText: sourceRow.question_text,
      legalTopicAnalysis: sourceRow.legal_topic_analysis,
      fullExplanation: sourceRow.full_explanation,
      commonPitfall: sourceRow.common_pitfall,
      summaryForMemory: sourceRow.summary_for_memory,
      quickThinking360: sourceRow.quick_thinking_360,
      notesForAdmin: sourceRow.notes_for_admin ?? "",
      conceptsAndSkills: toStringArray(sourceRow.concepts_and_skills),
      referencesList: toStringArray(sourceRow.references_list),
      choices: sourceChoices,
    },
    angles,
  };
}
