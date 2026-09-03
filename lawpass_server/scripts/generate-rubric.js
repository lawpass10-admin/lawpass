"use strict";

// CLI: write the grading rubric (מחוון) for a generated question.
//
//   node scripts/generate-rubric.js <merged-bundle.answer.json> [--effort=...]
//
// The bundle path is resolved against the CURRENT directory, so it differs by
// where you stand. Both of these run the same thing:
//
//   from app/lawpass_server/
//     node scripts/generate-rubric.js \
//       ../scripts/ingestion/open_questions/generated/2026-S-Q1-A.answer.json
//
//   from app/
//     node lawpass_server/scripts/generate-rubric.js \
//       scripts/ingestion/open_questions/generated/2026-S-Q1-A.answer.json
//
// Takes the MERGED bundle written by generate-open-answer.js — it holds both the
// question and the model answer, and the rubric is derived from the two together.
// The official מחוון is picked up automatically from <workspace>/answers/, the
// same file the answer generator uses as its standard.
//
// Output is <workspace>/generated/<id>.rubric.json, status "draft". A draft is
// not gradeable: it has to be read, corrected where the points are wrong, and
// promoted to "approved" before load_rubric.mjs will attach it to a question.

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

const { startTimer, mmss } = require("../lib/progress");

const RUN_STARTED = Date.now();
const {
  generateRubric,
  buildRubricRequest,
  processRubricMessage,
  SCALE,
  TOTAL_POINTS,
} = require("../lib/ai/generate-rubric");
const { runStage } = require("../lib/ai/batch-stage");

const QUESTION_PARAMS_FILE = "llm-params.json";
const RUBRIC_PARAMS_FILE = "llm-params-rubric.json";

function findWorkspaceRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, QUESTION_PARAMS_FILE))) return dir;
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
 * The official מחוון from <workspace>/answers/ — same file the answer generator
 * marks against, here used as the worked example of the artifact being written.
 * The exemplar ANSWERS in that folder are deliberately not loaded: they answer
 * other questions, and a rubric written with them in view starts describing
 * their content instead of ours.
 */
