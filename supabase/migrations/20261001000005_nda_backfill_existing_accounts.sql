-- Mark the accounts that predate the NDA as accepted, and record that this is
-- what happened.
--
-- THE DECISION. The agreement shipped on 2026-10-01. The accounts that existed
-- before it were never shown it, and the gate that would have asked them was
-- removed as an unwanted interruption. The operator's decision is to treat
-- those accounts as covered.
--
-- WHY A METHOD COLUMN AND NOT JUST A TIMESTAMP. Without one, these rows are
-- indistinguishable from a user who read the agreement and ticked the box. If
-- the NDA is ever relied on, that difference is the entire question — "they
-- accepted on the 1st of October" would be a claim the data cannot support for
-- these seventeen. `nda_acceptance_method` makes the backfill legible instead
-- of hiding it inside a timestamp.
--
-- DEFAULT 'user' so every acceptance recorded through the registration forms —
-- past and future — reads as what it is without any code change. Only the rows
-- updated below carry 'admin_backfill'.
--
-- NOT DESTRUCTIVE in the sense of removing data, but it does WRITE a consent
-- record for accounts that never gave one. That is the operator's call, taken
-- knowingly, and this comment is the record of it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nda_acceptance_method text NOT NULL DEFAULT 'user'
    CHECK (nda_acceptance_method IN ('user', 'admin_backfill'));

COMMENT ON COLUMN public.profiles.nda_acceptance_method IS
  'How the NDA acceptance on this row came about. ''user'' = the person ticked the box on a registration form. ''admin_backfill'' = the account predates the agreement and was marked as covered by operator decision (migration 20261001000005); nobody was shown the text.';

-- Only rows with nothing recorded. Anyone who has genuinely accepted — and any
-- re-run of this migration — is left alone.
UPDATE public.profiles
   SET nda_accepted_at = now(),
       nda_version = '1.0',
       nda_acceptance_method = 'admin_backfill'
 WHERE nda_accepted_at IS NULL;
