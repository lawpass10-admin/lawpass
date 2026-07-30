"use strict";

/**
 * Enforces QA-tester status. Mirrors the tester pre-check inside the
 * original submitQaReport action.
 *
 * Assumes `authenticate` ran first (req.user, req.supabase set). RLS
 * (qa_reports_testers_insert_own) would also block a non-tester INSERT,
 * but this cheap check gives the widget a friendly typed error and
 * avoids wasting an INSERT round-trip. Reads the caller's own profile
 * via the RLS client (users_view_own_profile permits it).
 *
 * On refusal responds 403 with `code: "not_qa_tester"`.
 */
async function requireTester(req, res, next) {
  const { data: profile } = await req.supabase
    .from("profiles")
    .select("is_qa_tester")
    .eq("id", req.user.id)
    .maybeSingle();

  if (!profile || !profile.is_qa_tester) {
    return res
      .status(403)
      .json({ ok: false, error: "אין הרשאת דיווח QA", code: "not_qa_tester" });
  }

  next();
}

module.exports = { requireTester };
