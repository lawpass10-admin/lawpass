-- mahoti_laws — one row per distinct law, carrying its full scraped record
-- and its parsed sections. Preparation for the mahoti question generator:
-- the generator cites (law_id, section_number) pairs and verifies every quote
-- against the section text, so this table is the corpus it reads from.
--
-- Source: knesset_scraper/batch.py, which resolves each law against the
-- Knesset OData service and converts its Reshumot publication PDF to JSON.
--
-- Columns:
--   * law_id         integer PK. The Knesset's KNS_IsraelLaw Id (e.g. 2000479
--                    for חוק העונשין). Natural key — the generator's source
--                    citations and its quote validator both key on it.
--   * law_name       text NOT NULL, Hebrew-collated. The resolved official
--                    name, e.g. 'חוק העונשין, התשל"ז-1977'.
--   * laws_body      jsonb NOT NULL. The whole scraped law record: the OData
--                    row, the amendment list, the PDF url + sha256, and the
--                    extraction metadata.
--   * sections_body  jsonb NOT NULL. The parsed sections array — number,
--                    heading, chapter, page, text, subsections.
--   * date           timestamptz NOT NULL, default now(). When this row's
--                    content was scraped.
--
-- Note on law_id as the primary key: a law that the OData lookup cannot
-- resolve has no id, and cannot be stored here. That is deliberate — such
-- laws are never scraped, never enter the corpus, and so can never be cited.
-- Every secondary-legislation item so far (כללי לשכת עורכי הדין, תקנות מיסוי
-- מקרקעין) falls in that bucket. If those are ever ingested from another
-- source, this needs a surrogate key and a UNIQUE on law_id instead.
--
-- RLS: fails closed, matching open_questions. Admin-only while this is
-- ingestion-side content; the service role used by the scraper and the
-- generator bypasses RLS. Add an `authenticated` SELECT policy plus the
-- matching GRANT in a follow-up if the app ever renders legislation directly.

CREATE TABLE IF NOT EXISTS public.mahoti_laws (
  law_id         integer      PRIMARY KEY,
  law_name       text         NOT NULL COLLATE hebrew,
  laws_body      jsonb        NOT NULL,
  sections_body  jsonb        NOT NULL,
  date           timestamptz  NOT NULL DEFAULT now()
);

-- Lookup and Hebrew-alphabetical listing by name. The collation on the column
-- carries into the index, so ORDER BY law_name sorts correctly in Hebrew.
CREATE INDEX IF NOT EXISTS idx_mahoti_laws_law_name
  ON public.mahoti_laws (law_name);

-- Trigram index for the substring search the scraper's finder does on names
-- ("does any law contain 'חוק החוזים'?"). pg_trgm is enabled in 0001.
CREATE INDEX IF NOT EXISTS idx_mahoti_laws_law_name_trgm
  ON public.mahoti_laws USING gin (law_name gin_trgm_ops);

-- Containment queries into the sections array — the generator pulling a
-- specific section, and coverage checks over which sections exist.
CREATE INDEX IF NOT EXISTS idx_mahoti_laws_sections_body
  ON public.mahoti_laws USING gin (sections_body jsonb_path_ops);

-- Freshness ordering for re-scrape decisions.
CREATE INDEX IF NOT EXISTS idx_mahoti_laws_date
  ON public.mahoti_laws (date DESC);

ALTER TABLE public.mahoti_laws ENABLE ROW LEVEL SECURITY;

-- Admin-only. No index is added for the policy predicate because is_admin()
-- reads profiles, not a column of this table (Hardening Rule 2 applies to
-- columns referenced in USING/CHECK; there are none here).
CREATE POLICY mahoti_laws_admins_select
  ON public.mahoti_laws FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY mahoti_laws_admins_insert
  ON public.mahoti_laws FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY mahoti_laws_admins_update
  ON public.mahoti_laws FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Table-level grants; RLS above does the row-level filtering on top.
GRANT SELECT, INSERT, UPDATE ON public.mahoti_laws TO authenticated;
