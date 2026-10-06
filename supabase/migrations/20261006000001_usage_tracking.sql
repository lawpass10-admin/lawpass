-- Usage tracking: which endpoints get used, from phones and from computers.
--
-- COUNTERS, NOT A ROW PER REQUEST. A hit table at 5K MAU is tens of millions of
-- rows a year to answer a question that is always "how many". This keeps one
-- row per (day, surface, device, path) and increments it, so the table grows
-- with the number of ENDPOINTS, not with traffic — a few thousand rows a year.
-- The cost is that individual requests cannot be replayed, which is the right
-- trade for product analytics and the wrong one for an audit log. If an audit
-- log is ever needed it should be a separate table, not this one widened.
--
-- NO user_id, NO ip, NO user agent string. The question is "do people use this
-- on a phone", not "what did this person do" — and a table that cannot identify
-- anyone needs no retention policy, no subject-access handling and no RLS
-- reasoning beyond "staff only".

CREATE TABLE IF NOT EXISTS public.usage_daily (
  day     date   NOT NULL DEFAULT CURRENT_DATE,

  -- 'web' = the Next app (pages and its route handlers).
  -- 'api' = the Express server (lawpass_server).
  -- Separate because the same path can exist on both and they are different
  -- things to the person reading the numbers.
  surface text   NOT NULL,

  -- 'mobile' | 'desktop' | 'bot'. Bots are recorded rather than dropped: a
  -- path whose traffic is 90% crawler is a useful thing to find out, and
  -- silently discarding it would make the other two numbers lie about share.
  device  text   NOT NULL,

  -- NORMALISED. "/study-material/9876a9cc-…" is recorded as
  -- "/study-material/:id" — the recorder replaces uuids and numeric segments
  -- before it gets here. Without that this table would grow one row per
  -- document per day and answer nothing.
  path    text   NOT NULL,

  hits    bigint NOT NULL DEFAULT 0,

  PRIMARY KEY (day, surface, device, path),
  CONSTRAINT usage_daily_surface_check CHECK (surface IN ('web', 'api')),
  CONSTRAINT usage_daily_device_check  CHECK (device IN ('mobile', 'desktop', 'bot')),
  CONSTRAINT usage_daily_path_length   CHECK (char_length(path) BETWEEN 1 AND 200)
);

-- "the last 30 days, busiest first" is the only read this table gets.
CREATE INDEX IF NOT EXISTS usage_daily_day_hits_idx
  ON public.usage_daily (day DESC, hits DESC);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- Staff read it; nobody else sees it at all. There is no student-facing view
-- of this and no reason for one.
DROP POLICY IF EXISTS usage_daily_admins_select ON public.usage_daily;
CREATE POLICY usage_daily_admins_select
  ON public.usage_daily FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.usage_daily TO authenticated;

-- ---------------------------------------------------------------------------
-- The recorder
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so an anonymous visitor can be counted without being able
-- to read or write the table any other way. It takes three bounded arguments
-- and performs exactly one upsert; there is no path through it to anything
-- else, which is what makes handing it to `anon` safe.
--
-- Returns void and swallows nothing: a failure here surfaces to the caller,
-- which is deliberate. The CALLERS fire and forget — a page must not fail
-- because analytics did — but this function telling the truth is what makes a
-- silent outage findable.

CREATE OR REPLACE FUNCTION public.record_usage(
  p_surface text,
  p_device  text,
  p_path    text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Clamped rather than rejected: a recorder sending a long path is a bug
  -- worth seeing in the data, not a reason to lose the whole day's count.
  INSERT INTO public.usage_daily (day, surface, device, path, hits)
  VALUES (
    CURRENT_DATE,
    CASE WHEN p_surface IN ('web', 'api') THEN p_surface ELSE 'web' END,
    CASE WHEN p_device IN ('mobile', 'desktop', 'bot') THEN p_device ELSE 'desktop' END,
    left(coalesce(nullif(btrim(p_path), ''), '/'), 200),
    1
  )
  ON CONFLICT (day, surface, device, path)
  DO UPDATE SET hits = public.usage_daily.hits + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_usage(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_usage(text, text, text) TO anon, authenticated, service_role;

COMMENT ON TABLE public.usage_daily IS
  'Per-day hit counters by surface, device and normalised path. No personal data; staff-read only. Written through record_usage().';
