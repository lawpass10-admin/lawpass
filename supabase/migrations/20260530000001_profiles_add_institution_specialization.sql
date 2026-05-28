-- Slice 13 — onboarding adds academic institution + legal specialization.
-- Nullable so existing users (no value yet) aren't broken. The signup form
-- enforces "required" at the app layer; existing users keep null until they
-- edit /account (follow-up slice) or admin updates them out-of-band.

ALTER TABLE public.profiles
  ADD COLUMN academic_institution TEXT NULL,
  ADD COLUMN legal_specialization TEXT NULL;

DROP FUNCTION IF EXISTS public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT
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
  p_legal_specialization  TEXT
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

  INSERT INTO public.profiles (
    id, full_name, phone, gender, birth_date,
    exam_date_planned, terms_accepted_at, signup_source,
    academic_institution, legal_specialization
  ) VALUES (
    v_user_id, p_full_name, p_phone, p_gender, p_birth_date,
    p_exam_date_planned, p_terms_accepted_at, p_signup_source,
    p_academic_institution, p_legal_specialization
  ) ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT, TEXT, TEXT
) TO authenticated;
