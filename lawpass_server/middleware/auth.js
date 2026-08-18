"use strict";

const { anonClient, clientForToken } = require("../config/supabase");

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
 *
 * ── Why this verifies locally ──────────────────────────────────────────────
 * This used to call `auth.getUser(token)`, which is a round trip to Supabase
 * Auth. Measured from a dev machine that is ~165ms, paid by EVERY request
 * before any work begins — and the dashboard alone makes five, so a third of a
 * second of a two-second page was spent asking whether a signed token was
 * signed.
 *
 * The project signs access tokens with ES256, so the signature can be checked
 * against the published JWKS with no network call at all. `getClaims` does that
 * verification, fetches the key set once and caches it on the client instance —
 * which is why the verifier below is a module-level singleton rather than a
 * client per request. A per-request client would refetch the JWKS every time
 * and be no better than what it replaced.
 *
 * ── The trade-off, stated plainly ──────────────────────────────────────────
 * A network check asks Supabase "is this session still live", so a sign-out or
 * a revoked session takes effect immediately. Local verification only proves
 * the token was validly issued and has not expired, so a token revoked mid-life
 * keeps working until `exp` — up to the project's access-token TTL (1h by
 * default). That is the standard JWT trade-off and it is what Supabase
 * recommends for this path, but it IS a change in behaviour.
 *
 * Two ways out if that matters for a given route:
 *   - set LAWPASS_AUTH_VERIFY=network to restore the old behaviour everywhere,
 *     no code change and no deploy beyond the env var;
 *   - mount `authenticateStrict` on the routes that need immediate revocation
 *     (admin actions, anything destructive) and leave reads on the fast path.
 */

// One client for the lifetime of the process: it holds the cached JWKS. This is
// only ever used to verify tokens — never to query data, which always goes
// through the caller's own RLS-scoped client below.
let verifier = null;
function getVerifier() {
  if (!verifier) verifier = anonClient();
  return verifier;
}

const NETWORK_ONLY = String(process.env.LAWPASS_AUTH_VERIFY || "").toLowerCase() === "network";

function bearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Claims -> the `user` shape the controllers already expect. */
function userFromClaims(claims) {
  return {
    id: claims.sub,
    email: claims.email ?? null,
    role: claims.role ?? null,
    aud: claims.aud ?? null,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
  };
}

/** The old behaviour: ask Supabase Auth. Kept as the fallback and for strict routes. */
async function verifyOverNetwork(token) {
  const {
    data: { user },
    error,
  } = await clientForToken(token).auth.getUser(token);
  return error || !user ? null : user;
}

async function attach(req, res, next, { strict }) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "לא מחובר" });
  }

  let user = null;

  if (strict || NETWORK_ONLY) {
    user = await verifyOverNetwork(token);
  } else {
    try {
      const { data, error } = await getVerifier().auth.getClaims(token);
      const claims = data?.claims;
      if (!error && claims?.sub) {
        // getClaims validates the signature and the standard claims, but the
        // expiry is the one worth re-checking here rather than trusting: an
        // accepted expired token is a session that never ends.
        const expired = typeof claims.exp === "number" && claims.exp * 1000 <= Date.now();
        if (!expired) user = userFromClaims(claims);
      }
    } catch (err) {
      // A JWKS fetch failure, an unexpected key rotation, a project switched
      // back to a shared secret — none of these should log everyone out, so
      // fall through to the network check rather than rejecting.
      console.warn(
        `[auth] local verification unavailable (${err && err.message ? err.message : err}) — falling back to the network check`
      );
      user = await verifyOverNetwork(token);
    }
  }

  if (!user) {
    return res.status(401).json({ ok: false, error: "לא מחובר" });
  }

  req.accessToken = token;
  req.user = user;
  req.supabase = clientForToken(token);
  next();
}

/** Fast path: local signature check, no round trip. */
async function authenticate(req, res, next) {
  return attach(req, res, next, { strict: false });
}

/**
 * Asks Supabase Auth on every request, so a revoked session is refused at once.
 * For routes where the revocation window matters more than the 165ms.
 */
async function authenticateStrict(req, res, next) {
  return attach(req, res, next, { strict: true });
}

module.exports = { authenticate, authenticateStrict };
