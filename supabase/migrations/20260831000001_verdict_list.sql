-- verdict_list — scraped court judgments, one row per judgment, enriched with
-- the legal-area classification the enrichment pass adds.
--
-- Source: judgments_scraper/out/enriched.json. One JSON object per judgment;
-- this table is that object, typed. The scraper is an outside pipeline, so the
-- shape here follows ITS field names rather than renaming them to house style —
-- someone comparing the file to the table should not have to hold a mapping in
-- their head. Two exceptions, both because the original name is a Postgres type
-- and says nothing about which value it holds:
--
--     JSON `text`  ->  full_text
--     JSON `date`  ->  decided_on
--
-- Columns (all from the JSON unless marked):
--   * verdict_id      uuid PK. Ours, not the source's — see post_id.
--   * url             The canonical address on judgments.org.il. UNIQUE, and
--                     the key the loader upserts on: it is the one field the
--                     source guarantees, and re-scraping the same judgment must
--                     refresh a row rather than add a second one.
--   * post_id         The source CMS id. NULLABLE — the sample already has a
--                     judgment without one, so it cannot be the key — but
--                     UNIQUE where present, since two rows sharing one would
--                     mean the scrape merged two judgments.
--   * title           Case caption: "תק (תל אביב) 78546-08-25 – פלוני נ' אלמוני".
--   * decided_on      The judgment's date. DATE, not the source's "29.08.2026"
--                     string — a text date sorts lexicographically, which puts
--                     the 2nd of January before the 1st of February. The loader
--                     parses DD.MM.YYYY; a row whose date will not parse is
--                     stored NULL rather than dropped, because the judgment is
--                     still worth having.
--   * court           Full court name, as written on the judgment.
--   * doc_type        "פסק דין" / "החלטה". Deliberately NOT a CHECK: the
--                     vocabulary belongs to the source, and a constraint here
--                     would fail the next load over a document type nobody
--                     anticipated rather than telling us about it.
--   * case_number     "78546-08-25". NOT unique: the same number recurs across
--                     courts and years, and only (court, case_number, date)
--                     comes close to identifying a case. Indexed for lookup.
--   * category        The source's own docket category, e.g. 'תק - תביעה קטנה'.
--   * judge           Presiding judge, with title.
--   * full_text       The judgment in full. The reason the table exists.
--                     Converted to jsonb by 20260831000002 — see that file.
--   * text_chars      GENERATED from full_text. The JSON carries this and it
--                     matched char_length on every sampled record, so the
--                     database derives it instead of storing a second copy that
--                     could drift from the text it describes.
--
--   Enrichment (the classifier's output, not the court's):
--   * judgment_topic              One-sentence summary of what the case is about.
--   * judgment_area               'דיני מזון וכשרות'
--   * judgment_area_id            'food_kashrut' — the stable slug. Filter on
--                                 this, not on the Hebrew label, which is
--                                 display text and can be reworded.
--   * judgment_area_category      'רגולציה וענפים ייעודיים'
--   * judgment_area_category_id   'regulation_sectors'
--   * judgment_area_confidence    low | medium | high. CHECKed, because unlike
--                                 doc_type this vocabulary is OURS — the
--                                 classifier emits exactly these three, and a
--                                 fourth value would be a bug to catch at the
--                                 door.
--   * judgment_area_matched       The terms that drove the classification.
--                                 text[], so "which judgments matched 'כשרות'"
--                                 is an indexed containment query rather than a
--                                 LIKE over JSON.
--   * judgment_area_alternatives  Runner-up areas the classifier considered.
--                                 Kept because a `low` confidence row is only
--                                 reviewable if you can see what it nearly said.
--
--   * scraped_at      When this row was loaded/refreshed. Ours.
--   * created_at      When it first arrived. Ours.
--
-- Hebrew text columns carry COLLATE hebrew (Hardening Rule #4) so ORDER BY
-- title/court/judge sorts the way a Hebrew reader expects. full_text does not:
-- nobody sorts by the body of a judgment, and the collation would be paid for
-- on every write for nothing.

CREATE TABLE IF NOT EXISTS public.verdict_list (
  verdict_id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity, from the source
  url                         text        NOT NULL UNIQUE,
  post_id                     bigint      NULL,

  -- The judgment as published
  title                       text        NOT NULL COLLATE hebrew,
  decided_on                  date        NULL,
  court                       text        NULL COLLATE hebrew,
  doc_type                    text        NULL COLLATE hebrew,
  case_number                 text        NULL,
  category                    text        NULL COLLATE hebrew,
  judge                       text        NULL COLLATE hebrew,
  full_text                   text        NOT NULL,
  text_chars                  integer     GENERATED ALWAYS AS (char_length(full_text)) STORED,

  -- The enrichment pass
  judgment_topic              text        NULL COLLATE hebrew,
  judgment_area               text        NULL COLLATE hebrew,
  judgment_area_id            text        NULL,
  judgment_area_category      text        NULL COLLATE hebrew,
  judgment_area_category_id   text        NULL,
  judgment_area_confidence    text        NULL,
  judgment_area_matched       text[]      NOT NULL DEFAULT '{}',
  judgment_area_alternatives  text[]      NOT NULL DEFAULT '{}',

  scraped_at                  timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT verdict_list_confidence_check
    CHECK (judgment_area_confidence IS NULL
           OR judgment_area_confidence IN ('low', 'medium', 'high'))
);

-- Unique only where present: see the post_id note above.
CREATE UNIQUE INDEX IF NOT EXISTS idx_verdict_list_post_id
  ON public.verdict_list (post_id) WHERE post_id IS NOT NULL;

-- The listing order: newest judgments first. NULLS LAST so unparsed dates sink
-- to the bottom instead of heading the list.
CREATE INDEX IF NOT EXISTS idx_verdict_list_decided_on
  ON public.verdict_list (decided_on DESC NULLS LAST);

-- "Everything in banking law, newest first" — the query the area slugs exist
-- for. Composite rather than two indexes: the filter and the sort travel
-- together every time.
CREATE INDEX IF NOT EXISTS idx_verdict_list_area
  ON public.verdict_list (judgment_area_id, decided_on DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_verdict_list_area_category
  ON public.verdict_list (judgment_area_category_id, decided_on DESC NULLS LAST);

-- Finding a judgment someone quotes at you by its docket number.
CREATE INDEX IF NOT EXISTS idx_verdict_list_case_number
  ON public.verdict_list (case_number);

-- "Which judgments matched 'כשרות'" — array containment, e.g.
--   WHERE judgment_area_matched @> ARRAY['כשרות']
CREATE INDEX IF NOT EXISTS idx_verdict_list_matched
  ON public.verdict_list USING gin (judgment_area_matched);

-- Full-text search over the parts a person searches by.
--
-- Config 'simple' rather than a language config on purpose: Postgres ships no
-- Hebrew stemmer, and asking for one would either error or silently apply
-- English rules to Hebrew. 'simple' lower-cases and splits on word boundaries,
-- which is the honest ceiling here — it finds whole words, not inflections.
-- The literal config name is what makes the expression IMMUTABLE and therefore
-- legal in a generated column.
--
-- The body is IN the vector: judgments are searched for a phrase buried in the
-- text far more often than by their caption. That makes the index large — it is
-- the price of the table being useful, and it is THIS index, not the jsonb
-- column, that makes "search inside the judgment" work.
--
-- `->>` is immutable, so extracting the body here is legal in a generated
-- column. When sections arrive, widen the expression to fold them in — e.g.
-- `jsonb_path_query_array(full_text, '$.sections[*].text')` flattened — and the
-- index follows automatically.
ALTER TABLE public.verdict_list
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(judgment_topic, '') || ' ' ||
      coalesce(case_number, '') || ' ' ||
      coalesce(full_text, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_verdict_list_search
  ON public.verdict_list USING gin (search_tsv);


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Fails closed, matching mahoti_laws, mahoti_questions and open_questions at
-- the same stage: this is authoring-side content with no student-facing screen
-- yet. The scraper and any loader run under the service role, which bypasses
-- RLS, so ingestion is unaffected.
--
-- WHEN A STUDENT SCREEN SHIPS, add a SELECT policy here rather than reading the
-- table through the service role from app code — the same follow-up
-- 20260817000001 made for open_questions:
--
--   CREATE POLICY verdict_list_students_select
--     ON public.verdict_list FOR SELECT TO authenticated
--     USING (public.has_active_subscription());

ALTER TABLE public.verdict_list ENABLE ROW LEVEL SECURITY;

-- DROP first so re-applying this file is safe: CREATE POLICY has no
-- IF NOT EXISTS, and this migration was revised after its first version
-- (full_text text -> jsonb).
DROP POLICY IF EXISTS verdict_list_admins_select ON public.verdict_list;
DROP POLICY IF EXISTS verdict_list_admins_insert ON public.verdict_list;
DROP POLICY IF EXISTS verdict_list_admins_update ON public.verdict_list;

CREATE POLICY verdict_list_admins_select
  ON public.verdict_list FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY verdict_list_admins_insert
  ON public.verdict_list FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY verdict_list_admins_update
  ON public.verdict_list FOR UPDATE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.verdict_list TO authenticated;

COMMENT ON TABLE public.verdict_list
  IS 'Scraped court judgments with their legal-area classification. Loaded from judgments_scraper/out/enriched.json; url is the upsert key.';
