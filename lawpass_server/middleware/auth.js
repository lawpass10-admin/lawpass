"use strict";

const { clientForToken } = require("../config/supabase");

/**
 * Authenticates a request via the `Authorization: Bearer <token>` header,
 * where the token is a Supabase access token minted by the frontend's
 * Supabase Auth session. On success attaches:
 *   req.accessToken — the raw JWT
 *   req.user        — the authenticated Supabase user
 *   req.supabase    — an RLS-scoped client bound to that token
 *
 * Every user-triggered endpoint mounts this first, so downstream
 * controllers always use `req.supabase` (RLS enforced) and never the
 * admin client. Mirrors the Next.js SSR pattern.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ ok: false, error: "לא מחובר" });
  }

  const token = match[1].trim();
  const supabase = clientForToken(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ ok: false, error: "לא מחובר" });
  }

  req.accessToken = token;
  req.user = user;
  req.supabase = supabase;
  next();
}

module.exports = { authenticate };
