/**
 * Slice 10 — QA Feedback System DB helpers. Server-only.
 *
 * Mirrors the lib/db/admin.ts convention:
 *   - SSR Supabase client is the first argument; caller hands it in
 *     from a Server Component / Server Action.
 *   - RLS is the load-bearing auth boundary: the `qa_reports` table has
 *     a `qa_reports_testers_insert_own` policy that requires
 *     `user_id = auth.uid()` AND `profiles.is_qa_tester = TRUE`.
 *     The caller is expected to enforce its own gate (the widget action
 *     calls auth.getUser() and refuses to run for non-testers) — these
 *     helpers DO NOT re-check tester status themselves.
 *
 * Phase B-1: tester-only writes (createQaReport).
 * Phase B-2: admin-side reads (listQaReports, getQaReportDetail,
 *   countOpenQaReports, resolveChapterForQuestion) + the admin status
 *   action lives in app/(app)/admin/_actions.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = SupabaseClient;

// =============================================================================
// Types
// =============================================================================

export type QaReportType = "bug" | "content" | "design";
export type QaReportQuestionType = "source" | "angle";
export type QaReportStatus = "open" | "in_progress" | "resolved";

export type QaReportRow = {
  id: string;
  user_id: string;
  report_type: QaReportType;
  page_path: string;
  question_id: string | null;
  question_type: QaReportQuestionType | null;
  problem_text: string;
  expected_text: string;
  screenshot_path: string | null;
  user_agent: string | null;
  viewport: string | null;
  status: QaReportStatus;
  created_at: string;
};

/** Insert payload — all fields except DB-managed (id, status, created_at)
 *  plus the user_id which the action sets from auth.getUser(). */
export type QaReportInsert = {
  user_id: string;
  report_type: QaReportType;
  page_path: string;
  question_id: string | null;
  question_type: QaReportQuestionType | null;
  problem_text: string;
  expected_text: string;
  screenshot_path: string | null;
  user_agent: string | null;
  viewport: string | null;
};

// =============================================================================
// Reads
// =============================================================================

const SELECT_FIELDS =
  "id, user_id, report_type, page_path, question_id, question_type, " +
  "problem_text, expected_text, screenshot_path, user_agent, viewport, " +
  "status, created_at";

/**
 * Fetch a single QA report by id. RLS scopes the read:
 *   - tester sees their own row
 *   - admin sees any row
 * Returns null if the row doesn't exist or RLS hid it.
 *
 * Reserved for Phase B-2 (admin detail page) + future "your reports"
 * surfaces; not used by the widget itself.
 */
export async function getQaReportById(
  supabase: SupabaseSsrClient,
  id: string
): Promise<QaReportRow | null> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as QaReportRow;
}

// =============================================================================
// Writes
// =============================================================================

/**
 * Insert a QA report row via the SSR client. RLS enforces tester-only
 * (qa_reports_testers_insert_own); we don't pre-check that here.
 *
 * Returns `{ ok: true, id }` on success. On failure surfaces the error
 * code for the caller to log; the caller decides whether to leak it to
 * the user (the widget action wraps it into a generic Hebrew message).
 *
 * The screenshot_path is initially null. The action uploads the file
 * AFTER this insert (using the returned id in the storage path) and
 * then calls updateQaReportScreenshotPath. Splitting it keeps a
 * partial-upload scenario from inserting a row with a stale path.
 */
export async function createQaReport(
  supabase: SupabaseSsrClient,
  input: QaReportInsert
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; code?: string }
> {
  const { data, error } = await supabase
    .from("qa_reports")
    .insert({
      user_id: input.user_id,
      report_type: input.report_type,
      page_path: input.page_path,
      question_id: input.question_id,
      question_type: input.question_type,
      problem_text: input.problem_text,
      expected_text: input.expected_text,
      screenshot_path: null,
      user_agent: input.user_agent,
      viewport: input.viewport,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "insert_returned_no_row",
      code: (error as { code?: string } | null)?.code,
    };
  }
  return { ok: true, id: data.id };
}

