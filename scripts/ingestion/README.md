# scripts/ingestion/

Reusable content-ingestion pipeline for LawPass exam questions. Replaces the
ad-hoc `/tmp/*` scripts used for the 2019 summer / 2024 winter procedural
batches.

## Pipeline stages

1. **Download** — fetch the source `.docx` files from the Drive folder
   `LawPass Content Pipeline / 02 - תוכן סופי למערכת / <year> / <track>`
   using the Drive MCP `download_file_content` tool (raw bytes — NOT
   `read_file_content`, which markdown-escapes and corrupts the JSON).
   Save into `scripts/ingestion/tmp/` (gitignored).
2. **`parse_docx.py`** — extract every ```json fenced block from a docx.
   Tolerates variable backtick counts, period-less round-number markers
   (`10` vs `10.`), and merged marker+fence lines. Output: one JSON
   array per file in `tmp/`.
3. **`normalize.py`** — for each parsed file:
   - Hebrew-abbreviation `"` escape (תשס"ו, ע"א, ב"כ, ...).
   - Literal control-char escape inside JSON strings.
   - `display_analysis` → `distractor_analysis` typo rename.
   - `external_id: "PENDING"` → derived ID `<prefix>-Q<NN>`.
   - `source_metadata` overwrite from --year/--season/--part (the JSON's
     stale 2019/summer template default is always wrong — track + exam
     identity comes from the FOLDER PATH, never the JSON).
   - Marker-driven qnum assignment with consecutive-duplicate detection
     (the Sharon docx for 2024 winter substantive 21-40 has Q23 twice).
4. **Classify** — per-batch classification file at
   `scripts/ingestion/classifications/<batch>.json`. Each entry maps an
   `external_id` to a `(chapter, subtopic, needs_review, note)`. The
   classification is BATCH-SPECIFIC and not automated: a human (or
   model) reads each question and picks the best substantive (or
   procedural) home. The JSON's own `chapter`/`subtopic` is IGNORED —
   it's a stale procedural placeholder.
5. **`generate_migration.py`** — emit one SQL file under
   `supabase/migrations/<timestamp>_<name>.sql`. Each question gets a
   `DO $$ ... END$$;` block with idempotent early-return on existing
   `external_id`. Appends a `supabase_migrations.schema_migrations`
   INSERT at the bottom so the registry stays in sync.
6. **Apply** — `node scripts/apply-sql.mjs <file.sql>`. The script
   prefers `DIRECT_URL` over `DATABASE_URL`; if direct connectivity is
   broken (DNS failure on `db.<ref>.supabase.co`), unset `DIRECT_URL`
   for the command and apply via the pooler:
       DIRECT_URL='' node scripts/apply-sql.mjs supabase/migrations/<file>.sql

## Per-batch example (2024 winter substantive)

```bash
# 1. Download both .docx via Drive MCP, save to tmp/  (see Phase 3 commit)
# 2. Parse
python3 scripts/ingestion/parse_docx.py \
  scripts/ingestion/tmp/2024_winter_substantive_q1_to_q20.docx \
  > scripts/ingestion/tmp/q1_20_blocks.json
python3 scripts/ingestion/parse_docx.py \
  scripts/ingestion/tmp/2024_winter_substantive_q21_to_q40.docx \
  > scripts/ingestion/tmp/q21_40_blocks.json

# 3. Normalize  (note the exam identity is DERIVED — not from the JSON)
python3 scripts/ingestion/normalize.py \
  --blocks scripts/ingestion/tmp/q1_20_blocks.json \
  --start-qnum 1 --year 2024 --season winter --part 2 --track substantive \
  --external-id-prefix 2024-W-S \
  --out scripts/ingestion/tmp/q1_20_normalized.json
python3 scripts/ingestion/normalize.py \
  --blocks scripts/ingestion/tmp/q21_40_blocks.json \
  --start-qnum 21 --year 2024 --season winter --part 2 --track substantive \
  --external-id-prefix 2024-W-S \
  --out scripts/ingestion/tmp/q21_40_normalized.json

# 4. (Manual) Author scripts/ingestion/classifications/2024_winter_substantive.json
#    — one entry per external_id with chapter / subtopic / needs_review / note.

# 5. Generate migration
python3 scripts/ingestion/generate_migration.py \
  --normalized scripts/ingestion/tmp/q1_20_normalized.json \
               scripts/ingestion/tmp/q21_40_normalized.json \
  --classifications scripts/ingestion/classifications/2024_winter_substantive.json \
  --created-by b9ecdde2-d07e-4761-96ab-05f0ad32d4e3 \
  --migration-name add_2024_winter_substantive_q1_to_q28 \
  --out supabase/migrations/20260526000002_add_2024_winter_substantive_q1_to_q28.sql

# 6. Apply
DIRECT_URL='' node scripts/apply-sql.mjs \
  supabase/migrations/20260526000002_add_2024_winter_substantive_q1_to_q28.sql
```
