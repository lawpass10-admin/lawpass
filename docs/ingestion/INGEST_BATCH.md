# Ingest a content batch

> **To run an ingestion**: paste this file into a fresh Claude Code session
> and tell it the target, e.g. `ingest 2023 דין מהותי`. That single line is
> the only input needed. The session will derive everything else from the
> Drive folder path and the file names.

This document captures the **generic operating procedure** for ingesting an
exam batch from the LawPass Content Pipeline Drive folder into the LawPass
DB. It is the reusable form of what ran for the 2024 winter substantive
(`דין מהותי`) batch in Phase 3.

The pipeline scripts under [`scripts/ingestion/`](../../scripts/ingestion/)
do the mechanical work. This doc is the playbook that wraps them.

---

## 0. Inputs

The operator provides one thing: the **target**. A year + a track:

| Example | Year | Track |
|---|---|---|
| `2024 דין מהותי` | 2024 | substantive |
| `2023 דין דיוני` | 2023 | procedural |
| `2019 קיץ דין דיוני` | 2019 | procedural (summer) |

Everything else — the season, the exam_part, the external_id prefix, the
classification taxonomy — is **derived from the Drive folder path and the
file names**. The JSON inside each `.docx` is NEVER trusted for identity
(see §"Known systemic defects in Sharon's files" below).

---

## 1. Locate the Drive folder + download the `.docx` files

The folder structure on Drive is:

```
LawPass Content Pipeline
└── 02 - תוכן סופי למערכת
    └── <year>            ← e.g. 2024
        └── <track-name>  ← `דין מהותי` or `דין דיוני`
            ├── *_1-20*.docx
            ├── *_21-40*.docx
            └── …
```

The root folder ID is fixed for the project; descend with the Drive MCP
`search_files` tool, e.g.:

```text
search_files(query: "parentId = '<2024_folder_id>'")
```

For each `.docx` in the target folder:

- **Use `download_file_content` (raw bytes, base64).** NEVER use
  `read_file_content` — it markdown-escapes underscores and backticks
  inside the JSON, which corrupts the parse.
- Decode the base64 and save the bytes to
  `scripts/ingestion/tmp/<year>_<season>_<track>_q<range>.docx`. This
  directory is `.gitignore`d — per-batch artifacts are local-only; only
  the pipeline scripts + classification JSON + the migration are
  committed.

---

## 2. Derive exam identity from the path — never from the JSON

| Where | Derivation |
|---|---|
| `exam_year` | the `<year>` segment of the folder path |
| `track` | folder = `דין מהותי` → `substantive`; folder = `דין דיוני` → `procedural` |
| `exam_part` | substantive → **2** ; procedural → **1** (per the Phase 3 convention; if a future spec changes this, the operator overrides) |
| `exam_season` | filename contains "פברואר" (or "חורף") → **winter** ; "קיץ" → **summer** |
| `exam_question_number` | derived from the question's textual marker (`21.`, `22.`, …) inside the docx, validated against position-in-file |

Build the **external_id prefix** from the derived identity. The existing
convention in the DB:

- Procedural batches: `<year>-<season-letter>-Q<NN>` — e.g. `2024-W-Q21`, `2019-S-Q10`.
- Substantive batches: `<year>-<season-letter>-S-Q<NN>` — e.g. `2024-W-S-Q01`.
  (Substantive batches carry the `-S-` segment so the two tracks never collide
  on external_id even when they share year+season.)

`source_metadata` on every inserted question must be set to exactly:

```json
{
  "exam_year": <derived>,
  "exam_season": "<winter|summer>",
  "exam_part": <derived>,
  "exam_question_number": <1..N>
}
```

The JSON's own `source_metadata` is a stale Nevo template default
(historically 2019/summer). **Discard it. Overwrite.**

---

## 3. Parse the embedded ```json blocks

Run [`scripts/ingestion/parse_docx.py`](../../scripts/ingestion/parse_docx.py)
on each downloaded `.docx`:

```bash
python3 scripts/ingestion/parse_docx.py scripts/ingestion/tmp/<file>.docx \
  > scripts/ingestion/tmp/<file>_blocks.json
```

The parser handles the known docx quirks:

- Variable backtick fence counts (3–10 backticks).
- Marker (`21.`) merged with the fence opener (` ```json `) onto one
  paragraph by Word soft line breaks.
- Markdown-escaped underscores, periods, backticks (`\_`, `\.`, `` \` ``).
- Round-number markers that drop the trailing period (Word autoformat
  sometimes does this — `10` instead of `10.`).

Per-block output records the raw block, the cleaned block, and any
`json.loads` parse error. Genuinely unrecoverable blocks (e.g.
structurally broken JSON beyond automatic repair) are listed for
skipping in §6 — they never fail the whole run.

---

## 4. Mechanical fixes — normalize.py

Run [`scripts/ingestion/normalize.py`](../../scripts/ingestion/normalize.py)
on each blocks file, supplying the **derived identity**:

```bash
python3 scripts/ingestion/normalize.py \
  --blocks scripts/ingestion/tmp/<file>_blocks.json \
  --start-qnum <first-qnum-in-file> \
  --year <derived> --season <winter|summer> --part <derived> \
  --track <substantive|procedural> \
  --external-id-prefix <e.g. 2024-W-S> \
  --out scripts/ingestion/tmp/<file>_normalized.json
```

The normalizer applies these fixes and records counts:

1. **JSON repair** — Hebrew-letter-quote-Hebrew-letter sequences
   (`תשס"ו`, `ע"א`, `ב"כ`) get the embedded quote escaped to `\"`;
   literal newlines / tabs / CR inside JSON strings get escaped to
   `\n` / `\t` / `\r`.
2. **`external_id`**: `"PENDING"` → derived `<prefix>-Q<NN>`.
3. **`source_metadata`**: overwritten with the derived identity (see §2).
4. **`display_analysis`** → **`distractor_analysis`** key rename
   (recursive — fires on every choice in `source_choices` AND inside
   every angle's `angle_choices`).
5. **Marker-driven qnum assignment with consecutive-duplicate detection**
   — if two consecutive blocks share the same textual marker (Sharon's
   2024 winter Q23 fence appears twice), the second is dropped and
   recorded as a duplicate.

Output: `*_normalized.json` with per-batch fix totals + duplicate +
skipped lists, plus the list of parsed questions ready for
classification.

---

## 5. Re-classify every question against the live taxonomy

The JSON's `chapter` / `subtopic` fields are **placeholders** (Nevo
classified against an old/wrong taxonomy — typically procedural codes
even for substantive content). They MUST be re-mapped to the current
DB taxonomy.

**5a.** Query the live taxonomy for the derived track:

```sql
SELECT c.code AS chapter, c.title AS chapter_title,
       s.code AS subtopic, s.title AS subtopic_title, s.display_order
FROM public.chapters c
LEFT JOIN public.subtopics s ON s.chapter_id = c.id
WHERE c.track = '<derived-track>'
ORDER BY c.display_order, s.display_order;
```

**5b.** For each question, read its `question_text` + `review_note` +
`legal_topic_analysis` and decide the correct chapter + subtopic. The
JSON's own `review_note` (when present) usually states the real legal
subject area in Hebrew — use it as the strongest signal.

**5c.** Produce a **classification file** at
`scripts/ingestion/classifications/<batch>.json`:

```json
{
  "_about": "Per-question classification for the <batch> batch.",
  "_batch": { "exam_year": …, "exam_season": "…", "exam_part": …, "track": "…", "external_id_prefix": "…" },
  "_drops": [
    { "external_id": "<X>", "reason": "…" }
  ],
  "classifications": {
    "<external_id>": { "chapter": "<code>", "subtopic": "<code>", "needs_review": false, "note": "…" }
  }
}
```

Rules:

- **Every question** lands in a chapter that matches the derived track
  (`track='substantive'` for a substantive batch).
- If the subtopic is uncertain, pick the best fit AND set
  `needs_review: true` with a `note` explaining the gap. Phase 4
  showed that recurring `needs_review` patterns reveal real taxonomy
  gaps worth a follow-up taxonomy migration.
- **Drops** go in `_drops` with a free-text reason. Reasons that have
  appeared so far: exact-content duplicates between different question
  numbers; JSON-malformed blocks beyond repair.

---

## 6. Dedup

Three places duplicates / drops can sit:

| Type | Where caught | Mechanism |
|---|---|---|
| Consecutive-marker duplicate (same `21.` fence twice) | `normalize.py` | Marker-driven sequencing; second occurrence skipped |
| Exact-content duplicate (different qnum, identical question_text + choices) | classification `_drops` list | Manual entry after spotting via `question_text` hash |
| External_id already exists in the DB | the migration's per-question `DO $$` block | `SELECT id INTO v_existing_id ... IF NOT NULL THEN RETURN` |

A re-run of a batch MUST be a no-op. Confirm by applying the migration
twice and verifying counts don't change.

---

## 7. Generate one additive migration

Pick the next available migration timestamp:

```bash
ls supabase/migrations/ | tail -3   # find the latest, +1 the date
```

Generate:

```bash
python3 scripts/ingestion/generate_migration.py \
  --normalized scripts/ingestion/tmp/<file1>_normalized.json \
               scripts/ingestion/tmp/<file2>_normalized.json \
  --classifications scripts/ingestion/classifications/<batch>.json \
  --migration-name add_<year>_<season>_<track>_q<lo>_to_q<hi> \
  --migration-version <YYYYMMDD000NNN> \
  --out supabase/migrations/<YYYYMMDD000NNN>_add_<year>_<season>_<track>_q<lo>_to_q<hi>.sql
```

The generator emits one `DO $$ ... END$$;` block per question, with:

- `source_questions` INSERT + 4 `source_choices` INSERTs (per source).
- One `angle_questions` INSERT + 4 `angle_choices` INSERTs **per angle**.
- Idempotent early-return on existing `external_id`.
- An `INSERT INTO supabase_migrations.schema_migrations (version, name)
  ON CONFLICT DO NOTHING` at the bottom (because `--migration-version`
  was passed) so the registry stays in sync with the filename.

### CRITICAL — the post-emit sanity check

The generator **counts the `INSERT INTO public.<table>` statements it
just emitted** and compares them against expected counts tallied from
the normalized JSON (`source_questions`, `source_choices`,
`angle_questions`, `angle_choices`). **Any mismatch aborts the generator
with exit code 2 before you can apply.** This is the safety net that
catches the dropped-section class of bug (see "Never trust a 0" rule
below). Look for this output:

```text
INSERT counts (emitted vs expected from JSON):
  source_questions : N/N
  source_choices   : N*4/N*4
  angle_questions  : N*4/N*4
  angle_choices    : N*16/N*16
```

If any line shows `emitted/expected` with different numbers, **stop**
and diagnose before applying. The 2024-W-S batch dropped 152 angles
because nobody checked this until after merge — the check exists to
prevent a repeat.

### Editorial validation

The generator also drops angles whose `angle_choices` don't have
exactly one `is_correct=true` (matches the DB's partial unique index
`idx_angle_ch_one_correct`). Skipped angles appear in the
`SKIPPED ANGLES` summary — surface them in the operator report so
Sharon can fix the source.

---

## 8. Apply + verify

```bash
node scripts/apply-sql.mjs supabase/migrations/<timestamp>_<name>.sql
```

The script probes `DIRECT_URL` and auto-falls-back to `DATABASE_URL`
on `ENOTFOUND` (Supabase routinely makes `db.<ref>.supabase.co`
unreachable on some projects). Force the pooler with `DIRECT_URL=''`
if needed.

For files over 30 KB, prefer `apply-sql.mjs` over the Supabase MCP
`apply_migration` tool (which has a size limit and would fail).

**Then run the verification SQL:**

```sql
-- Aggregate counts
SELECT
  (SELECT count(*) FROM source_questions) AS sq_total,
  (SELECT count(*) FROM source_questions WHERE external_id LIKE '<batch-prefix>%') AS sq_new,
  (SELECT count(*) FROM source_choices sc JOIN source_questions sq ON sq.id=sc.source_question_id WHERE sq.external_id LIKE '<batch-prefix>%') AS sc_new,
  (SELECT count(*) FROM angle_questions aq JOIN source_questions sq ON sq.id=aq.source_question_id WHERE sq.external_id LIKE '<batch-prefix>%') AS aq_new,
  (SELECT count(*) FROM angle_choices ac JOIN angle_questions aq ON aq.id=ac.angle_question_id JOIN source_questions sq ON sq.id=aq.source_question_id WHERE sq.external_id LIKE '<batch-prefix>%') AS ac_new,
  (SELECT count(*) FROM source_questions sq LEFT JOIN chapters c ON c.id=sq.chapter_id WHERE c.id IS NULL) AS orphan_chapters,
  (SELECT count(*) FROM source_questions sq LEFT JOIN subtopics s ON s.id=sq.subtopic_id WHERE s.id IS NULL) AS orphan_subtopics;

-- Invariants: the other track + all prior content UNCHANGED
SELECT count(*) FROM source_questions sq
JOIN chapters c ON c.id=sq.chapter_id
WHERE c.track = '<the-OTHER-track>';   -- must be unchanged from pre-flight

-- Per-source angle count — every source should have 4 (except known skips)
SELECT sq.external_id, count(aq.id)
FROM source_questions sq LEFT JOIN angle_questions aq ON aq.source_question_id=sq.id
WHERE sq.external_id LIKE '<batch-prefix>%'
GROUP BY sq.external_id HAVING count(aq.id) <> 4;
```

Then **re-apply the migration once more** and confirm the counts don't
change — that's the proof of idempotency.

---

## 9. Commit, push, report (DO NOT MERGE)

Create a batch branch:

```bash
git checkout -b content-<year>-<track>
```

Commit:

```text
content: <year> <season> <track> batch (Q<lo>-Q<hi>, N questions)

…concise summary of:
- files read, blocks dropped/skipped
- derived identity that overrode the JSON
- mechanical fix counts
- classification distribution + needs_review count
- dedup events
- verification counts
```

Add to the commit:

- The new `supabase/migrations/<timestamp>_<name>.sql`.
- The new `scripts/ingestion/classifications/<batch>.json`.
- Do NOT commit the `scripts/ingestion/tmp/*` artifacts (gitignored).

```bash
git push -u origin content-<year>-<track>
```

**Print a final report** including the full classification table
(external_id → chapter/subtopic + needs_review). **Do NOT merge to
main** — the operator reviews the report and decides when to merge.

---

## Hard rules

1. **ADDITIVE only.** Never UPDATE, DELETE, rename, or reorder any
   existing row in `chapters`, `subtopics`, `source_questions`,
   `source_choices`, `angle_questions`, `angle_choices`. The ONLY
   acceptable UPDATEs are explicit fix migrations like Phase 4
   (`taxonomy_fix_torts_and_gaps`).
2. **Folder path = source of truth** for track + exam identity. The
   JSON's `source_metadata` / `chapter` / `subtopic` are placeholders
   — discard them.
3. **Idempotent.** Re-running a batch (re-parse, re-generate, re-apply)
   must be a no-op. Verify by applying twice.
4. **Never trust a `0` count.** Cross-check against the source JSON
   before reporting done. The 2024-W-S batch silently dropped 152
   angle_questions + 608 angle_choices because the verification queries
   reported `angles_new: 0` and that was mis-read as "no angles in the
   source" instead of "the generator's outer key was wrong." The
   generator's post-emit sanity check exists to make this impossible to
   repeat; the operator still owes a final cross-check.
5. **No app/feature code changes in an ingestion run.** This rules
   out: edits under `app/`, `components/`, `lib/` (except the
   non-load-bearing `scripts/ingestion/*` pipeline scripts themselves),
   `tests/` — anything outside `supabase/migrations/`,
   `scripts/ingestion/classifications/`, and `docs/`. Pipeline bugs
   (like the dropped-angles bug) get their own dedicated fix branch,
   not a piggyback inside an ingestion commit.

---

## Known systemic defects in Sharon's files

Every batch ingested so far has carried the same set of source-quality
issues. The normalize + generate steps handle them automatically — but
the operator should be aware so the fix counts in the report aren't
surprising.

| Defect | Where | Fix |
|---|---|---|
| `external_id: "PENDING"` on every question | top-level | normalize.py rewrites to the derived `<prefix>-Q<NN>` |
| Stale `source_metadata` (`exam_year: 2019, exam_season: "summer"`) | top-level | normalize.py overwrites from derived identity |
| `chapter` / `subtopic` are procedural placeholders | top-level | classification step ignores them and re-maps from question content |
| Unescaped Hebrew abbreviations: `תשס"ו`, `ע"א`, `ב"כ` etc. inside JSON strings | references_list, full_explanation, etc. | normalize.py regex: `Heb"Heb` → `Heb\"Heb` |
| Literal newlines / tabs inside JSON strings | full_explanation, legal_topic_analysis (Word soft-wrapped paragraphs) | normalize.py state-machine escapes to `\n` / `\t` inside strings |
| Key typo: `display_analysis` instead of `distractor_analysis` | per-choice objects, both source and angle | normalize.py recursive rename |
| Consecutive-marker duplicate (Q23 appears as two fences in a row) | between question blocks | normalize.py marker-driven sequencing |
| Content-level duplicate (Q18 and Q20 have identical question_text + choices) | between question blocks | classification `_drops` list, after spotting via hash |
| Multiple `is_correct: true` per angle (Sharon's Q32 had 2 and 3) | angle_choices | generator validation skips the angle + records it in SKIPPED ANGLES |
| Genuinely unrepairable JSON (missing `"`, dangling brackets) | rare | parse_docx + normalize record the block, classification skips it |
| Angle objects use `display_order: null` | angle_choices | generator derives from 1-based position when missing |
| File-name "חלק ג'" disagrees with file-internal header "חלק ב'" | filename vs page-1 text | operator follows the explicit `exam_part = 2` derivation rule; the disagreement is just a Sharon labeling quirk |

If a new systemic defect is discovered, **don't paper over it in the
classification JSON** — fix it in `normalize.py` (or
`generate_migration.py`'s sanity check) so the same defect can't slip
past a future ingestion. Then add a row to this table.

---

## Reference: pipeline file map

| Path | Role |
|---|---|
| [`scripts/ingestion/parse_docx.py`](../../scripts/ingestion/parse_docx.py) | docx → `*_blocks.json` |
| [`scripts/ingestion/normalize.py`](../../scripts/ingestion/normalize.py) | blocks → normalized + fixes applied |
| [`scripts/ingestion/generate_migration.py`](../../scripts/ingestion/generate_migration.py) | normalized + classification → `.sql` (with post-emit sanity check) |
| [`scripts/ingestion/classifications/`](../../scripts/ingestion/classifications/) | per-batch classification JSON (committed) |
| [`scripts/ingestion/tmp/`](../../scripts/ingestion/) | per-batch working dir (gitignored) |
| [`scripts/apply-sql.mjs`](../../scripts/apply-sql.mjs) | apply a `.sql` file via DIRECT_URL with auto pooler fallback |
| [`scripts/ingestion/README.md`](../../scripts/ingestion/README.md) | per-stage CLI examples; a worked example for the 2024 winter substantive batch |