/**
 * Patch the screenshot_path after a successful storage upload. RLS:
 * the qa_reports table has NO testers-update policy, so this UPDATE
 * runs ONLY under the admin policy in normal flow — which means a
 * tester can't patch it via this path. The action therefore writes
 * the screenshot via the admin client (the bucket policy already
 * scoped the upload to the tester's own folder).
 *
 * Caller is responsible for supplying an admin client. Used by the
 * Server Action after upload.
 */
export async function updateQaReportScreenshotPath(
  adminClient: SupabaseAdminClient,
  id: string,
  screenshotPath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient
    .from("qa_reports")
    .update({ screenshot_path: screenshotPath })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// =============================================================================
// Phase B-2 — admin-side reads + helpers
// =============================================================================

export type ListQaReportsFilters = {
  status?: QaReportStatus | null;
  reportType?: QaReportType | null;
  /** Filter by reporter user_id. The /admin/qa list lets the admin
   *  drill into one user's reports via a profile link from the list. */
  reporterId?: string | null;
};

/**
 * Slice 14 — triage priority for the /admin/qa list. Sort order is
 * in_progress → open → resolved so the admin sees actively-worked
 * items first, then the queue, then the history. The actual sort
 * is applied JS-side after the SQL fetch (see listQaReports below) —
 * Supabase JS doesn't support a CASE-expression ORDER BY, and the
 * list size is small (~hundreds during the testing period). The
 * SQL `.order("created_at", { ascending: false })` survives as the
 * stable secondary key — Array.prototype.sort is stable in V8 so
 * each status bucket retains its newest-first order without an
 * explicit per-bucket re-sort.
 */
const STATUS_RANK: Record<QaReportStatus, number> = {
  in_progress: 1,
  open: 2,
  resolved: 3,
};

/** One row in the /admin/qa list table — joined with the reporter's
 *  display name so the list can render without N+1. */
export type QaReportListRow = {
  id: string;
  reportType: QaReportType;
  pagePath: string;
  status: QaReportStatus;
  createdAt: string;
  reporterUserId: string;
  reporterFullName: string | null;
  screenshotPath: string | null;
};

/** Detail row for /admin/qa/[id]. Reporter join is fetched in a second
 *  step so the type stays stable across PostgREST embed shape changes. */
export type QaReportDetailRow = {
  id: string;
  userId: string;
  reportType: QaReportType;
  pagePath: string;
  questionId: string | null;
  questionType: QaReportQuestionType | null;
  problemText: string;
  expectedText: string;
  screenshotPath: string | null;
  userAgent: string | null;
  viewport: string | null;
  status: QaReportStatus;
  createdAt: string;
  reporterFullName: string | null;
};

/**
 * Count `qa_reports` rows with status='open'. Drives the open-count
 * badge on the admin nav. Uses `head: true` + `count: 'exact'` so we
 * never materialize the rows; only the count comes back.
 *
 * RLS-scoped via the SSR client — the admin policy
 * `qa_reports_admins_view_all` lets the count proceed. Returns 0 when
 * the table is empty or RLS returned nothing.
 */
export async function countOpenQaReports(
  supabase: SupabaseSsrClient
): Promise<number> {
  const { count, error } = await supabase
    .from("qa_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error || count === null) return 0;
  return count;
}

/**
 * List QA reports newest-first, optionally filtered. Joins the
 * reporter's profiles.full_name in a second pass (keeps the typing
 * trivial even if PostgREST changes embed shape between minor
 * versions).
 *
 * Admin RLS handles authorisation — `qa_reports_admins_view_all`
 * permits the SELECT.
 */
export async function listQaReports(
  supabase: SupabaseSsrClient,
  filters: ListQaReportsFilters = {}
): Promise<QaReportListRow[]> {
  let query = supabase
    .from("qa_reports")
    .select(
      "id, user_id, report_type, page_path, status, created_at, screenshot_path"
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.reportType) query = query.eq("report_type", filters.reportType);
  if (filters.reporterId) query = query.eq("user_id", filters.reporterId);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    user_id: string;
    report_type: QaReportType;
    page_path: string;
    status: QaReportStatus;
    created_at: string;
    screenshot_path: string | null;
  }>;

  // Reporter names — single batched IN() so the list stays one
  // round-trip beyond the main query.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const nameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of (profileRows ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      nameById.set(p.id, p.full_name);
    }
  }

  const projected: QaReportListRow[] = rows.map((r) => ({
    id: r.id,
    reportType: r.report_type,
    pagePath: r.page_path,
    status: r.status,
    createdAt: r.created_at,
    reporterUserId: r.user_id,
    reporterFullName: nameById.get(r.user_id) ?? null,
    screenshotPath: r.screenshot_path,
  }));

  // Slice 14 — triage sort. Stable sort by status rank only; within
  // each rank the SQL `.order("created_at", { ascending: false })`
  // above gave us newest-first, and Array.prototype.sort is stable in
  // V8 so that secondary order is preserved without an explicit
  // tiebreaker. When `filters.status` is set the comparator becomes a
  // no-op (single status in the result set) and the rows stay in
  // created_at-DESC order — the degenerate case is correct.
  return projected.sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  );
}

