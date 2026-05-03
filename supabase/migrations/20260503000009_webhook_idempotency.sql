-- Migration 0009: Webhook idempotency log (SPEC 9.7.1, Hardening Rule #3)
-- Prevents double-processing of payment webhooks.

CREATE TABLE webhook_idempotency_log (
  idempotency_key TEXT PRIMARY KEY,           -- e.g. Tranzila transaction_id + event_type
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB NOT NULL,                      -- outcome (subscription created, etc.)
  webhook_source TEXT NOT NULL                -- 'tranzila', 'resend', etc.
);

-- For TTL cleanup (retain 90 days)
CREATE INDEX idx_webhook_idempotency_processed_at ON webhook_idempotency_log(processed_at);

-- RLS: no public access — accessed only via admin/service-role client
ALTER TABLE webhook_idempotency_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_webhook_log" ON webhook_idempotency_log
  FOR SELECT USING (public.is_admin());
