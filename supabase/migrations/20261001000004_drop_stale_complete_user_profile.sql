-- Remove the stale 7-argument complete_user_profile.
--
-- WHAT IT IS. The original signature from 20260504000003. Slice 13 widened the
-- function to 9 arguments in 20260530000001, and that migration's DROP names
-- the 7-argument form — but it ran before its own CREATE, against a database
-- where the function had already been replaced, so the old overload survived.
-- Postgres keeps overloads side by side, so nothing failed and nobody noticed.
--
-- WHY IT MATTERS. It still works, and a caller that supplies the old seven
-- arguments gets a profile row with no academic_institution, no
-- legal_specialization, and now no NDA acceptance — silently, with no error.
-- The NDA record is exactly the kind of thing that must not have a second door
-- that skips it. Nothing in the app calls it today; this is about making sure
-- nothing can tomorrow.
--
-- Safe to run more than once: IF EXISTS, and the current 11-argument function
-- is a different signature and is untouched.

DROP FUNCTION IF EXISTS public.complete_user_profile(
  TEXT, TEXT, TEXT, DATE, DATE, TIMESTAMPTZ, TEXT
);