/**
 * Fetch a single report by id with the reporter's display name. Used
 * by the detail page; the page resolves the reporter's email
 * separately via the Auth Admin API (same pattern as getUserDetail in
 * lib/db/admin.ts — never via PostgREST against auth.users).
 *
 * Returns null when the row doesn't exist or RLS hid it.
 */
export async function getQaReportDetail(
  supabase: SupabaseSsrClient,
  id: string
): Promise<QaReportDetailRow | null> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as QaReportRow;

  let reporterFullName: string | null = null;
  if (row.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", row.user_id)
      .maybeSingle();
    reporterFullName =
      (profile as { full_name: string | null } | null)?.full_name ?? null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    reportType: row.report_type,
    pagePath: row.page_path,
    questionId: row.question_id,
    questionType: row.question_type,
    problemText: row.problem_text,
    expectedText: row.expected_text,
    screenshotPath: row.screenshot_path,
    userAgent: row.user_agent,
    viewport: row.viewport,
    status: row.status,
    createdAt: row.created_at,
    reporterFullName,
  };
}

/**
 * Resolve the chapter id for a question identity captured on a QA
 * report. Drives the "פתח עורך תוכן" link on the detail page:
 *
 *   - source: chapter_id is on source_questions directly.
 *   - angle:  angle_questions.source_question_id → source_questions.chapter_id.
 *
 * Returns the chapter id when resolvable, otherwise null (RLS hidden
 * row, archived question, or question_id no longer in the DB). The
 * caller falls back to plain id/type text when null.
 */
export async function resolveChapterForQuestion(
  supabase: SupabaseSsrClient,
  questionType: QaReportQuestionType,
  questionId: string
): Promise<string | null> {
  if (questionType === "source") {
    const { data } = await supabase
      .from("source_questions")
      .select("chapter_id")
      .eq("id", questionId)
      .maybeSingle();
    return (data as { chapter_id: string } | null)?.chapter_id ?? null;
  }
  // angle: indirect.
  const { data: angleRow } = await supabase
    .from("angle_questions")
    .select("source_question_id")
    .eq("id", questionId)
    .maybeSingle();
  const sourceId = (angleRow as { source_question_id: string } | null)
    ?.source_question_id;
  if (!sourceId) return null;
  const { data: sourceRow } = await supabase
    .from("source_questions")
    .select("chapter_id")
    .eq("id", sourceId)
    .maybeSingle();
  return (sourceRow as { chapter_id: string } | null)?.chapter_id ?? null;
}

/**
 * On the detail page the chapter editor link points to the source row
 * — angle URLs also live under /admin/chapters/[chapterId]/questions/
 * [sourceQuestionId] (the source page hosts the angle editor inline).
 * This helper resolves the source row's id for an angle question, so
 * the link can target the correct path. Returns the source id (or the
 * input id for `source` questions).
 */
export async function resolveQuestionEditorTargetId(
  supabase: SupabaseSsrClient,
  questionType: QaReportQuestionType,
  questionId: string
): Promise<string | null> {
  if (questionType === "source") return questionId;
  const { data } = await supabase
    .from("angle_questions")
    .select("source_question_id")
    .eq("id", questionId)
    .maybeSingle();
  return (data as { source_question_id: string } | null)?.source_question_id ?? null;
}
