"use strict";

// CLI: generate a new angle of an open writing-task question.
//
//   node scripts/generate-open-question.js <questions.json> <source_external_id> [angle_letter] [--effort=high]
//
// Example:
//   node scripts/generate-open-question.js \
//     ../scripts/ingestion/open_questions/2025-12-part1-writing.json 2025-D-W-Q1 A
//
// Writes <source_external_id>-<letter>.generated.json next to the input and prints
// the rendered Hebrew for review. Nothing is written to the database — generated
// questions are drafts for a human to approve.

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// Same env-file resolution order as config/env.js, but without its required()
// checks — generation needs ANTHROPIC_API_KEY and nothing else, so this script
// must not demand the full Supabase configuration just to run.
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
const {
  generateAngle,
  mergeParams,
  DEFAULT_PARAMS,
} = require("../lib/ai/generate-open-question");

const DEFAULT_PARAMS_FILE = "llm-params.json";

/** Previously generated angles for this source, so the model doesn't repeat itself. */
function loadExistingAngles(dir, sourceId, skipLetter) {
  if (!fs.existsSync(dir)) return [];
  const pattern = new RegExp(`^${sourceId}-([A-Za-z0-9]+)\\.generated\\.json$`);
  return fs
    .readdirSync(dir)
    .map((f) => ({ f, m: f.match(pattern) }))
    .filter(({ m }) => m && m[1] !== skipLetter)
    .flatMap(({ f }) => {
      try {
        const q = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
          .questions?.[0];
        return q ? [{ angle_letter: q.angle_letter, angle_title: q.angle_title }] : [];
      } catch {
        return []; // a malformed sibling must not block a new generation
      }
    });
}

/** Turn a JSON.parse character offset into a line:column the user can navigate to. */
function locate(text, error) {
  const at = /position (\d+)/.exec(error.message);
  if (!at) return "";
  const upto = text.slice(0, Number(at[1]));
  const line = upto.split("\n").length;
  const col = upto.length - upto.lastIndexOf("\n");
  return ` at line ${line}, column ${col}`;
}

/**
 * Flag keys that don't belong. Catches the common editing mistake of pasting a
 * whole section (e.g. "authoring": {...}) inside an existing one, and plain typos.
 */
function checkParamKeys(params) {
  const KNOWN_TOP = new Set([
    ...Object.keys(DEFAULT_PARAMS),
    "version",
    "_readme",
    "_options",
  ]);
  const warnings = [];

  for (const key of Object.keys(params)) {
    if (!KNOWN_TOP.has(key)) warnings.push(`unknown top-level key "${key}"`);
  }
  for (const section of Object.keys(DEFAULT_PARAMS)) {
    const supplied = params[section];
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) continue;
    if (section === "forbidden_terms") continue; // keys are question ids, not fixed
    for (const key of Object.keys(supplied)) {
      if (!(key in DEFAULT_PARAMS[section])) {
        warnings.push(
          `"${section}.${key}" is not a recognised setting and will be ignored` +
            (key === section ? ` — looks like a "${section}" block pasted inside itself` : "")
        );
      }
    }
  }
  return warnings;
}

