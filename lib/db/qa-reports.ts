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
 * No service-role client is used here. Phase B-1 is tester-only writes;
 * admin reads + status updates land in Phase B-2.
 */

import type { createClient } from "@/lib/supabase/server";

type SupabaseSsrClient = Awaited<ReturnType<typeof createClient>>;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
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
