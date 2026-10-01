-- general_user_comments — the "צרו קשר" / "תמיכה" contact form.
--
-- Reached from the landing nav and the footer, by visitors who are not signed
-- in, so the write path is the same shape as waitlist_signups: an RLS policy
-- that permits the INSERT, plus the table-level GRANT the policy sits on top of
-- (the waitlist shipped without the GRANT and had to be corrected in
-- 20260602000002 — both halves are here from the start).
--
-- WRITE-ONLY FOR EVERYONE. anon and authenticated may INSERT and nothing else:
-- no SELECT policy exists, so a visitor cannot read back other people's
-- messages, which would otherwise hand out names, addresses and phone numbers
-- to anyone who found the endpoint. Staff read it through the service role.
--
-- user_id is recorded when the sender happens to be signed in, and is NULL
-- otherwise. It is deliberately not required: the form is on a public page and
-- most senders will not have an account.

CREATE TABLE IF NOT EXISTS public.general_user_comments (
  comment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- All three are mandatory on the form and mandatory here. The length caps
  -- are the first line against a bot filling the table with megabytes: the
  -- form's own limits are smaller, and these stop anything that bypasses it.
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  email     text NOT NULL CHECK (char_length(btrim(email)) BETWEEN 5 AND 254),
  phone     text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 6 AND 32),
  comment   text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 2 AND 4000),

  -- Who sent it, when they were signed in. ON DELETE SET NULL so closing an
  -- account does not delete the message thread it was part of.
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.general_user_comments IS
  'Messages from the צרו קשר / תמיכה contact dialog. Write-only for anon and authenticated; read with the service role.';

-- Staff read this newest-first, which is the only query it has.
CREATE INDEX IF NOT EXISTS idx_general_user_comments_created_at
  ON public.general_user_comments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_general_user_comments_user_id
  ON public.general_user_comments (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.general_user_comments ENABLE ROW LEVEL SECURITY;

-- Anyone may send a message. Nobody may read one back.
DROP POLICY IF EXISTS general_user_comments_insert ON public.general_user_comments;
CREATE POLICY general_user_comments_insert
  ON public.general_user_comments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- The GRANT the policy rests on. RLS decides which rows a role may write; the
-- role still needs the table privilege underneath it.
GRANT INSERT ON public.general_user_comments TO anon, authenticated;
