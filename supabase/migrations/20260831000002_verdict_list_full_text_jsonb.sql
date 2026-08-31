-- verdict_list.full_text — text -> jsonb, shaped { "body": … }.
--
-- 20260831000001 shipped this column as plain text and was applied with rows in
-- it. That migration is a record of what ran and is left alone; the change lives
-- here, as an ALTER over existing data.
--
-- WHY. Not for search — jsonb does not improve finding a phrase inside a
-- judgment, and it is idx_verdict_list_search (the GIN full-text index from the
-- first migration) that does that, on text just as well. The reason is room to
-- SEGMENT a judgment later without another migration:
--
--     { "body": "…",
--       "sections": [ { "heading": "העובדות", "text": "…" }, … ] }
--
-- so "search only inside the ruling" becomes possible once something can produce
-- the parts. Until then every reader goes through `full_text->>'body'`.
--
-- NOT DATA-LOSING. to_jsonb(full_text) wraps each existing judgment as a JSON
-- string and the object is built around it, so the body survives byte-for-byte.
-- Reversing it is `USING full_text->>'body'`, which returns exactly what went
-- in — that round trip is what makes this safe to run on live rows.
--
-- The two generated columns are dropped and rebuilt: a generated column cannot
-- be altered in place, and both read the column whose type is changing.
-- Rebuilding them recomputes from the same source, so no value changes.

-- Idempotent: does nothing on a database where full_text is already jsonb.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'verdict_list'
         AND column_name = 'full_text') = 'text'
  THEN
    -- Generated columns first — they depend on full_text's type.
    ALTER TABLE public.verdict_list DROP COLUMN IF EXISTS text_chars;
    ALTER TABLE public.verdict_list DROP COLUMN IF EXISTS search_tsv;

    ALTER TABLE public.verdict_list
      ALTER COLUMN full_text TYPE jsonb
      USING jsonb_build_object('body', full_text);

    -- Rebuilt against the body, unchanged in meaning.
    ALTER TABLE public.verdict_list
      ADD COLUMN text_chars integer
      GENERATED ALWAYS AS (char_length(full_text->>'body')) STORED;

    ALTER TABLE public.verdict_list
      ADD COLUMN search_tsv tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple',
          coalesce(title, '') || ' ' ||
          coalesce(judgment_topic, '') || ' ' ||
          coalesce(case_number, '') || ' ' ||
          coalesce(full_text->>'body', '')
        )
      ) STORED;

    CREATE INDEX IF NOT EXISTS idx_verdict_list_search
      ON public.verdict_list USING gin (search_tsv);
  END IF;
END
$$;

-- The one guarantee the container has to give. Two generated columns and every
-- reader dereference `full_text->>'body'`; a row that arrived as a bare string,
-- an array, or an object without that key would silently produce a NULL
-- text_chars and an empty search vector — a judgment that is in the table and
-- cannot be found. Rejected at the door instead.
ALTER TABLE public.verdict_list
  DROP CONSTRAINT IF EXISTS verdict_list_full_text_shape_check;
ALTER TABLE public.verdict_list
  ADD CONSTRAINT verdict_list_full_text_shape_check
  CHECK (jsonb_typeof(full_text->'body') = 'string');

-- Structural queries against the container itself — "which judgments have been
-- segmented", "which have a section headed X". jsonb_path_ops rather than the
-- default: it indexes only containment (@>), the only jsonb operator anything
-- here will use, and costs a fraction of the size. Useless for finding words
-- inside the body; that is idx_verdict_list_search's job.
CREATE INDEX IF NOT EXISTS idx_verdict_list_full_text_shape
  ON public.verdict_list USING gin (full_text jsonb_path_ops);

COMMENT ON COLUMN public.verdict_list.full_text
  IS 'jsonb { body: "…" }, with room for a future "sections" array. Read via full_text->>''body''.';
