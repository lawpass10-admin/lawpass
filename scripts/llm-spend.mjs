// llm-spend.mjs — what the project has spent on Claude, from the token counts
// stored on its own rows, and what that implies is left.
//
//   node scripts/llm-spend.mjs                      # since the balance anchor
//   node scripts/llm-spend.mjs --since=2026-10-01   # since a date
//   node scripts/llm-spend.mjs --all                # everything ever recorded
//   node scripts/llm-spend.mjs --rows=20            # show the biggest N calls
//
// THE BALANCE IS NOT READ, IT IS INFERRED. Anthropic exposes no credit-balance
// API, and the Cost API needs an Admin key on an organization account. So:
//
//     remaining ≈ LLM_BALANCE_ANCHOR_USD − (everything recorded after
//                 LLM_BALANCE_ANCHOR_AT)
//
// Both halves come from you: open https://console.anthropic.com/settings/billing,
// read the balance, and put it in .env.local with the moment you read it:
//
//     LLM_BALANCE_ANCHOR_USD=64.78
//     LLM_BALANCE_ANCHOR_AT=2026-10-04T12:00:00Z
//
// The timestamp is not optional padding. Without it the arithmetic would
// subtract spend the console had ALREADY subtracted, and the figure would be
// wrong by however much had been spent before you looked.
//
// EVERY GAP IN THIS READS LOW — it will tell you there is more left than there
// is, never less. See lib/billing/llm-rates.ts for the list.

import dotenv from "dotenv";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

// Mirrors lib/billing/llm-rates.ts. Duplicated rather than imported because
// this is a plain .mjs script and that is a TypeScript module — if you change
// one, change the other.
const RATES = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-5-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};
const UNKNOWN = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const money = (d) => `$${d.toFixed(2)}`;

/**
 * The whole arithmetic, in one place.
 *
 * Two things deliberately NOT added:
 *   * thinking tokens — `output_tokens_details.thinking_tokens` is part of
 *     `output_tokens`, not a figure beside it;
 *   * cached input — the three input kinds are reported separately and do not
 *     overlap.
 * Adding either double-counts.
 */
function costOf(model, usage) {
  if (!usage) return { dollars: 0, estimated: false };
  const known = RATES[model];
  const rate = known ?? UNKNOWN;
  const half = usage.service_tier === "batch" ? 0.5 : 1;
  const dollars =
    ((n(usage.input_tokens) * rate.input +
      n(usage.output_tokens) * rate.output +
      n(usage.cache_creation_input_tokens) * rate.cacheWrite +
      n(usage.cache_read_input_tokens) * rate.cacheRead) /
      1e6) *
    half;
  return { dollars, estimated: !known && Boolean(model) };
}

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "llm-spend.mjs — Claude spend, from the usage stored on our own rows.",
      "",
      "  --since=ISO   count calls at or after this moment",
      "  --all         everything ever recorded",
      "  --rows=N      list the N most expensive calls (default 10)",
      "",
      "Set LLM_BALANCE_ANCHOR_USD and LLM_BALANCE_ANCHOR_AT in .env.local to get",
      "a remaining-balance estimate. Read both from the Anthropic console.",
    ].join("\n")
  );
  process.exit(0);
}

const anchorUsd = Number(process.env.LLM_BALANCE_ANCHOR_USD ?? "");
const anchorAt = process.env.LLM_BALANCE_ANCHOR_AT ?? null;
const since = argv.includes("--all") ? null : (flagOf("since") ?? anchorAt);
const rowLimit = Number(flagOf("rows") ?? 10);

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const rows = [];
const bySource = {};
let papersMissingUsage = 0;
let estimated = 0;

const add = (source, id, at, model, usage) => {
  const { dollars, estimated: guessed } = costOf(model, usage);
  if (guessed) estimated += 1;
  rows.push({ source, id, at, model, dollars, usage });
  bySource[source] ??= { dollars: 0, calls: 0 };
  bySource[source].dollars += dollars;
  bySource[source].calls += 1;
};

const inWindow = (at) => !since || (at !== null && at >= since);

// ── mahoti papers ──────────────────────────────────────────────────────────
const papers = await client.query(
  `SELECT question_id, created_at, questions->'generation' AS generation
     FROM public.mahoti_questions WHERE questions IS NOT NULL`
);
for (const paper of papers.rows) {
  const at = paper.created_at?.toISOString() ?? null;
  const calls = paper.generation?.calls ?? [];
  if (calls.length === 0) {
    if (inWindow(at)) papersMissingUsage += 1;
    continue;
  }
  calls.forEach((call, i) => {
    const callAt = call.at ?? at;
    if (!inWindow(callAt)) return;
    add("mahoti-questions", `${paper.question_id.slice(0, 8)}#${i + 1}`, callAt, call.model ?? paper.generation?.model, call.usage);
  });
}

