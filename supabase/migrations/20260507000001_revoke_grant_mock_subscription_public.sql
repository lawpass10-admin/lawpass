-- Restore the REVOKE that was lost in 20260506000001_grant_mock_subscription_takes_plan.sql.
-- The previous parameterless version had it; the parameterized rewrite missed it. Postgres
-- defaults to GRANT EXECUTE TO PUBLIC on new functions, exposing the RPC at /rest/v1/rpc
-- to anon callers. The function's IF v_user_id IS NULL THEN RAISE EXCEPTION clause prevents
-- privilege escalation, but the function existence + signature is still discoverable by
-- anon, and represents an unintentional DoS surface. Lock it down.

REVOKE EXECUTE ON FUNCTION public.grant_mock_subscription(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_mock_subscription(TEXT) FROM anon;

-- Re-affirm the intended grant (idempotent — the original migration already granted it,
-- but explicit is better than implicit after this REVOKE).
GRANT EXECUTE ON FUNCTION public.grant_mock_subscription(TEXT) TO authenticated;
