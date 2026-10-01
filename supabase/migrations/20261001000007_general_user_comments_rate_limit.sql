-- Rate limiting for the contact form.
--
-- WHY AN RPC AND NOT A CHECK IN THE ACTION. The form is public, so it writes
-- with the anon role, and that role has INSERT on this table and no SELECT —
-- deliberately, so nobody can read back other people's messages. That also
-- means the action cannot count a sender's recent submissions to decide whether
-- to accept another one. A SECURITY DEFINER function can: it does the count and
-- the insert in one call, under its own privileges, and the caller still gets
-- no way to read the table.
--
-- Doing both in one statement also closes the gap between them. A check in the
-- app followed by an insert is two round trips, and a burst of parallel
-- submissions can pass the check together and then all insert.
--
-- THE TABLE GRANT IS REVOKED. With the RPC as the only write path, leaving
-- anon's direct INSERT in place would leave the rate limit trivially bypassed
-- by calling the table instead of the function.
--
-- WHAT THE LIMIT IS: 3 messages per IP per hour. Enough for someone who sends,
-- notices a typo and sends again; not enough to fill a table or an inbox.

ALTER TABLE public.general_user_comments
  ADD COLUMN IF NOT EXISTS sender_ip text;

COMMENT ON COLUMN public.general_user_comments.sender_ip IS
  'The submitting IP, from x-forwarded-for. Stored for rate limiting and abuse tracing; disclosed in the privacy policy under מידע טכני. Readable only with the service role — the table has no SELECT policy.';

-- The rate-limit query: this IP, recently. Partial on NOT NULL because a
-- submission without a resolvable IP is not rate limited by it.
CREATE INDEX IF NOT EXISTS idx_general_user_comments_ip_recent
  ON public.general_user_comments (sender_ip, created_at DESC)
  WHERE sender_ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_general_comment(
  p_full_name TEXT,
  p_email     TEXT,
  p_phone     TEXT,
  p_comment   TEXT,
  p_sender_ip TEXT DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent int;
  v_id     uuid;
BEGIN
  -- An IP we could not resolve is not rate limited: behind some proxies the
  -- header is absent, and refusing those would block real people to stop a bot
  -- that can spoof the header anyway.
  IF p_sender_ip IS NOT NULL THEN
    SELECT count(*) INTO v_recent
      FROM public.general_user_comments
     WHERE sender_ip = p_sender_ip
       AND created_at > now() - interval '1 hour';

    IF v_recent >= 3 THEN
      -- A distinguishable code, so the action can tell "slow down" apart from
      -- "something broke" and say the right thing to the sender.
      RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.general_user_comments (
    full_name, email, phone, comment, user_id, sender_ip
  ) VALUES (
    p_full_name, p_email, p_phone, p_comment, (SELECT auth.uid()), p_sender_ip
  )
  RETURNING comment_id INTO v_id;

  RETURN v_id;
END;
$$;

-- The function is the only write path now.
REVOKE INSERT ON public.general_user_comments FROM anon, authenticated;
DROP POLICY IF EXISTS general_user_comments_insert ON public.general_user_comments;

REVOKE EXECUTE ON FUNCTION public.submit_general_comment(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_general_comment(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;