// ── mahoti real-question reviews ───────────────────────────────────────────
const reviews = await client.query(
  `SELECT real_question_id, paper, number, review->'generated' AS made
     FROM public.mahoti_real_questions WHERE review IS NOT NULL`
);
for (const review of reviews.rows) {
  if (!review.made?.usage) continue;
  const at = review.made.at ?? null;
  if (!inWindow(at)) continue;
  add("mahoti-reviews", `${review.paper} #${review.number}`, at, review.made.model, review.made.usage);
}

// ── diuni papers ───────────────────────────────────────────────────────────
const diuni = await client.query(
  `SELECT question_id, created_at, generation_meta
     FROM public.diuni_questions WHERE generation_meta IS NOT NULL
    ORDER BY created_at ASC`
);

// A DRAFT IS BILLED ONCE, NOT ONCE PER SET IT LANDS IN.
//
// scripts/diuni/generate-batch.mjs writes question drafts to disk, and
// load-diuni-questions.mjs copies each draft's generation_meta into whatever
// set it is loaded into. The same draft can be loaded into several sets, and
// then its usage appears on several rows — 255 entries across 187 distinct
// files, when this was first run. Pricing every entry counted 68 questions
// that were generated once, inflating the diuni total by about a quarter.
//
// So the file name is the identity, and the first row to carry it (oldest
// first, hence the ORDER BY) is the one charged for it.
const seenDraft = new Set();

for (const paper of diuni.rows) {
  // Per-question usage, but no per-question timestamp: the whole paper is
  // dated by its row, so one generated across a window boundary lands wholly
  // on one side of it.
  const at = paper.created_at?.toISOString() ?? null;
  for (const q of paper.generation_meta?.questions ?? []) {
    if (!q.usage) continue;
    // Checked before the window test, so a draft first loaded before the
    // window is not re-charged by a later set that falls inside it.
    const key = q.file ?? `${paper.question_id}#${q.case_number ?? "?"}`;
    if (seenDraft.has(key)) continue;
    seenDraft.add(key);
    if (!inWindow(at)) continue;
    add("diuni-questions", `${paper.question_id.slice(0, 8)}#${q.file ?? "?"}`, at, q.model, q.usage);
  }
}

await client.end();

const total = rows.reduce((sum, r) => sum + r.dollars, 0);
const tokens = rows.reduce(
  (sum, r) =>
    sum +
    n(r.usage?.input_tokens) +
    n(r.usage?.output_tokens) +
    n(r.usage?.cache_creation_input_tokens) +
    n(r.usage?.cache_read_input_tokens),
  0
);

console.log(`\nClaude spend ${since ? `since ${since}` : "(everything recorded)"}\n`);
for (const [source, agg] of Object.entries(bySource).sort((a, b) => b[1].dollars - a[1].dollars)) {
  console.log(`  ${source.padEnd(18)} ${money(agg.dollars).padStart(9)}   ${String(agg.calls).padStart(4)} calls`);
}
console.log(`  ${"".padEnd(18)} ${"─".repeat(9)}`);
console.log(`  ${"TOTAL".padEnd(18)} ${money(total).padStart(9)}   ${tokens.toLocaleString()} tokens\n`);

if (rowLimit > 0 && rows.length > 0) {
  console.log(`most expensive ${Math.min(rowLimit, rows.length)} call(s):\n`);
  for (const r of [...rows].sort((a, b) => b.dollars - a.dollars).slice(0, rowLimit)) {
    console.log(
      `  ${money(r.dollars).padStart(8)}  ${(r.at ?? "undated").slice(0, 16).padEnd(17)} ${r.source.padEnd(18)} ${r.id}`
    );
  }
  console.log();
}

if (papersMissingUsage > 0) {
  console.log(
    `${papersMissingUsage} paper(s) in this window record NO usage and are not counted above.\n` +
      `Those predate the usage recording added on 2026-10-04; at roughly $6-8 each,\n` +
      `the real figure is about ${money(total + papersMissingUsage * 7)}.\n`
  );
}
if (estimated > 0) {
  console.log(`${estimated} call(s) used an unrecognised model id and were priced at the top rate.\n`);
}

if (Number.isFinite(anchorUsd) && anchorUsd > 0 && anchorAt) {
  const remaining = Math.max(0, anchorUsd - total);
  console.log("balance estimate\n");
  console.log(`  anchor            ${money(anchorUsd)}  read from the console at ${anchorAt}`);
  console.log(`  spent since       ${money(total)}`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  remaining        ~${money(remaining)}   (${Math.round((remaining / anchorUsd) * 100)}% of the anchor)\n`);
  console.log("  An estimate, and one that reads HIGH: anything billed outside this");
  console.log("  repo, and every retried call, is missing from the spend side.\n");
} else {
  console.log(
    "No balance estimate: set LLM_BALANCE_ANCHOR_USD and LLM_BALANCE_ANCHOR_AT in\n" +
      ".env.local, from https://console.anthropic.com/settings/billing.\n"
  );
}
