"use strict";

// CLI: write a model answer for a generated open question.
//
//   node scripts/generate-open-answer.js <generated-question.json> <source-questions.json> [--effort=...]
//
// Example:
//   node scripts/generate-open-answer.js \
//     ../scripts/ingestion/open_questions/generated/2025-D-W-Q1-A.generated.json \
//     ../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json
//
// Exemplar answers and the rubric are picked up automatically from
// <workspace>/answers/. Output is ONE merged file in <workspace>/generated/:
// the question and its answer together.

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const SERVER_ROOT = path.resolve(__dirname, "..");
const envFile = [
  process.env.LAWPASS_ENV_PATH ? path.resolve(process.env.LAWPASS_ENV_PATH) : null,
  path.resolve(SERVER_ROOT, "..", ".env.local"),
  path.resolve(SERVER_ROOT, "..", ".env"),
  path.join(SERVER_ROOT, ".env"),
]
  .filter(Boolean)
  .find((p) => fs.existsSync(p));
if (envFile) dotenv.config({ path: envFile });

const { buildBank } = require("../lib/ai/quote-bank");
const { generateAnswer } = require("../lib/ai/generate-open-answer");

const PARAMS_FILE = "llm-params.json";

function findWorkspaceRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, PARAMS_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

/** Flatten a hebrew_pdf_to_json.py output back into plain text. */
function pagesToText(doc) {
  return (doc.pages || []).map((p) => p.text).join("\n\n");
}

/**
 * Pick up the rubric and the exemplar answers from <workspace>/answers/.
 * The rubric is whichever file is named like a template/מחוון; everything else
 * that converted cleanly is treated as an exemplar.
 */
function loadAnswerAssets(root) {
  const dir = path.join(root, "answers");
  if (!fs.existsSync(dir)) {
    throw new Error(
      `no answers/ folder at ${dir} — it must hold the rubric and the exemplar answers ` +
        `(produced by scripts/ingestion/hebrew_pdf_to_json.py)`
    );
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let rubricText = "";
  const exemplars = [];

  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const text = pagesToText(doc);
    if (/tamplete|template|rubric|מחוון/i.test(f)) {
      rubricText = text;
    } else {
      exemplars.push({ name: f, text });
    }
  }

  if (!rubricText) throw new Error(`no rubric JSON found in ${dir}`);
  if (!exemplars.length) throw new Error(`no exemplar answer JSON found in ${dir}`);

  return { rubricText, exemplars, dir };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const [questionPath, sourcePath] = args.filter((a) => !a.startsWith("--"));

  if (!questionPath || !sourcePath) {
    console.error(
      "usage: node scripts/generate-open-answer.js <generated-question.json> <source-questions.json>\n" +
        "       [--effort=...] [--model=...] [--max-tokens=N] [--no-cache]"
    );
    process.exit(2);
  }

  const flag = (name) =>
    flags.find((f) => f.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

  const root = findWorkspaceRoot(path.dirname(path.resolve(questionPath)));
  const generatedDir = path.join(root, "generated");
  const rejectedDir = path.join(generatedDir, "rejected");

  const paramsPath = path.join(root, PARAMS_FILE);
  const params = fs.existsSync(paramsPath)
    ? JSON.parse(fs.readFileSync(paramsPath, "utf8"))
    : {};
  params.model = params.model || {};
  if (flag("effort")) params.model.effort = flag("effort");
  if (flag("model")) params.model.id = flag("model");
  if (flag("max-tokens")) params.model.max_tokens = Number(flag("max-tokens"));
  if (flags.includes("--no-cache")) {
    params.generation = { ...(params.generation || {}), prompt_cache: false };
  }

  const payload = JSON.parse(fs.readFileSync(questionPath, "utf8"));
  const question = payload.questions?.[0] || payload.generated;
  if (!question) throw new Error(`no question found in ${questionPath}`);

  const sourceId =
    payload.generated_from?.source_external_id ||
    question.parent_question_id ||
    payload.source_external_id;

  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const bank = buildBank(sourceData.quotes, sourceId);
  const forbiddenTerms = (params.forbidden_terms || {})[sourceId] || [];

  const { rubricText, exemplars, dir } = loadAnswerAssets(root);

  console.log(`question : ${question.external_id || sourceId} — ${question.angle_title || ""}`);
  console.log(`quotes   : ${bank.map((q) => q.id).join(", ")} (locked, from ${sourceId})`);
  console.log(`rubric   : ${rubricText.length} chars`);
  console.log(`exemplars: ${exemplars.map((e) => e.name).join(", ")}`);
  console.log(`from     : ${dir}`);
  console.log(`\nwriting the answer — this can take a few minutes...\n`);

  const started = Date.now();
  const result = await generateAnswer({
    question,
    bank,
    rubricText,
    exemplars,
    forbiddenTerms,
    params,
  });
  const seconds = Math.round((Date.now() - started) / 1000);

  const u = result.usage || {};
  console.log(
    `done in ${seconds}s — in ${u.input_tokens ?? "?"} | ` +
      `cache write ${u.cache_creation_input_tokens ?? 0} | ` +
      `cache read ${u.cache_read_input_tokens ?? 0} | ` +
      `out ${u.output_tokens ?? "?"} tokens\n`
  );

  const base = `${question.external_id || sourceId}`;

  if (!result.validation.ok) {
    fs.mkdirSync(rejectedDir, { recursive: true });
    const rejectedPath = path.join(rejectedDir, `${base}.answer.rejected.json`);
    fs.writeFileSync(
      rejectedPath,
      JSON.stringify(
        { rejected_at: new Date().toISOString(), ...result.meta, usage: u,
          errors: result.validation.errors, generated: result.generated },
        null, 2
      ) + "\n",
      "utf8"
    );
    console.error("VALIDATION FAILED — not promoted to a draft:\n");
    for (const e of result.validation.errors) console.error(`  [${e.type}] ${e.detail}`);
    console.error(`\noutput saved for inspection: ${rejectedPath}`);
    process.exit(1);
  }

  console.log("quote lock: OK — no source text reproduced, no foreign authorities cited\n");

  // One merged file: the question and its answer together.
  const merged = {
    generated_from: {
      ...(payload.generated_from || {}),
      answer: { ...result.meta, generated_at: new Date().toISOString() },
      rubric_source: "answers/",
      exemplars: exemplars.map((e) => e.name),
    },
    questions: [question],
    answers: [
      {
        external_id: `${base}-ANS`,
        question_external_id: question.external_id || sourceId,
        origin: "generated",
        status: "draft",
        quote_ids: bank.map((q) => q.id),
        ...result.generated,
      },
    ],
    rendered_preview: result.rendered,
  };

  fs.mkdirSync(generatedDir, { recursive: true });
  const outPath = path.join(generatedDir, `${base}.answer.json`);
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

  const r = result.rendered;
  console.log("─".repeat(72));
  console.log(`${r.document_type} — ${r.court} — ${r.case_number}`);
  console.log("─".repeat(72));
  console.log(r.opening + "\n");
  for (const s of r.sections) {
    console.log(`== ${s.heading} ==`);
    s.paragraphs.forEach((p, i) => console.log(`${i + 1}. ${p}\n`));
  }
  console.log("─".repeat(72));
  console.log(`\nwritten to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
