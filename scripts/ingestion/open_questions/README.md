# Open questions (מטלת כתיבה) — pipeline

Real exam PDF → verified JSON → LLM-generated practice questions → PDF.

The one rule this pipeline exists to enforce: **the law and verdict quotes are
never written by the model.** They are extracted once from the official PDF,
verified against it, and substituted back in by code. See "Quote locking" below.

## Layout

```
open_questions/
  exams/            1. source PDFs — the real Bar Association papers
    pages/             page images rendered for human verification
  sources/          2. JSON extracted from those PDFs (the quote bank lives here)
  generated/        3. new questions written by the LLM (.json + .pdf + .html)
    rejected/          generations that failed the quote lock, kept for diagnosis
  llm-params.json   tunable model + authoring settings
  verify_quotes.py  proves every quote matches the source PDF
  README.md
```

## The three steps

### 1. PDF → JSON

```bash
cd app/scripts/ingestion
python hebrew_pdf_to_json.py "open_questions/exams/<exam>.pdf" \
  --exam-id 2026-S-W \
  -o "open_questions/sources/2026-summer-part1.json" \
  --images "open_questions/exams/pages"
```

Handles the defects these PDFs always have: the letter `נ` mis-mapped to `ð`,
bidi control characters, and case numbers reversed by bidi. Everything it
produces is marked `needs_review` — the text extraction is trustworthy, the
segmentation into questions and quotes is a best-effort skeleton.

### 2. Verify the extraction

```bash
python open_questions/verify_quotes.py \
  open_questions/sources/2025-12-part1-writing.json \
  "open_questions/exams/<exam>.pdf"
```

Confirms every locked quote is byte-identical to the PDF. Do not generate from a
source file that has not passed this.

### 3. JSON → new questions → PDF

```bash
cd app/lawpass_server

# generate an angle (writes to generated/)
node scripts/generate-open-question.js \
  ../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json 2025-D-W-Q1 A

# render it as an exam-style paper
node scripts/render-open-question-pdf.js \
  ../scripts/ingestion/open_questions/generated/2025-D-W-Q1-A.generated.json \
  ../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json
```

Requires `ANTHROPIC_API_KEY` in `app/.env.local`.

## Quote locking

The model never receives permission to type a quote. It gets the quote bank
read-only and may reference sources only as placeholders:

| Placeholder | Renders as |
|---|---|
| `{{V1}}` | the citation |
| `{{V1.text}}` | the verbatim quoted text |

Substitution happens in `lib/ai/quote-bank.js` after the response returns. Three
gates run before anything is saved: every placeholder must resolve, no field may
reproduce 7+ consecutive words from a source, and no name from the source
question may reappear. A failure writes to `generated/rejected/` and stops.

`leak_shingle_size` in `llm-params.json` tightens the word threshold. The rules
themselves are intentionally not configurable — weakening them would break quote
fidelity silently rather than loudly.

## Tuning

Edit `llm-params.json`, then re-run. `authoring.extra_instructions` is the main
knob. CLI flags (`--effort=`, `--model=`, `--max-tokens=`, `--no-cache`) override
the file for one-off experiments.

Note: Claude Opus 5 has no `temperature` / `top_p` / `top_k` — those parameters
were removed from the model and sending them returns a 400. Vary output through
`effort` and the prompt instead.

## Status of generated questions

Everything the LLM produces is written with `status: "draft"` and
`parent_question_id` pointing at its source. Nothing reaches a student before a
human approves it.
