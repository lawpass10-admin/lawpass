-- Migration 0015: Lock down rls_auto_enable + add mock subscription helper.
-- Slice 1, Phase 1.
--
-- (1) Closes the security advisor warning by revoking EXECUTE on
--     public.rls_auto_enable() from PUBLIC/anon/authenticated. The function
--     stays in place because it backs the `ensure_rls` event trigger, which
--     auto-enables RLS on every new CREATE TABLE in public. We only need
--     to stop it being callable via /rest/v1/rpc/.
--
-- (2) Replaces the existing non-unique idx_subscriptions_user_current
--     (created in 0006) with a UNIQUE partial index, enforcing
--     "at most one current subscription per user" at the DB level.
--     Race-safety prerequisite for grant_mock_subscription and Slice 4
--     Tranzila webhook.
--
-- (3) Adds public.grant_mock_subscription() — a SECURITY DEFINER helper
--     that inserts a mock 3-month active subscription for the calling
--     user. ON CONFLICT inference targets the partial unique index in (2)
--     so concurrent double-clicks don't break the invariant.
--     TODO: replaced by Tranzila webhook in Slice 4 — drop this function then.

-- ============================================================
-- (1) Revoke external EXECUTE on rls_auto_enable
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- (2) Replace non-unique idx_subscriptions_user_current with UNIQUE partial
-- ============================================================
DROP INDEX IF EXISTS idx_subscriptions_user_current;
CREATE UNIQUE INDEX idx_subscriptions_user_current
  ON subscriptions(user_id) WHERE is_current = TRUE;

-- ============================================================
-- (3) grant_mock_subscription() — Slice 1 stub
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_mock_subscription()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_subscription_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Idempotent fast path: if a current active subscription already exists, return it.
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE user_id = v_user_id
    AND is_current = TRUE
    AND status = 'active'
    AND ends_at > NOW()
  LIMIT 1;

  IF v_subscription_id IS NOT NULL THEN
    RETURN v_subscription_id;
  END IF;

  -- Mark prior current rows as not-current (preserves the unique-current invariant).
  UPDATE subscriptions
  SET is_current = FALSE
  WHERE user_id = v_user_id AND is_current = TRUE;

  -- Race-safe insert: ON CONFLICT inference targets the partial unique index
  -- idx_subscriptions_user_current. If a concurrent caller won the race,
  -- DO NOTHING and we re-fetch below.
  INSERT INTO subscriptions (user_id, plan_type, status, is_current, starts_at, ends_at)
  VALUES (v_user_id, '3_months', 'active', TRUE, NOW(), NOW() + INTERVAL '90 days')
  ON CONFLICT (user_id) WHERE is_current = TRUE
  DO NOTHING
  RETURNING id INTO v_subscription_id;

  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id
    FROM subscriptions
    WHERE user_id = v_user_id AND is_current = TRUE
    LIMIT 1;
  END IF;

  RETURN v_subscription_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_mock_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_mock_subscription() TO authenticated;
