-- Migration 0003: Profiles table (SPEC 8.2.2)
-- 1:1 with auth.users. Contains user personal details.

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL COLLATE hebrew,
  phone TEXT,

  -- Demographic fields (v1.2)
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  birth_date DATE NOT NULL CHECK (birth_date <= CURRENT_DATE - INTERVAL '18 years'),

  exam_date_planned DATE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  signup_source TEXT NOT NULL CHECK (signup_source IN ('email', 'google')),
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- updated_at trigger
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users: SELECT own profile (authenticated, regardless of subscription)
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

-- Users: INSERT own profile (for signup)
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- Users: UPDATE own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- Admin: SELECT all profiles
CREATE POLICY "admins_view_all_profiles" ON profiles
  FOR SELECT USING (public.is_admin());

-- Admin: UPDATE all profiles
CREATE POLICY "admins_update_all_profiles" ON profiles
  FOR UPDATE USING (public.is_admin());
