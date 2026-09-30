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
   `external_id`. Pass `--migration-version <YYYYMMDDhhmmss>` to also
   append a `supabase_migrations.schema_migrations` INSERT so
   `list_migrations` stays in sync.

   **Post-emit sanity check (load-bearing):** the generator counts the
   `INSERT INTO public.<table>` lines it just emitted and compares
   them against the expected count tallied from the normalized JSON.
   Tables checked: `source_questions`, `source_choices`,
   `angle_questions`, `angle_choices`. **Any mismatch aborts with a
   non-zero exit code BEFORE the apply step** — this is the safety
   net that catches the dropped-angles class of bug (where a wrong
   dict key silently zeroes a whole section's INSERTs). The original
   2024 winter substantive batch was missing this check; that's why
   152 angles + 608 angle_choices were dropped silently.

   **`--angles-only` mode:** emits ONLY the angle backfill (a SELECT
   on existing source by `external_id`, then SELECT-then-INSERT per
   angle with `(source_question_id, angle_letter)`-keyed idempotency,
   skipping choices when the angle is already present). Used when a
   prior partial run left sources in the DB but no angles, as
   happened for migration 20260526000002 (fixed by 20260526000003).
6. **Apply** — `node scripts/apply-sql.mjs <file.sql>`. The script
   prefers `DIRECT_URL` over `DATABASE_URL`; if direct connectivity is
   broken (DNS failure on `db.<ref>.supabase.co`), unset `DIRECT_URL`
   for the command and apply via the pooler:
       DIRECT_URL='' node scripts/apply-sql.mjs supabase/migrations/<file>.sql

## Converters — getting source material into JSON

Three siblings, one per kind of source. Each one's header says what it is for
and where it fails; this is only the map.

| script | source | runs | writes |
| --- | --- | --- | --- |
| `docx2json.mjs` | .docx, .doc, .rtf, .odt, .pptx, .xlsx | locally (`@firecrawl/anydoc`) | one JSON per document |
| `pdf2json.mjs` | a PDF **with a text layer** | locally (`@firecrawl/pdf-inspector`) | one JSON per **page** + `index.json` |
| `jpeg2json.mjs` | photographs and scans | uploads for OCR (Firecrawl or Claude) | one JSON per document |

Use the .docx whenever the same material exists in both forms — on this corpus
it reads at ~55% Hebrew against 0.9% from hosted OCR of a photograph of it.

`pdf2json.mjs` is the page-by-page one, for a long document that gets read and
corrected a page at a time:

```bash
# With no path: the booklet wired into the top of the script (TEST_PDF /
# TEST_OUT), so a test run is one flag.
node scripts/ingestion/pdf2json.mjs --pages=5

# Look first: type, page count, and whether the fonts are readable.
node scripts/ingestion/pdf2json.mjs book.pdf --inspect

# Test run — the first three pages only.
node scripts/ingestion/pdf2json.mjs book.pdf --out=json/ --pages=3

# A window further in, then the whole thing.
node scripts/ingestion/pdf2json.mjs book.pdf --out=json/ --from=40 --pages=10
node scripts/ingestion/pdf2json.mjs book.pdf --out=json/

# A SCANNED booklet: --ocr reads each scanned page (Claude by default).
node scripts/ingestion/pdf2json.mjs --pages=3 --ocr

# Check the result by eye: page-09.html, the scan beside what was read off it.
# Converts nothing and uploads nothing — it is built from the JSON already there.
node scripts/ingestion/pdf2json.mjs --only=9 --html
```

**Scans.** Without `--ocr` a page with no text layer is written `needs_ocr:
true` and empty — nothing is uploaded. With `--ocr` those pages, and only
those, are read one page per request, so the text lands in the right page's
JSON. Each page records which engine read it in `text_source`.

**Four engines, measured on `חוברת מיקוד בניסוח משפטי` (page 9 unless noted):**

| `--ocr=` | per page | Hebrew | Latin junk words | verdict |
| --- | --- | --- | --- | --- |
| `claude` (default) | 36s | 74.4% | 0 | use this |
| `firecrawl` | 4.3s | 71.2% | 29 distinct | 8× faster, not usable here |
| `hybrid` | 29–77s | 77.3% | 0 | same quality, measured **slower** |
| `mistral` | **blocked** | — | — | key works, OCR endpoint 429s |

> **Not yet measurable (2026-09-30).** The key authenticates — `GET /v1/models`
> returns 200 and lists `mistral-ocr-4-1`, `-4`, `-3`, `-2512` and
> `mistral-ocr-latest` — but every `POST /v1/ocr` comes back `429 Rate limit
> exceeded` (code 1300) in under half a second, unchanged after 30s and 60s
> waits and with no `retry-after` header. That is an entitlement gate, not
> throughput: the workspace needs activating/billing at console.mistral.ai
> before the comparison can run. The engine is written, the request shape is
> verified against the API's own validator, and it retries a 429 three times
> before reporting this.

`mistral` is shaped differently from the other three and is the one worth
trying next for speed. Its endpoint takes a **document** — up to 1000 pages —
and returns per-page markdown from a single request, so a batch is one round
trip rather than one per page, and `--concurrency` does not apply to it.
Published price is $4 per 1000 pages. The model defaults to `mistral-ocr-4-1`
— pinned rather than `mistral-ocr-latest` so a comparison says which model it
measured — and `--mistral-model=` takes any of the ids the API lists.

The API reference's `{type: "file", file_content}` document variant does **not**
work: the endpoint 422s naming `document_url` as the expected type. A base64 PDF
goes in `document_url` as a data URI, which is what this sends.

It sends a **sub-document** containing exactly the pages wanted, not the whole
booklet with a `pages` parameter: the API's docs say page numbers start at 0
while the example response shows `index: 1`, and mapping text onto the wrong
page is a silent error that surfaces much later. Copying the pages into a fresh
PDF makes position the mapping, and keeps a three-page test run to a three-page
upload.

Firecrawl Parse is an order of magnitude faster and wrong in ways that are easy
to miss: across an 8-page sample it returned nonsense for two pages (one was
invented Chinese arithmetic, one 12k characters of fabricated table), and on the
pages it did read it substituted Latin for Hebrew words (`ONN` for `אתם`, `Od`
for `גם`, `Pos` for `לטיעון`) and swapped final letters (`המסמכיס`). Claude got
all of those right. The page is sent to Claude as a PDF document block — no
rasterisation — so nothing is lost between the scan and the model.

`hybrid` was built to test the obvious idea: let Firecrawl do 80% of the work
cheaply, then have Claude fix it. It does work — it returns find/replace pairs
rather than a whole page, applies them first-match-only, and falls back to a
full re-read when the draft is fabricated rather than merely wrong. But it is
**slower**: 4 pages took 77s against 54s for plain Claude, because the saving was
supposed to come from output tokens and the real cost is the model reading the
whole scan to find the errors — which it must do either way, on top of a second
network round trip and a larger input. Keep it for reference; don't reach for it.

Transcription is not deterministic — the same page read twice differs by a word
or two. `--effort` (default `high`) is the knob: at `medium`, page 9 came back
with `טעונתיכם` for `טענותיכם` and `בודקת` for `מורה`; at `high` both were right
and the page took 38.2s against 36.9s. Reading this material less carefully buys
nothing, so `high` is the default. It still needs a human check — that is what
the `--html` sheets are for.

**Throughput is the lever, not the engine.** Per page Claude is 8× slower; per
document that mostly disappears, because each page is an independent request.
8 pages at `--concurrency=8` took **34s wall-clock — 4.3s per page**, which is
hosted OCR's latency at Claude's accuracy. 62 pages lands around 4½ minutes.
Lower the default only if you hit a 429.

Whichever engine runs, the text is stored as plain text: emphasis markup the
booklet is full of (`**bold**`, `<u>underline</u>`) is stripped, since it is
typography rather than content and only gets in the way of reading, diffing and
loading the JSON. Markdown headings, lists and tables are kept — those are
structure.

Every page's Hebrew share is still measured whichever engine ran, a page that
comes back barely Hebrew writes itself a warning, and `pages_to_review` in
`index.json` lists them. Redo exactly those with `--only=2,6 --ocr --force`. A
page that fails the same way twice is failing deterministically — retrying it is
not the fix.

A broken ToUnicode map cannot be repaired here either, but it is detected
(`encoding_warnings` in `index.json`) and points at `hebrew_pdf_to_json.py
--glyph-boxes`, which can.

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
