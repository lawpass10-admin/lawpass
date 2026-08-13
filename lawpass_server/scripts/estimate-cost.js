"use strict";

// What the generated questions and answers actually cost.
//
//   node scripts/estimate-cost.js <dir-or-file> [...]
//
// Reads the `usage` recorded on each generated file — real token counts from
// real runs, not estimates. Files produced before usage was recorded are listed
// separately rather than silently omitted from the total.

const fs = require("node:fs");
const path = require("node:path");

// USD per million tokens. Cache write is 1.25x base input on the default 5-minute
// TTL (2x on the 1-hour TTL); cache read is ~0.1x.
const PRICING = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

function costOf(usage, modelId) {
  const p = PRICING[modelId] || PRICING["claude-opus-5"];
  const m = (tokens, rate) => ((tokens || 0) / 1e6) * rate;
  const parts = {
    input: m(usage.input_tokens, p.input),
    cache_write: m(usage.cache_creation_input_tokens, p.input * CACHE_WRITE_MULTIPLIER),
    cache_read: m(usage.cache_read_input_tokens, p.input * CACHE_READ_MULTIPLIER),
    output: m(usage.output_tokens, p.output),
  };
  parts.total = parts.input + parts.cache_write + parts.cache_read + parts.output;
  return parts;
}

/** Usage + model live in different places depending on which script wrote the file. */
function extract(doc) {
  const answerMeta = doc.generated_from?.answer;
  if (answerMeta?.usage) {
    return { kind: "answer", usage: answerMeta.usage, model: answerMeta.model, effort: answerMeta.effort };
  }
  if (doc.generated_from?.usage) {
    return { kind: "question", usage: doc.generated_from.usage, model: doc.generated_from.model, effort: doc.generated_from.effort };
  }
  if (doc.usage) {
    // a rejected payload — meta is spread at the top level
    return {
      kind: doc.question_external_id && doc.generated?.sections ? "answer" : "question",
      usage: doc.usage,
      model: doc.model,
      effort: doc.effort,
      rejected: true,
    };
  }
  return null;
}

function collect(target, out = []) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      collect(path.join(target, entry), out);
    }
    return out;
  }
  if (target.endsWith(".json")) out.push(target);
  return out;
}

function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error("usage: node scripts/estimate-cost.js <dir-or-file> [...]");
    process.exit(2);
  }

  const files = targets.flatMap((t) => collect(t));
  const rows = [];
  const noUsage = [];

  for (const f of files) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      continue; // not one of ours
    }
    const info = extract(doc);
    if (!info) {
      if (doc.questions || doc.answers || doc.generated) noUsage.push(path.basename(f));
      continue;
    }
    rows.push({ file: path.basename(f), ...info, cost: costOf(info.usage, info.model) });
  }

  if (!rows.length) {
    console.log("no files with recorded usage found");
    if (noUsage.length) console.log(`(${noUsage.length} file(s) predate usage recording)`);
    return;
  }

  const usd = (n) => `$${n.toFixed(4)}`;
  console.log(
    `${"file".padEnd(42)} ${"kind".padEnd(8)} ${"effort".padEnd(7)} ${"out tok".padStart(8)} ${"cost".padStart(9)}`
  );
  console.log("-".repeat(80));
  for (const r of rows) {
    console.log(
      `${r.file.padEnd(42)} ${(r.rejected ? r.kind + "*" : r.kind).padEnd(8)} ` +
        `${String(r.effort || "?").padEnd(7)} ${String(r.usage.output_tokens || 0).padStart(8)} ${usd(r.cost.total).padStart(9)}`
    );
  }

  const sum = (kind, field) =>
    rows.filter((r) => r.kind === kind && !r.rejected).reduce((a, r) => a + r.cost[field], 0);
  const count = (kind) => rows.filter((r) => r.kind === kind && !r.rejected).length;

  console.log("-".repeat(80));
  for (const kind of ["question", "answer"]) {
    const n = count(kind);
    if (n) console.log(`${kind}s kept : ${n} · ${usd(sum(kind, "total"))} · avg ${usd(sum(kind, "total") / n)}`);
  }

  const rejected = rows.filter((r) => r.rejected);
  if (rejected.length) {
    const wasted = rejected.reduce((a, r) => a + r.cost.total, 0);
    console.log(`rejected     : ${rejected.length} · ${usd(wasted)} (paid for, not used)`);
  }

  const total = rows.reduce((a, r) => a + r.cost.total, 0);
  console.log(`TOTAL        : ${usd(total)} across ${rows.length} run(s)`);

  const reads = rows.reduce((a, r) => a + (r.usage.cache_read_input_tokens || 0), 0);
  const writes = rows.reduce((a, r) => a + (r.usage.cache_creation_input_tokens || 0), 0);
  if (writes && !reads) {
    const premium = ((writes / 1e6) * 5.0 * (CACHE_WRITE_MULTIPLIER - 1)).toFixed(4);
    console.log(
      `\ncache: ${writes} tokens written, 0 read — every run paid the 1.25x write\n` +
        `       premium (about $${premium} so far) and never collected the ~10x read discount.`
    );
  }

  if (noUsage.length) {
    console.log(`\n${noUsage.length} file(s) predate usage recording and are not counted:`);
    for (const f of noUsage) console.log(`  ${f}`);
  }
}

main();
