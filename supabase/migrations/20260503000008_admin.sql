-- Migration 0008: Admin tables (SPEC 8.7)

-- ============================================================
-- admin_actions_log (SPEC 8.7.1)
-- ============================================================
CREATE TABLE admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id),
  target_resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_log_admin ON admin_actions_log(admin_id);
CREATE INDEX idx_admin_log_target_user ON admin_actions_log(target_user_id);
CREATE INDEX idx_admin_log_created_at ON admin_actions_log(created_at DESC);

-- RLS: admin SELECT only, no other access (SPEC 19.3.1)
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_admin_log" ON admin_actions_log
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admins_insert_admin_log" ON admin_actions_log
  FOR INSERT WITH CHECK (public.is_admin());
