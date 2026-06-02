-- Slice 43 — /early-access waitlist email-capture table.
--
-- The PM already applied this SQL to the live database. This migration file
-- keeps the repo in sync with the live schema so future `supabase db reset` /
-- branch flows don't drift from production. DO NOT run `supabase db push`
-- against this file in the BUILD slice.
--
-- Identity + storage:
--   * id          uuid primary key, default gen_random_uuid().
--   * email       text, NOT NULL. Stored as written; uniqueness check is
--                 case-insensitive via the lower(email) UNIQUE INDEX below
--                 (one row per logical address regardless of casing).
--   * source      text, NULLABLE. The funnel-attribution string the server
--                 action receives from the landing CTAs (e.g. "hero",
--                 "plan-3mo", "plan-6mo"). NULL for direct visits.
--   * created_at  timestamptz, NOT NULL, default now().
--
-- RLS (load-bearing):
--   * Anonymous visitors can INSERT only. No SELECT/UPDATE/DELETE policy is
--     defined for anon, so those operations fail closed at the DB level.
--   * The PM (service-role) bypasses RLS for the export path. Membership in
--     the waitlist must NOT be world-readable; even row counts via SELECT
--     would let a scraper measure list size.
--
-- The server action (app/(marketing)/early-access/_actions.ts) treats the
-- 23505 unique_violation from a duplicate email as a silent success — no
-- membership-leak via the error path.

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text          NOT NULL,
  source      text          NULL,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness. The expression-index form is what lets the
-- 23505 duplicate path fire on "Foo@Bar.com" vs "foo@bar.com".
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_lower_uq
  ON public.waitlist_signups (lower(email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anon: INSERT only. No SELECT/UPDATE/DELETE policy exists, so RLS denies
-- those for unauthenticated callers. Service-role bypasses RLS automatically.
CREATE POLICY waitlist_signups_anon_insert
  ON public.waitlist_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);
