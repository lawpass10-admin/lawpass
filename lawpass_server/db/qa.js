"use strict";

// Ported from lib/db/qa-reports.ts (write helpers) + the status-update
// portion of adminSetQaReportStatusAction in app/(app)/admin/_actions.ts.
//
// RLS is the load-bearing boundary:
//   - createQaReport runs under the tester's RLS client; the
//     qa_reports_testers_insert_own policy requires
//     user_id = auth.uid() AND profiles.is_qa_tester = TRUE.
//   - updateQaReportScreenshotPath runs under the SERVICE-ROLE client:
//     qa_reports has no testers-update policy, so a tester can't patch
//     the row. The action uploads the file (bucket policy scopes it to
//     the tester's own folder) then patches the FK via admin.
//   - the admin status helpers run under the admin's RLS client; the
//     qa_reports_admins_* policies permit the read + update.
//
// Read aggregations (listQaReports / getQaReportDetail / count /
// resolveChapterForQuestion) are intentionally NOT ported yet — they
// stay as Next.js admin-page queries, consistent with the other
// domains' read paths.

/**
 * Insert a QA report row via the RLS-scoped client. Returns the new id.
 * screenshot_path is always null here; the action patches it afterward
 * (using this id in the storage path) so a partial upload never leaves a
 * row pointing at a file that doesn't exist.
 */
async function createQaReport(supabase, input) {
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
      error: (error && error.message) || "insert_returned_no_row",
      code: error && error.code,
    };
  }
  return { ok: true, id: data.id };
}

/**
 * Patch screenshot_path after a successful storage upload. Requires the
 * service-role client (see the module header — no testers-update RLS
 * policy exists).
 */
async function updateQaReportScreenshotPath(adminClient, id, screenshotPath) {
  const { error } = await adminClient
    .from("qa_reports")
    .update({ screenshot_path: screenshotPath })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Fetch the prior status + owner of a report. The admin status action
 * needs the previous status for the audit "from → to" story and the
 * owner id for the audit row's target_user_id. Returns null when the row
 * doesn't exist (or RLS hid it).
 */
async function getQaReportStatusOwner(supabase, id) {
  const { data, error } = await supabase
    .from("qa_reports")
    .select("status, user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Move a report to a new status under the admin RLS client
 * (qa_reports_admins_update_all).
 */
async function updateQaReportStatus(supabase, id, status) {
  const { error } = await supabase
    .from("qa_reports")
    .update({ status })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

module.exports = {
  createQaReport,
  updateQaReportScreenshotPath,
  getQaReportStatusOwner,
  updateQaReportStatus,
};
