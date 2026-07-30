"use strict";

/**
 * Enforces the admin gate. Mirrors requireAdmin() in
 * lib/auth/admin-gate.ts.
 *
 * Assumes `authenticate` ran first (req.user, req.supabase set). Reads
 * the caller's own profile via the RLS client (users_view_own_profile
 * permits it) — no service-role client needed for the check.
 *
 * Where the Next.js helper did `redirect("/dashboard")` for a non-admin
 * (silently, so admin surfaces aren't leaked), this responds 403 with
 * `code: "forbidden"` and a neutral message; the frontend performs the
 * redirect. On success attaches req.adminProfile.
 */
async function requireAdmin(req, res, next) {
  const { data: profile } = await req.supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", req.user.id)
    .maybeSingle();

  if (!profile || !profile.is_admin) {
    return res
      .status(403)
      .json({ ok: false, error: "אין הרשאה", code: "forbidden" });
  }

  req.adminProfile = { is_admin: true, full_name: profile.full_name };
  next();
}

module.exports = { requireAdmin };
