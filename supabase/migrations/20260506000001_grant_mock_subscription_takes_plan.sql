-- Replace grant_mock_subscription() (parameterless, hardcoded 3_months) with
-- grant_mock_subscription(p_plan_type TEXT). Keeps Hardening Rule #2
-- (subquery-wrapped auth.uid()) and the ON CONFLICT idempotency invariant.
-- Duration derived from plan_type: 3_months → 90 days, 6_months → 180 days.

DROP FUNCTION IF EXISTS public.grant_mock_subscription();

CREATE FUNCTION public.grant_mock_subscription(p_plan_type TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_subscription_id uuid;
  v_duration_days INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_plan_type NOT IN ('3_months', '6_months') THEN
    RAISE EXCEPTION 'invalid plan_type: %', p_plan_type USING ERRCODE = '22023';
  END IF;

  v_duration_days := CASE p_plan_type
    WHEN '3_months' THEN 90
    WHEN '6_months' THEN 180
  END;

  INSERT INTO subscriptions (user_id, plan_type, status, is_current, starts_at, ends_at)
  VALUES (
    v_user_id,
    p_plan_type,
    'active',
    TRUE,
    NOW(),
    NOW() + (v_duration_days || ' days')::INTERVAL
  )
  ON CONFLICT (user_id) WHERE is_current = TRUE
  DO NOTHING
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_mock_subscription(TEXT) TO authenticated;
