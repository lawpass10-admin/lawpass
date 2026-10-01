-- Recording acceptance of the quality-control NDA.
--
-- WHY A VERSION AND NOT JUST A TIMESTAMP. `terms_accepted_at` records WHEN
-- someone agreed; for an NDA that is not enough, because the question later is
-- "agreed to what". The agreement's own appendix requires that a change of
-- wording be a new version and that users re-accept on their next sign-in,
-- which is only answerable if the version they accepted is stored beside the
-- time. The text and the current version live in lib/legal/nda.ts.
--
-- NULLABLE, unlike terms_accepted_at which is NOT NULL. Every account created
-- before this migration accepted the תקנון but has never seen the NDA, and
-- back-filling a timestamp would record a consent that never happened. NULL is
-- the honest value and is what a gate should test for.
--
-- NOT DESTRUCTIVE: two nullable columns and an index. No data is changed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nda_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS nda_version text;

COMMENT ON COLUMN public.profiles.nda_accepted_at IS
  'When this user accepted the quality-control NDA. NULL means never — including every account created before the agreement existed.';

COMMENT ON COLUMN public.profiles.nda_version IS
  'Which version of the NDA was accepted (lib/legal/nda.ts NDA_VERSION). Compared against the current version to decide whether re-acceptance is required.';

-- "Who has not accepted the current version" is the question a gate asks on
-- every request, so it gets an index rather than a scan of profiles.
CREATE INDEX IF NOT EXISTS idx_profiles_nda_pending
  ON public.profiles (nda_version)
  WHERE nda_accepted_at IS NULL;
