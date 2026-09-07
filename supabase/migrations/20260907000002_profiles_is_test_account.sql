-- profiles.is_test_account — accounts that exist to exercise the product, not
-- to use it.
--
-- WHY A FLAG AND NOT AN EMAIL PATTERN. The obvious shortcut is excluding
-- '%@law-pass.com' in the query. It is wrong twice over: uri.reviewer@law-pass.com
-- is a person on a company address who should still be treated as a user, and
-- the QA testers live on @lawpass.com — a different domain, one hyphen apart,
-- which is exactly the kind of distinction a LIKE pattern gets wrong at 2am.
-- A flag says what is true instead of inferring it from a string.
--
-- Beyond email, this is the column to check whenever "real users" is the
-- question: signup funnels, revenue, retention. Fixtures inflate every one of
-- those, and a 5-in-16 fixture rate makes the numbers meaningless.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_test_account IS
  'Fixture or internal account, not a real candidate. Excluded from lifecycle '
  'email and from any count of real users. Never set by the application — '
  'maintained by hand or by the fixture scripts that create these rows.';

-- Partial index: every consumer asks for the real users, which is nearly the
-- whole table, so index the small side.
CREATE INDEX IF NOT EXISTS idx_profiles_is_test_account
  ON public.profiles (is_test_account) WHERE is_test_account = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- The known fixtures, by exact address
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Listed individually rather than matched by pattern, so this migration says
-- precisely which five rows it touches and a reader can check the list.
--
--   e2e-3m / e2e-6m / e2e-nosub @law-pass.com  subscription-state fixtures
--   qa1 / qa2 @lawpass.com                     created by scripts/create-qa-testers.mjs
--
-- NOT included, deliberately:
--   uri.reviewer@law-pass.com  a named reviewer on a company address — could
--                              be a real person; flag it by hand if not.
--   lawpass10@gmail.com        the founder's own account, which is a real
--                              account that happens to belong to the team.
UPDATE public.profiles
   SET is_test_account = TRUE
 WHERE user_email IN (
   'e2e-3m@law-pass.com',
   'e2e-6m@law-pass.com',
   'e2e-nosub@law-pass.com',
   'qa1@lawpass.com',
   'qa2@lawpass.com'
 );

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-engagement now skips them
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Identical to 20260907000001 except for the is_test_account condition in
-- last_activity. Replaced whole rather than patched because CREATE OR REPLACE
-- FUNCTION takes the entire body, and a function defined in two places would
-- drift.

CREATE OR REPLACE FUNCTION public.reengagement_candidates(
  inactive_hours INT DEFAULT 24,
  cooldown_hours INT DEFAULT 168,
  max_nudges     INT DEFAULT 3,
  batch_limit    INT DEFAULT 200
)
RETURNS TABLE (
  user_id          UUID,
  full_name        TEXT,
  user_email       TEXT,
  gender           TEXT,
  last_activity_at TIMESTAMPTZ,
  nudges_sent      BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  WITH last_activity AS (
    SELECT
      p.id,
      p.full_name,
      p.user_email,
      p.gender,
      GREATEST(
        COALESCE(u.last_sign_in_at, u.created_at, p.created_at),
        COALESCE((SELECT MAX(a.attempted_at) FROM public.attempts a           WHERE a.user_id = p.id), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(e.started_at)   FROM public.exam_sessions e      WHERE e.user_id = p.id), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(s.started_at)   FROM public.practice_sessions s  WHERE s.user_id = p.id), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(m.created_at)   FROM public.mahoti_answers m     WHERE m.user_id = p.id), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(d.created_at)   FROM public.diuni_answers d      WHERE d.user_id = p.id), '-infinity'::timestamptz),
        COALESCE((SELECT MAX(o.created_at)   FROM public.open_question_answers o WHERE o.user_id = p.id), '-infinity'::timestamptz)
      ) AS last_activity_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.email_opt_out = FALSE
      -- Fixtures never receive lifecycle mail. Some of these inboxes do not
      -- exist, and mail to a non-existent address bounces — which costs the
      -- sending domain reputation that the password-reset emails depend on.
      AND p.is_test_account = FALSE
      AND p.user_email IS NOT NULL
      AND p.user_email <> ''
  ),
  nudge_stats AS (
    SELECT n.user_id,
           COUNT(*)       AS sent_count,
           MAX(n.sent_at) AS last_sent_at
    FROM public.email_nudges n
    WHERE n.kind = 'reengagement'
    GROUP BY n.user_id
  )
  SELECT
    la.id,
    la.full_name,
    la.user_email,
    la.gender,
    la.last_activity_at,
    COALESCE(ns.sent_count, 0)
  FROM last_activity la
  LEFT JOIN nudge_stats ns ON ns.user_id = la.id
  WHERE la.last_activity_at < NOW() - make_interval(hours => inactive_hours)
    AND COALESCE(ns.sent_count, 0) < max_nudges
    AND (ns.last_sent_at IS NULL
         OR ns.last_sent_at < NOW() - make_interval(hours => cooldown_hours))
    AND (ns.last_sent_at IS NULL OR ns.last_sent_at < la.last_activity_at
         OR ns.last_sent_at < NOW() - make_interval(hours => cooldown_hours))
  ORDER BY la.last_activity_at ASC
  LIMIT batch_limit;
$$;

REVOKE ALL ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) TO service_role;
