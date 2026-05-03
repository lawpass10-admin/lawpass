-- Migration 0006: Payments and Subscriptions (SPEC 8.5)
-- payments must be created BEFORE subscriptions due to FK reference.

-- ============================================================
-- payments (SPEC 8.5.2)
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  amount_ils INTEGER NOT NULL,
  vat_included BOOLEAN NOT NULL DEFAULT TRUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('3_months', '6_months', 'upgrade')),

  payment_provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),

  invoice_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- subscriptions (SPEC 8.5.1)
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  plan_type TEXT NOT NULL CHECK (plan_type IN ('3_months', '6_months')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,

  payment_id UUID REFERENCES payments(id),

  granted_by_admin UUID REFERENCES profiles(id),
  admin_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_user_current ON subscriptions(user_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_subscriptions_ends_at ON subscriptions(ends_at) WHERE status = 'active';

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS for payments and subscriptions
-- ============================================================

-- payments: users SELECT own (regardless of subscription status), admin SELECT all
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_payments" ON payments
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "admins_view_all_payments" ON payments
  FOR SELECT USING (public.is_admin());

-- subscriptions: users SELECT own (regardless of subscription status), admin full access
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_subscriptions" ON subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "admins_full_access_subscriptions" ON subscriptions
  FOR ALL USING (public.is_admin());