/** Read the params file that sits next to the questions JSON (or --params=...). */
function loadParams(jsonPath, explicitPath) {
  const p =
    explicitPath ||
    path.join(path.dirname(path.resolve(jsonPath)), DEFAULT_PARAMS_FILE);
  if (!fs.existsSync(p)) {
    console.warn(`no params file at ${p} — using built-in defaults`);
    return { params: {}, paramsPath: null };
  }

  const text = fs.readFileSync(p, "utf8");
  let params;
  try {
    params = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `${p} is not valid JSON${locate(text, err)}.\n` +
        `  ${err.message}\n` +
        `  Each section (model, generation, authoring, validation, forbidden_terms) must appear\n` +
        `  exactly once. Edit values in place — don't paste a whole section inside another.`
    );
  }

  for (const w of checkParamKeys(params)) console.warn(`params warning: ${w}`);
  return { params, paramsPath: p };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));
  const [jsonPath, sourceId, angleLetter = "A"] = positional;

  if (!jsonPath || !sourceId) {
    console.error(
      "usage: node scripts/generate-open-question.js <questions.json> <source_external_id> [angle_letter]\n" +
        "       [--params=<file>] [--effort=...] [--model=...] [--max-tokens=N] [--no-cache]"
    );
    process.exit(2);
  }

  const flag = (name) =>
    flags.find((f) => f.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

  const { params, paramsPath } = loadParams(jsonPath, flag("params"));

  // CLI flags win over the params file, so a one-off experiment doesn't require
  // editing (and then remembering to revert) the committed configuration.
  params.model = params.model || {};
  if (flag("effort")) params.model.effort = flag("effort");
  if (flag("model")) params.model.id = flag("model");
  if (flag("max-tokens")) params.model.max_tokens = Number(flag("max-tokens"));
  if (flags.includes("--no-cache")) {
    params.generation = { ...(params.generation || {}), prompt_cache: false };
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const source = data.questions.find((q) => q.external_id === sourceId);
  if (!source) {
    console.error(
      `source ${sourceId} not found. Available: ${data.questions.map((q) => q.external_id).join(", ")}`
    );
    process.exit(2);
  }

  const bank = buildBank(data.quotes, sourceId);
  const forbiddenTerms = (params.forbidden_terms || {})[sourceId] || [];

  // Angles already produced for this source. Without these the model has no way
  // to know what it already wrote, and angle B drifts back toward angle A.
  const existingAngles = loadExistingAngles(
    path.dirname(path.resolve(jsonPath)),
    sourceId,
    angleLetter
  );

  const effective = mergeParams(params);
  console.log(`source : ${sourceId} — ${source.title}`);
  console.log(`quotes : ${bank.map((q) => q.id).join(", ")} (locked)`);
  console.log(`params : ${paramsPath || "built-in defaults"}`);
  console.log(
    `model  : ${effective.model.id} · effort ${effective.model.effort} · ` +
      `max_tokens ${effective.model.max_tokens} · cache ${effective.generation.prompt_cache ? "on" : "off"}`
  );
  console.log(
    `rules  : leak threshold ${effective.validation.leak_shingle_size} words · ` +
      `${forbiddenTerms.length} forbidden term(s)`
  );
  console.log(
    `avoid  : ${
      existingAngles.length
        ? existingAngles.map((a) => a.angle_letter).join(", ") + " (already written)"
        : "no earlier angles"
    }`
  );
  console.log(`\ngenerating with ${effective.model.id} — this can take a few minutes...\n`);

  const started = Date.now();
  const result = await generateAngle({
    source,
    bank,
    angleLetter,
    forbiddenTerms,
    existingAngles,
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

  const outDir = path.dirname(path.resolve(jsonPath));

  // A rejected generation still cost time and money. Always persist it so the
  // failure can be inspected and the prompt tuned — never silently discard.
  if (!result.validation.ok) {
    const rejectedPath = path.join(
      outDir,
      `${sourceId}-${angleLetter}.rejected.json`
    );
    fs.writeFileSync(
      rejectedPath,
      JSON.stringify(
        {
          rejected_at: new Date().toISOString(),
          ...result.meta,
          usage: u,
          errors: result.validation.errors,
          generated: result.generated,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    console.error("QUOTE LOCK FAILED — not promoted to a draft:\n");
    for (const e of result.validation.errors) {
      console.error(`  [${e.type}] ${e.detail}`);
    }
    console.error(`\noutput saved for inspection: ${rejectedPath}`);
    process.exit(1);
  }

  console.log("quote lock: OK — no source text was reproduced by the model\n");

  const out = {
    generated_from: {
      source_external_id: sourceId,
      source_file: path.basename(jsonPath),
      ...result.meta,
      generated_at: new Date().toISOString(),
    },
    questions: [
      {
        external_id: `${sourceId}-${angleLetter}`,
        origin: "generated",
        parent_question_id: sourceId,
        question_type: source.question_type,
        status: "draft", // never student-facing until a human approves
        quote_ids: bank.map((q) => q.id), // reused unchanged from the parent
        ...result.generated,
      },
    ],
    rendered_preview: result.rendered,
  };

  const outPath = path.join(outDir, `${sourceId}-${angleLetter}.generated.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  const r = result.rendered;
  console.log("─".repeat(72));
  console.log(r.angle_title);
  console.log("─".repeat(72));
  console.log(r.fact_pattern);
  console.log("\n== המטלה ==\n" + r.task_instructions);
  console.log("\n== ניתוח (עם המקורות המשובצים) ==\n" + r.legal_topic_analysis);
  console.log("─".repeat(72));
  console.log(`\nwritten to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
