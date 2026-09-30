// extract-requirements.mjs — read an instructional source and write out the
// bare facts it states, as a requirements file for rewrite-source.mjs.
//
//   node scripts/ingestion/extract-requirements.mjs <extracted.json> --out=<file.json>
//   node scripts/ingestion/extract-requirements.mjs in.json --out=req.json --dry-run
//
// ── READ THIS BEFORE USING IT ────────────────────────────────────────────────
//
// THIS IS THE STEP THE PIPELINE WAS BUILT TO AVOID. Everywhere else, the model
// never sees the source's prose: usage_guide sends two table columns, and
// procedure_guide sends a requirements file someone else wrote. Here the prose
// IS the input. That is why it is a separate script, a separate run and a
// separate origin (`model_extraction`) rather than a flag on the converter —
// the weaker basis should be something you chose, not something you inherited.
//
// WHAT MAKES IT DEFENSIBLE, AND WHAT DOES NOT:
//   - What it emits are facts: a time limit, a required register, how exhibits
//     are numbered. Facts are not protected by copyright. The booklet's
//     explanation of them is, and that is exactly what must not come through.
//   - The model that WRITES the guide still never sees the prose. It is handed
//     this file and nothing else, so the expression cannot reach the output by
//     the ordinary route.
//   - checks.max_shared_ngram still runs blocking against the source, so
//     phrasing that did survive extraction is caught before anything is stored.
//   - What is gone is R1's mechanical guarantee. A model read the booklet. No
//     amount of prompting turns that back into "the protected layer was never
//     available", and this header is not going to pretend otherwise.
//
// The prompt therefore pushes hard in one direction: strip, do not paraphrase.
// A requirement that still reads like a sentence from the booklet is a failure
// of this step, and the length cap is the main thing enforcing that.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const dryRun = argv.includes("--dry-run");
const outPath = flagOf("out");
const model = flagOf("model") ?? "claude-opus-5";
const inputs = argv.filter((a) => !a.startsWith("--"));

// A cap, not a request. 25 words is roughly the length at which a statement
// stops being a fact and starts being the sentence that expressed it.
const RequirementSchema = z.object({
  id: z.string(),
  statement: z.string().min(5).max(160),
  stage: z.string().max(40),
});
const ExtractionSchema = z.object({
  requirements: z.array(RequirementSchema).min(1),
});

function buildPrompt(sections) {
  const body = sections
    .map((s) => [s.heading ?? "", ...(s.paragraphs ?? [])].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");

  return [
    "Below is a Hebrew instructional booklet about a bar-exam writing task.",
    "",
    "Your job is to STRIP it to the bare rules it states. You are not summarising it,",
    "not paraphrasing it and not writing about it. You are listing the facts it asserts,",
    "each as short as it can be while still being true.",
    "",
    "A requirement is a fact about the task: a time limit, a required register, how",
    "exhibits are numbered, what a section must open with, what the grading rubric",
    "rewards. It is the sort of thing that would be true whoever wrote it down.",
    "",
    "RULES:",
    "  - At most 25 words per statement. Shorter is better. If you cannot say it in 25",
    "    words it is an explanation, not a requirement — drop it.",
    "  - Strip the booklet's phrasing. Do not carry its sentences, its examples, its",
    "    analogies or its turns of phrase. Write the rule as you would state it cold.",
    "  - No reasoning and no examples. Just the rule.",
    "  - Skip anything that is commentary, encouragement, or the author's opinion.",
    "  - Skip anything already obvious from the exam regulations (weights, pass mark).",
    "  - `stage`: one or two words for where in the work it applies — planning,",
    "    facts, argument, language, checking.",
    "  - Write the statements in Hebrew.",
    "",
    "Return JSON only.",
    "",
    "--- THE BOOKLET ---",
    body,
  ].join("\n");
}

async function main() {
  if (inputs.length === 0 || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/extract-requirements.mjs <extracted.json> --out=<file.json>\n" +
        "       [--dry-run] [--model=<id>]\n\n" +
        "Reads the source's prose and writes bare requirement statements.\n" +
        "Recorded as origin 'model_extraction' — the weakest of the three; see\n" +
        "requirements_input in LLM-text-converting.json before relying on it."
    );
    process.exit(inputs.length === 0 ? 2 : 0);
  }

  const sourcePath = inputs[0];
  if (!existsSync(sourcePath)) {
    console.error(`no such file — ${sourcePath}`);
    process.exit(1);
  }
  if (!outPath && !dryRun) {
    console.error("--out=<file.json> is required (or --dry-run to look first)");
    process.exit(2);
  }

  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const sections = source.sections ?? [];
  const paragraphs = sections.reduce((n, s) => n + (s.paragraphs ?? []).length, 0);

  console.log(`source   ${basename(sourcePath)}`);
  console.log(`         ${sections.length} section(s), ${paragraphs} paragraph(s)`);
  console.log(
    "\n! This sends the source's PROSE to the model. It is the one step in this\n" +
      "  pipeline that does, and what comes back is recorded as origin\n" +
      "  'model_extraction' — see the header of this file for what that costs.\n"
  );

  const prompt = buildPrompt(sections);
  if (dryRun) {
    console.log(`prompt: ${prompt.length} chars — nothing sent.`);
    console.log(prompt.slice(0, 1200) + "\n… (truncated)");
    process.exit(0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set (it lives in .env.local)");
    process.exit(1);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 15 * 60 * 1000 });

  console.log(`extracting with ${model} …`);
  const started = Date.now();
  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema, "requirements") },
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    console.error(`refused (${message.stop_details?.category ?? "unknown"})`);
    process.exit(1);
  }

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = ExtractionSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    console.error("the reply did not match the schema:\n" + parsed.error);
    process.exit(1);
  }

  const rate = { input_per_mtok: 5, output_per_mtok: 25 };
  const cost =
    (message.usage.input_tokens / 1e6) * rate.input_per_mtok +
    (message.usage.output_tokens / 1e6) * rate.output_per_mtok;

  const out = {
    _origin_note:
      "Extracted by a model that READ the source's prose. origin='model_extraction' " +
      "does not satisfy R1 mechanically — see requirements_input in the contract. " +
      "Read these before converting: anything that still reads like the booklet's own " +
      "sentence should be rewritten or removed by hand.",
    extracted_by: `${model} (model_extraction)`,
    extracted_at: new Date().toISOString().slice(0, 10),
    checked_against: basename(sourcePath),
    requirements: parsed.data.requirements.map((r) => ({ ...r, origin: "model_extraction" })),
  };

  if (outPath) {
    const dir = dirname(outPath);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  }

  const secs = Math.round((Date.now() - started) / 100) / 10;
  console.log(
    `\n${out.requirements.length} requirement(s) in ${secs}s — ` +
      `$${cost.toFixed(4)} (${message.usage.input_tokens} in + ${message.usage.output_tokens} out)`
  );
  console.log(`wrote ${outPath}`);
  console.log("\nREAD THEM before converting. This step is the weak link, by design.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
