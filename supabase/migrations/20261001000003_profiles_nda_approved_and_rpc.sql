-- The NDA acceptance, recorded on the profile and written at signup.
--
-- Part 1 — `nda_approved`, the plain true/false field asked for.
--
-- It is GENERATED, not a column anyone writes. A hand-maintained boolean beside
-- `nda_accepted_at` is two facts that must agree and eventually will not: an
-- update that sets one and not the other leaves a profile claiming consent with
-- no date, or a date with the flag false, and there is no way afterwards to
-- tell which one lied. Deriving it means the question "did they approve?" has
-- exactly one answer, and it is the timestamp.
--
-- It still reads the way it was asked for: `WHERE nda_approved` works, and so
-- does selecting it into the app.
--
-- Part 2 — complete_user_profile writes the acceptance.
--
-- Until now the NDA columns existed and nothing filled them: a user had to tick
-- the box to register and the agreement recorded nothing. The RPC is the one
-- place a profile row is created, so the acceptance is written there, in the
-- same statement as the row — not in a follow-up UPDATE that can fail on its
-- own and leave a profile with no record of what was agreed.
--
-- The version is passed in by the app from lib/legal/nda.ts rather than
-- defaulted here, so the text shown and the version stored cannot disagree.
--
-- NOT DESTRUCTIVE. The generated column is new. The function is replaced with a
-- wider signature and the old one dropped, which is how the two earlier
-- migrations in this family already evolve it.

-- ── part 1 ───────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nda_approved boolean
    GENERATED ALWAYS AS (nda_accepted_at IS NOT NULL) STORED;

COMMENT ON COLUMN public.profiles.nda_approved IS
  'Whether this user accepted the quality-control NDA. GENERATED from nda_accepted_at — not writable, and therefore cannot drift from it. See nda_version for which text was accepted.';

-- ── part 2 ───────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.complete_user_profile(
  p_full_name             TEXT,
  p_phone                 TEXT,
  p_gender                TEXT,
  p_birth_date            DATE,
  p_exam_date_planned     DATE,
  p_terms_accepted_at     TIMESTAMPTZ,
  p_signup_source         TEXT,
  p_academic_institution  TEXT,
  p_legal_specialization  TEXT,
  p_nda_accepted_at       TIMESTAMPTZ DEFAULT NULL,
  p_nda_version           TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id         UUID := (SELECT auth.uid());
  v_email_confirmed TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_signup_source NOT IN ('email','google') THEN
    RAISE EXCEPTION 'invalid signup_source: %', p_signup_source;
  END IF;
  IF p_signup_source = 'email' THEN
    SELECT email_confirmed_at INTO v_email_confirmed FROM auth.users WHERE id = v_user_id;
    IF v_email_confirmed IS NULL THEN
      RAISE EXCEPTION 'email not confirmed';
    END IF;
  END IF;

  -- An acceptance time with no version, or a version with no time, is a record
  -- that cannot answer "agreed to what" — which is the only reason this is
  -- stored at all. Reject the pair rather than persist half of it.
  IF (p_nda_accepted_at IS NULL) <> (p_nda_version IS NULL) THEN
    RAISE EXCEPTION 'nda_accepted_at and nda_version must be given together';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, phone, gender, birth_date,
    exam_date_planned, terms_accepted_at, signup_source,
    academic_institution, legal_specialization,
    nda_accepted_at, nda_version
  ) VALUES (
    v_user_id, p_full_name, p_phone, p_gender, p_birth_date,
    p_exam_date_planned, p_terms_accepted_at, p_signup_source,
    p_academic_institution, p_legal_specialization,
    p_nda_accepted_at, p_nda_version
  ) ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO authenticated;
