-- A ceiling on outbound notification email from the contact form.
--
-- WHAT IT IS FOR. The per-IP rate limit (20261001000007) stops one sender
-- flooding the form. It does nothing about spam spread across many addresses:
-- 500 IPs sending two messages each are all under the limit, and the result is
-- a thousand emails through law-pass.com. That domain also sends OTP codes and
-- password resets, so a flood does not just fill an inbox — it damages the
-- sending reputation the product's sign-in flow depends on.
--
-- THE MESSAGE IS ALWAYS STORED. The cap suppresses the NOTIFICATION, never the
-- submission: beyond the ceiling the row still lands and `notified_at` stays
-- NULL, so anything missed from the inbox is a query away rather than lost.
-- That is what makes this cheap — no real sender is ever turned away, and the
-- only cost in a flood is reading a few genuine messages out of the table.
--
-- 20 PER HOUR is far above any plausible real volume for this form, so in
-- ordinary operation it never fires.
--
-- `notified_at` RECORDS THE DECISION, NOT DELIVERY. It is set when the row is
-- chosen to be emailed, before the send is attempted — the sending happens in
-- the application, which cannot write back here (anon has no UPDATE). A send
-- that then fails leaves a row marked as notified with no mail delivered; that
-- is logged by the caller. Counting attempts is the right basis for a cap
-- anyway: a failed send still cost the domain a connection.

ALTER TABLE public.general_user_comments
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

COMMENT ON COLUMN public.general_user_comments.notified_at IS
  'When this message was selected for an email notification. NULL means no email was sent — either the hourly cap was reached or notification is not configured. Records the attempt, not confirmed delivery.';

-- The cap query: notifications in the last hour.
CREATE INDEX IF NOT EXISTS idx_general_user_comments_notified_at
  ON public.general_user_comments (notified_at DESC)
  WHERE notified_at IS NOT NULL;

-- Returning two values now, so the signature changes.
DROP FUNCTION IF EXISTS public.submit_general_comment(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_general_comment(
  p_full_name TEXT,
  p_email     TEXT,
  p_phone     TEXT,
  p_comment   TEXT,
  p_sender_ip TEXT DEFAULT NULL
) RETURNS TABLE (comment_id uuid, should_notify boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent   int;
  v_notified int;
  v_notify   boolean;
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
      RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- The cap, decided in the same statement as the insert so a burst cannot
  -- have several submissions each read the count before any of them writes.
  SELECT count(*) INTO v_notified
    FROM public.general_user_comments
   WHERE notified_at > now() - interval '1 hour';

  v_notify := v_notified < 20;

  RETURN QUERY
  INSERT INTO public.general_user_comments (
    full_name, email, phone, comment, user_id, sender_ip, notified_at
  ) VALUES (
    p_full_name, p_email, p_phone, p_comment, (SELECT auth.uid()), p_sender_ip,
    CASE WHEN v_notify THEN now() ELSE NULL END
  )
  RETURNING general_user_comments.comment_id, v_notify;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_general_comment(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_general_comment(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;