function loadExemplarRubric(root) {
  const dir = path.join(root, "answers");
  if (!fs.existsSync(dir)) {
    throw new Error(`no answers/ folder at ${dir} — it must hold the official מחוון`);
  }
  const file = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .find((f) => /tamplete|template|rubric|מחוון/i.test(f));
  if (!file) throw new Error(`no rubric JSON found in ${dir}`);

  const text = pagesToText(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
  if (!text.trim()) throw new Error(`${file} converted to empty text`);
  return { text, file, dir };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const [bundlePath] = args.filter((a) => !a.startsWith("--"));

  if (!bundlePath) {
    console.error(
      "usage: node scripts/generate-rubric.js <merged-bundle.answer.json>\n" +
        "       [--effort=...] [--model=...] [--max-tokens=N] [--no-cache]"
    );
    process.exit(2);
  }

  const flag = (name) =>
    flags.find((f) => f.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

  const root = findWorkspaceRoot(path.dirname(path.resolve(bundlePath)));
  const generatedDir = path.join(root, "generated");
  const rejectedDir = path.join(generatedDir, "rejected");

  // Rubric settings come from llm-params-rubric.json; anything it omits falls
  // back to the question file, so only the differences need stating.
  const questionParamsPath = path.join(root, QUESTION_PARAMS_FILE);
  const rubricParamsPath = path.join(root, RUBRIC_PARAMS_FILE);

  const questionParams = fs.existsSync(questionParamsPath)
    ? JSON.parse(fs.readFileSync(questionParamsPath, "utf8"))
    : {};

  let params;
  if (fs.existsSync(rubricParamsPath)) {
    const rubricParams = JSON.parse(fs.readFileSync(rubricParamsPath, "utf8"));
    params = {
      ...rubricParams,
      model: { ...(questionParams.model || {}), ...(rubricParams.model || {}) },
      generation: {
        ...(questionParams.generation || {}),
        ...(rubricParams.generation || {}),
      },
    };
  } else {
    console.warn(
      `no ${RUBRIC_PARAMS_FILE} at ${root} — using built-in defaults from lib/ai/generate-rubric.js`
    );
    params = {};
  }
  params.model = params.model || {};
  if (flag("effort")) params.model.effort = flag("effort");
  if (flag("model")) params.model.id = flag("model");
  if (flag("max-tokens")) params.model.max_tokens = Number(flag("max-tokens"));
  if (flags.includes("--no-cache")) {
    params.generation = { ...(params.generation || {}), prompt_cache: false };
  }

  // Named explicitly rather than left to a bare ENOENT: the path is resolved
  // against the current directory, so the usual mistake is standing one level
  // up or down, and the resolved path is what makes that obvious.
  const resolvedBundle = path.resolve(bundlePath);
  if (!fs.existsSync(resolvedBundle)) {
    throw new Error(
      `no bundle at ${resolvedBundle}\n` +
        `(the path is resolved from ${process.cwd()} — check which directory you are in)`
    );
  }

  const bundle = JSON.parse(fs.readFileSync(resolvedBundle, "utf8"));
  const question = bundle.questions?.[0];
  const answer = bundle.answers?.[0];
  if (!question) throw new Error(`no questions[0] in ${bundlePath}`);
  if (!answer) {
    throw new Error(
      `no answers[0] in ${bundlePath} — the rubric is derived from the question AND the ` +
        `model answer, so run generate-open-answer.js first`
    );
  }

  const base = question.external_id || answer.question_external_id;
  const { text: exemplarRubricText, file: rubricFile, dir } = loadExemplarRubric(root);

  console.log(`question : ${base} — ${question.angle_title || question.title || ""}`);
  console.log(`answer   : ${(answer.sections || []).length} sections`);
  console.log(`exemplar : ${rubricFile} (${exemplarRubricText.length} chars) from ${dir}`);
  console.log(`scale    : לשון ${SCALE.language.max} + ארגון ${SCALE.organization.max} + תוכן ${SCALE.content.max} = ${TOTAL_POINTS}`);
  console.log(`params   : ${fs.existsSync(rubricParamsPath) ? rubricParamsPath : "(built-in defaults)"}`);
  console.log(`\nwriting the rubric — this can take a couple of minutes...\n`);

  const stopTimer = startTimer("writing");
  let result;
  let emitted = false;
  try {
    // One live call, unless the Batch API flags are set. The crash-recording
    // below covers this the same way it covered the direct call: a batched
    // reply that cannot be processed is still a stage that failed, and it
    // leaves the same trace on disk.
    const staged = await runStage({
      flags,
      args: { question, answer, exemplarRubricText, params },
      build: buildRubricRequest,
      process: processRubricMessage,
      generate: generateRubric,
    });
    emitted = Boolean(staged.emitted);
    result = staged.result;
  } catch (err) {
    // A throw here is not a rejected rubric — it is the call itself failing:
    // an API error, output truncated at max_tokens, a refusal. Nothing was
    // validated, so the rejected-output path below never runs and the failure
    // used to leave no trace at all beyond one line on a terminal that scrolls.
    // Record what it was, so the next run does not have to reproduce it.
    stopTimer();
    fs.mkdirSync(rejectedDir, { recursive: true });
    const crashPath = path.join(rejectedDir, `${base}.rubric.crash.json`);
    fs.writeFileSync(
      crashPath,
      JSON.stringify(
        {
          failed_at: new Date().toISOString(),
          bundle: path.basename(bundlePath),
          question_external_id: base,
          model: params.model.id,
          effort: params.model.effort,
          max_tokens: params.model.max_tokens,
          error: {
            name: err?.name ?? null,
            message: err?.message ?? String(err),
            status: err?.status ?? null,
            stack: err?.stack ?? null,
          },
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    console.error(`\nRUBRIC CALL FAILED — nothing was generated: ${err?.message || err}`);
    console.error(`details saved for inspection: ${crashPath}`);
    throw err;
  }
  const seconds = stopTimer();
  if (emitted) return;

  const u = result.usage || {};
  console.log(
    `model call: ${mmss(seconds * 1000)} (${seconds}s) — in ${u.input_tokens ?? "?"} | ` +
      `cache write ${u.cache_creation_input_tokens ?? 0} | ` +
      `cache read ${u.cache_read_input_tokens ?? 0} | ` +
      `out ${u.output_tokens ?? "?"} tokens\n`
  );

  const v = result.validation;

  if (!v.ok) {
    fs.mkdirSync(rejectedDir, { recursive: true });
    const rejectedPath = path.join(rejectedDir, `${base}.rubric.rejected.json`);
    fs.writeFileSync(
      rejectedPath,
      JSON.stringify(
        {
          rejected_at: new Date().toISOString(),
          ...result.meta,
          usage: u,
          errors: v.errors,
          warnings: v.warnings,
          generated: result.generated,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    console.error("VALIDATION FAILED — not written as a draft:\n");
    for (const e of v.errors) console.error(`  [${e.type}] ${e.detail}`);
    console.error(`\noutput saved for inspection: ${rejectedPath}`);
    console.error(`total time: ${mmss(Date.now() - RUN_STARTED)}`);
    process.exit(1);
  }

  for (const r of result.repairs ?? []) console.log(`repaired: ${r}\n`);

  console.log(
    `points: תוכן ${v.contentTotal}/${SCALE.content.max} across ` +
      `${result.generated.content_items.length} items, ` +
      `${result.generated.deductions.length} deduction(s) worth ${v.deductionTotal}\n`
  );

  const out = {
    external_id: `${base}-RUBRIC`,
    question_external_id: base,
    origin: "generated",
    // Draft until a human has read it. load_rubric.mjs refuses anything else,
    // because a rubric nobody checked decides real grades.
    status: "draft",
    total_points: TOTAL_POINTS,
    dimensions: {
      language: { max_points: SCALE.language.max, criteria: result.generated.criteria.language, bands: result.generated.language_bands },
      organization: { max_points: SCALE.organization.max, criteria: result.generated.criteria.organization, bands: result.generated.organization_bands },
      content: { max_points: SCALE.content.max, criteria: result.generated.criteria.content, items: result.generated.content_items },
    },
    deductions: result.generated.deductions,
    challenges: result.generated.challenges,
    generated_from: {
      ...result.meta,
      bundle: path.basename(bundlePath),
      exemplar_rubric: rubricFile,
      usage: u,
      generated_at: new Date().toISOString(),
      warnings: v.warnings,
    },
  };

  fs.mkdirSync(generatedDir, { recursive: true });
  const outPath = path.join(generatedDir, `${base}.rubric.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  // Printed in full: this is the artifact a human has to sign off, and reading
  // it here beats opening the JSON.
  console.log("─".repeat(72));
  console.log(`האתגרים הבולטים במטלה: ${result.generated.challenges}`);
  console.log("─".repeat(72));
  for (const item of result.generated.content_items) {
    console.log(`${item.id.padEnd(4)} ${String(item.points).padStart(4)} נק'  ${item.title}`);
    console.log(`            ${item.requirement}`);
    if (item.partial_credit) console.log(`            חלקי: ${item.partial_credit}`);
    if (item.model_answer_section) console.log(`            ← ${item.model_answer_section}`);
    console.log("");
  }
  if (result.generated.deductions.length) {
    console.log("הורדת נקודות:");
    for (const d of result.generated.deductions) {
      console.log(`  ${d.id}  -${d.points_off}  ${d.fault}`);
    }
    console.log("");
  }
  console.log("─".repeat(72));

  if (v.warnings.length) {
    console.log("\nwarnings (written anyway — check these before approving):");
    for (const w of v.warnings) console.log(`  - ${w}`);
  }

  console.log(`\nwritten to ${outPath}`);
  console.log(
    `\nNEXT: read it, fix any wrong weightings in place, then attach it — from app/:\n` +
      `  node scripts/ingestion/open_questions/load_rubric.mjs ${base}.rubric.json --approve --commit\n` +
      `Drop --approve to load it as a draft, or --commit to see what it would write.`
  );
  console.log(`total time: ${mmss(Date.now() - RUN_STARTED)}`);
}

main().catch((err) => {
  console.error(err.message || err);
  console.error(`total time: ${mmss(Date.now() - RUN_STARTED)}`);
  process.exit(1);
});
