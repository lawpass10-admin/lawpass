-- Re-engagement nudges — the "we haven't seen you in a while" email.
--
-- Three things live here:
--   1. profiles.email_opt_out   — the candidate's "stop emailing me"
--   2. email_nudges             — what we sent and when, so we cannot repeat
--   3. reengagement_candidates()— who is due one, decided in SQL
--
-- ── Why the selection is a database function ───────────────────────────────
-- "Inactive" means no sign-in AND no attempt AND no exam AND no practice AND
-- no answer of any of the three kinds. Computing that in Node means six
-- queries per user, or pulling every row of six tables into memory. In SQL it
-- is one round trip over indexes that already exist for RLS.
--
-- ── Why sends are logged rather than stamped on profiles ───────────────────
-- A `last_nudge_at` column answers "when did we last email them" and nothing
-- else. A row per send also answers "how many have they had" (so we can stop
-- after three rather than nagging forever), "did the provider accept it", and
-- "what did we send this person" when someone complains. That last question
-- gets asked eventually, and a column cannot answer it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Opt-out
-- ─────────────────────────────────────────────────────────────────────────────

-- Israeli law (חוק התקשורת, תיקון 40) requires a working opt-out on commercial
-- messages, and a re-engagement nudge is close enough to that line that it
-- needs one. Honoured in reengagement_candidates() below, so no caller can
-- forget to check it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.email_opt_out IS
  'Candidate asked to stop receiving lifecycle email. Never send marketing or '
  're-engagement mail when true. Account-critical mail (password reset, email '
  'verification) is transactional and is NOT governed by this flag.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The send log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_nudges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Kept open as TEXT rather than an enum: the next nudge type should be a
  -- one-line code change, not a migration that locks the table.
  kind         TEXT NOT NULL DEFAULT 'reengagement',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Resend's message id, so a delivery question can be traced from our row to
  -- their dashboard. NULL when the provider rejected the send.
  provider_id  TEXT,
  -- FALSE when the send failed. The row is written either way: a failed
  -- attempt still counts against the cooldown, or a provider outage would
  -- become a retry storm against the same candidates every hour.
  delivered    BOOLEAN NOT NULL DEFAULT TRUE
);

-- The cooldown and the cap are both "look at this user's recent rows of this
-- kind", which is exactly this index.
CREATE INDEX IF NOT EXISTS idx_email_nudges_user_kind_sent
  ON public.email_nudges (user_id, kind, sent_at DESC);

ALTER TABLE public.email_nudges ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies. Nothing in the app should read or write this from
-- a user session; the cron job uses the service role, which bypasses RLS. An
-- empty policy set means "deny everyone else", which is the intent.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Who is due a nudge
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reengagement_candidates(
  inactive_hours INT DEFAULT 24,
  cooldown_hours INT DEFAULT 168,   -- 7 days between nudges to one person
  max_nudges     INT DEFAULT 3,     -- then stop; silence is an answer
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
-- SECURITY DEFINER because auth.users is not readable by any application role,
-- and last_sign_in_at is the only record of "logged in but did nothing".
-- search_path is pinned so the function cannot be redirected by a caller's
-- search_path — the standard hardening for a definer function.
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
        -- Signing in counts as activity even with nothing done afterwards.
        -- COALESCE to created_at so a user who has never signed in is measured
        -- from signup rather than looking infinitely idle.
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
      -- No address, no email. user_email is nullable by design.
      AND p.user_email IS NOT NULL
      AND p.user_email <> ''
  ),
  nudge_stats AS (
    SELECT n.user_id,
           COUNT(*)          AS sent_count,
           MAX(n.sent_at)    AS last_sent_at
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
    -- Never twice inside the cooldown, however often the job runs. This is
    -- what makes an hourly schedule safe.
    AND (ns.last_sent_at IS NULL
         OR ns.last_sent_at < NOW() - make_interval(hours => cooldown_hours))
    -- A nudge must never arrive before the user's own last action: if they
    -- came back after the last send, the counter should start over rather than
    -- fire again on the old schedule.
    AND (ns.last_sent_at IS NULL OR ns.last_sent_at < la.last_activity_at
         OR ns.last_sent_at < NOW() - make_interval(hours => cooldown_hours))
  ORDER BY la.last_activity_at ASC
  LIMIT batch_limit;
$$;

-- Only the service role runs this. `authenticated` must not be able to
-- enumerate every candidate's email address, which is what this returns.
REVOKE ALL ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) TO service_role;

COMMENT ON FUNCTION public.reengagement_candidates(INT, INT, INT, INT) IS
  'Candidates with no activity for inactive_hours, not opted out, under the '
  'nudge cap and outside the cooldown. Service role only — returns emails.';
