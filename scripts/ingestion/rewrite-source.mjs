// rewrite-source.mjs — turn an extracted source document into LawPass's own
// text, under the contract in LLM-text-converting.json.
//
//   node scripts/ingestion/rewrite-source.mjs <extracted.json> --out=<dir>
//   node scripts/ingestion/rewrite-source.mjs in.json --out=json/ --dry-run
//
// WHAT MAKES THIS DIFFERENT FROM "ASK A MODEL TO REWRITE IT". Asking a model to
// reword a passage is the thing the contract exists to prevent: the model sees
// the protected expression and produces something shaped by it, which is what a
// derivative work is. Here the protected layer never reaches the model at all.
//
// For a usage guide the unprotectable core is the pair (incorrect form, correct
// form) — a fact about Hebrew, which nobody owns. The source's explanations,
// headings and introduction are authored expression, and they are dropped
// before the prompt is built. The model is then asked to explain the facts from
// its own knowledge of Hebrew grammar, in a different arrangement and voice.
// It cannot imitate phrasing it was never shown.
//
// The source text is still needed AFTERWARDS — to check the output against it —
// so it is read locally, compared locally, and never sent anywhere.
//
// SAFE BY DEFAULT: --dry-run prints exactly what would be sent to the model and
// calls nothing.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// The output shape, enforced rather than asked for. The first attempt just
// described the shape in the prompt and parsed whatever came back; Hebrew legal
// writing is full of gershayim (ת"ז, עו"ד, בג"ץ) and a single unescaped one
// breaks JSON.parse on a reply that took minutes to produce. Constraining the
// format removes that whole class of failure — the same approach
// scripts/mahoti/generate-real-reviews.mjs already uses.
// v1.1 — the worked example and exam note are gone. Brevity is enforced by the
// schema as well as asked for in the prompt: a max on the string is a bound the
// model cannot talk itself past, and "keep it short" alone never holds.
const ItemSchema = z.object({
  id: z.string(),
  avoid: z.string(),
  use: z.string(),
  reason: z.string().min(10).max(200),
  // v1.2 — the example is back, at 70 characters against v1.0's median of 69
  // and max of 88. The cap is what makes it a clause showing the form in use
  // rather than the docket header the longest v1.0 example turned out to be.
  example: z.string().min(5).max(70),
});
const GroupSchema = z.object({
  id: z.string(),
  heading: z.string().min(2).max(60),
  why_this_group: z.string().max(180),
  items: z.array(ItemSchema).min(1),
});
const DocSchema = z.object({
  title: z.string().min(2).max(80),
  intro: z.string().min(10).max(320),
  groups: z.array(GroupSchema).min(1),
});

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
// Re-run the contract's checks against a document already written, and rewrite
// its changes file. No model call, no charge. This exists because the CHECKS
// change: when a check is corrected, every document converted under the old one
// needs re-verifying, and paying again to regenerate equivalent text would be
// spending money to refresh a metadata file.
const recheck = argv.includes("--recheck");
const force = argv.includes("--force");
const outDir = flagOf("out");
const contractPath = flagOf("contract") ?? join(here, "LLM-text-converting.json");
const inputs = argv.filter((a) => !a.startsWith("--"));

// ------------------------------------------------------------- the facts

/**
 * The unprotectable core, and nothing else.
 *
 * Reads the wrong/right columns out of every table and discards everything
 * around them — the "why" column, the section headings, the introduction. What
 * comes back is a list of word pairs, which is a list of facts about Hebrew.
 */
function extractFacts(doc) {
  const facts = [];
  const withheld = { explanations: 0, headings: 0, paragraphs: 0 };

  for (const section of doc.sections ?? []) {
    if (section.heading) withheld.headings++;
    withheld.paragraphs += (section.paragraphs ?? []).length;

    for (const table of section.tables ?? []) {
      const cols = table.columns ?? [];
      // Identify the columns by meaning, not by position: a source that orders
      // them differently must not silently produce reversed pairs.
      const wrong = cols.find((c) => /שגוי|לא נכון|שגויה/.test(c));
      const right = cols.find((c) => /תקין|נכון|מומלץ/.test(c));
      if (!wrong || !right) continue;

      for (const row of table.rows ?? []) {
        const avoid = String(row[wrong] ?? "").trim();
        const use = String(row[right] ?? "").trim();
        for (const c of cols) if (c !== wrong && c !== right && row[c]) withheld.explanations++;
        if (avoid && use) facts.push({ avoid, use });
      }
    }
  }

  return { facts, withheld };
}

// ------------------------------------------------------------ the prompt

function buildPrompt(contract, facts) {
  const p = contract.pipeline;
  const lines = [
    "You are writing original Hebrew educational content for LawPass, an Israeli bar-exam preparation product.",
    "",
    "WHAT YOU ARE GIVEN. A list of Hebrew usage facts: a form to avoid and the form to prefer.",
    "These pairs are facts about the Hebrew language. You are NOT given, and must not ask for, any",
    "existing explanation, heading or introduction — you are writing all of that yourself, from your",
    "own knowledge of Hebrew grammar and of how the Academy of the Hebrew Language treats these forms.",
    "",
    `ORGANISE BY: ${p.reorganise_by}. ${p.reorganise_note}`,
    "",
    `VOICE: ${p.voice}`,
    "",
    "ADD, because this is what makes the piece yours:",
    ...p.add_own.map((a) => `  - ${a}`),
    "",
    "REQUIREMENTS:",
    "  - Every pair below must appear exactly once in the output.",
    "  - Group them by the CAUSE of the error. Create the groups yourself; 4-7 of them is sensible.",
    "  - Within a group, order by how often a candidate would actually hit the error, most common first.",
    "",
    "BE SHORT. This is read as a table, scanned rather than studied — a candidate reads the pair and",
    "moves on, and only stops at the one they got wrong. Long cells are read by nobody.",
    `  - \`reason\`: ONE sentence, at most ${p.brevity.reason_max_words} words. Say why the preferred`,
    "    form is the one it is, and stop. No exam advice, no restating the pair.",
    `  - \`example\`: ONE clause, at most ${p.brevity.example_max_words} words, using the PREFERRED`,
    "    form in a sentence of the kind that appears in a כתב תביעה, בקשה or עתירה. It must show the",
    "    form doing its job — not a case number, not a party list, not a document heading. Invent it.",
    `  - \`why_this_group\`: one line, at most ${p.brevity.why_this_group_max_words} words — what these`,
    "    errors have in common.",
    `  - \`intro\`: at most ${p.brevity.intro_max_words} words.`,
    "  - Write in Hebrew. Do not translate the pairs; carry them across exactly as given.",
    "",
    "Return JSON only, matching this shape exactly:",
    JSON.stringify(contract.output_schema.doc, null, 2),
    "",
    "THE FACTS:",
    ...facts.map((f, i) => `  ${i + 1}. avoid: ${f.avoid}   |   use: ${f.use}`),
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------- checks

const words = (s) =>
  String(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Every n-word run in a text, as a set — ignoring runs made mostly of the FACTS.
 *
 * The facts are identical on both sides by design: carrying (incorrect form,
 * correct form) across unchanged is the whole point of the pipeline. Counting
 * them as shared phrasing flags the subject matter instead of the expression.
 *
 * The case that exposed it: source "…'במידה ש־' ו'ככל ש־' מציינות שיעור או
 * כמות", ours "'במידה ש' ו'ככל ש' מציינות דרגה או היקף…". The six-word overlap
 * was the two forms under discussion, "and", and the obvious verb — and the two
 * texts diverge the moment they say anything (שיעור או כמות vs דרגה או היקף).
 * You cannot explain what במידה ש denotes without writing במידה ש.
 *
 * So a window counts only if at least HALF its words are not fact words. A
 * genuinely copied sentence is mostly ordinary prose and still trips; a run
 * that is mostly the shared subject does not. This narrows the check on
 * purpose — it does not disable it, and `blocking` is unchanged.
 */
function ngrams(text, n, factWords = new Set()) {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) {
    const win = w.slice(i, i + n);
    const ordinary = win.filter((x) => !factWords.has(x)).length;
    if (ordinary * 2 < n) continue;
    out.add(win.join(" "));
  }
  return out;
}

/** Every word that appears in a fact pair — the vocabulary both sides must share. */
function factVocabulary(facts) {
  const set = new Set();
  for (const f of facts) for (const w of words(`${f.avoid} ${f.use}`)) set.add(w);
  return set;
}

/** Prose the model wrote, as one string — the part that must not echo the source. */
function authoredProse(doc) {
  const parts = [doc.title ?? "", doc.intro ?? ""];
  for (const g of doc.groups ?? []) {
    parts.push(g.heading ?? "", g.why_this_group ?? "");
    for (const it of g.items ?? []) parts.push(it.reason ?? "", it.example ?? "");
  }
  return parts.join("\n");
}

/**
 * The contract's checks, run against the source held locally.
 *
 * The source is read here and compared here. It is never sent anywhere — the
 * whole point is that the model worked without it.
 */
function runChecks(contract, source, doc, facts) {
  const results = [];
  const cfg = Object.fromEntries(contract.checks.map((c) => [c.id, c]));

  // Shared phrasing. The source's own prose is everything the model never saw.
  const sourceProse = [];
  for (const s of source.sections ?? []) {
    sourceProse.push(s.heading ?? "", ...(s.paragraphs ?? []));
    for (const t of s.tables ?? []) {
      for (const row of t.rows ?? []) {
        for (const c of t.columns ?? []) if (!/שגוי|תקין/.test(c)) sourceProse.push(String(row[c] ?? ""));
      }
    }
  }
  const n = cfg.max_shared_ngram.n;
  const factWords = factVocabulary(facts);
  const mine = ngrams(authoredProse(doc), n, factWords);
  const theirs = ngrams(sourceProse.join("\n"), n, factWords);
  const shared = [...mine].filter((g) => theirs.has(g));
  results.push({
    id: "max_shared_ngram",
    n,
    passed: shared.length === 0,
    detail: shared.length ? `${shared.length} shared ${n}-word run(s): ${shared.slice(0, 5).join(" / ")}` : `no shared ${n}-word runs`,
  });

  // Facts preserved.
  const got = new Set();
  for (const g of doc.groups ?? []) for (const it of g.items ?? []) got.add(`${it.avoid}→${it.use}`);
  const lost = facts.filter((f) => !got.has(`${f.avoid}→${f.use}`));
  results.push({
    id: "facts_preserved",
    passed: lost.length === 0,
    detail: lost.length ? `${lost.length} pair(s) lost: ${lost.slice(0, 5).map((f) => f.avoid).join(", ")}` : `all ${facts.length} pair(s) carried across`,
  });

  // Order differs.
  const outOrder = [];
  for (const g of doc.groups ?? []) for (const it of g.items ?? []) outOrder.push(it.avoid);
  const sameOrder = outOrder.length === facts.length && outOrder.every((a, i) => a === facts[i].avoid);
  results.push({
    id: "order_differs",
    passed: !sameOrder,
    detail: sameOrder ? "output order reproduces the source order" : "output order differs from the source",
  });

  // No source headings reused.
  const srcHeads = new Set((source.sections ?? []).map((s) => (s.heading ?? "").trim()).filter(Boolean));
  const reused = (doc.groups ?? []).map((g) => (g.heading ?? "").trim()).filter((h) => srcHeads.has(h));
  results.push({
    id: "no_source_headings",
    passed: reused.length === 0,
    detail: reused.length ? `reused: ${reused.join(", ")}` : "no source heading reused",
  });

  return results.map((r) => ({ ...r, fails_run: cfg[r.id]?.fails_run ?? false }));
}

// ------------------------------------------------------------------ html

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(doc, meta) {
  const groups = (doc.groups ?? [])
    .map((g) => {
      // v1.1 documents carry no example or exam note; documents written before
      // it do. The columns appear only when something would go in them, so both
      // shapes render as a full table rather than one with empty cells.
      const hasExample = (g.items ?? []).some((i) => i.example);
      return `<section>
  <h2>${esc(g.heading)}</h2>
  ${g.why_this_group ? `<p class="why">${esc(g.why_this_group)}</p>` : ""}
  <table>
    <thead><tr><th>במקום</th><th>עדיף</th><th>למה</th>${hasExample ? "<th>דוגמה</th>" : ""}</tr></thead>
    <tbody>
      ${(g.items ?? [])
        .map(
          (it) => `<tr>
        <td class="avoid">${esc(it.avoid)}</td>
        <td class="use">${esc(it.use)}</td>
        <td>${esc(it.reason)}${it.exam_note ? `<div class="note">${esc(it.exam_note)}</div>` : ""}</td>
        ${hasExample ? `<td class="ex">${esc(it.example ?? "")}</td>` : ""}
      </tr>`
        )
        .join("\n")}
    </tbody>
  </table>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>${esc(doc.title)}</title>
<style>
  :root { color-scheme: light dark; --line: #dcdcdc; --avoid: #c0392b; --use: #1e8449; --dim: #6b6b6b; }
  body { font-family: "Segoe UI", Arial, sans-serif; max-width: 1080px; margin: 0 auto; padding: 28px 24px 64px; line-height: 1.75; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .intro { font-size: 15px; color: var(--dim); margin: 0 0 28px; }
  section { margin-bottom: 30px; }
  h2 { font-size: 17px; margin: 0 0 4px; }
  .why { margin: 0 0 10px; color: var(--dim); font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 14.5px; }
  th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: start; vertical-align: top; }
  th { background: #00000008; font-weight: 600; }
  td.avoid { color: var(--avoid); text-decoration: line-through; white-space: nowrap; }
  td.use { color: var(--use); font-weight: 600; white-space: nowrap; }
  td.ex { color: var(--dim); font-style: italic; }
  .note { margin-top: 6px; font-size: 13px; color: var(--dim); border-inline-start: 3px solid var(--line); padding-inline-start: 8px; }
  footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--dim); }
</style>
<h1>${esc(doc.title)}</h1>
<p class="intro">${esc(doc.intro)}</p>
${groups}
<footer>תוכן מקורי של LawPass · נכתב ${esc(meta.generated_at.slice(0, 10))} · ${meta.item_count} פריטים</footer>
</html>
`;
}

// ------------------------------------------------------------------ main

async function main() {
  if (inputs.length === 0 || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/rewrite-source.mjs <extracted.json> --out=<dir>\n" +
        "       [--contract=<path>] [--dry-run] [--force]"
    );
    process.exit(inputs.length === 0 ? 2 : 0);
  }

  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const sourcePath = resolve(inputs[0]);
  const source = JSON.parse(readFileSync(sourcePath, "utf8"));

  const { facts, withheld } = extractFacts(source);
  if (facts.length === 0) {
    console.error("no (incorrect, correct) pairs found — is this a usage guide extracted with --mode=document?");
    process.exit(1);
  }

  console.log(`contract ${contract.name} v${contract.version}`);
  console.log(`source   ${basename(sourcePath)}`);
  console.log(`\nsending to the model: ${facts.length} fact pair(s)`);
  console.log(
    `withheld:            ${withheld.explanations} explanation(s), ` +
      `${withheld.headings} heading(s), ${withheld.paragraphs} paragraph(s)`
  );

  const prompt = buildPrompt(contract, facts);

  if (dryRun) {
    console.log("\n" + "=".repeat(72));
    console.log(prompt);
    console.log("=".repeat(72));
    console.log("\ndry run: nothing was sent, nothing was written.");
    process.exit(0);
  }

  const name0 = basename(sourcePath, extname(sourcePath));
  const stem0 = join(outDir ?? dirname(sourcePath), `${name0}.lawpass`);

  if (recheck) {
    if (!existsSync(`${stem0}.json`)) {
      console.error(`\nnothing to re-check — ${stem0}.json does not exist.`);
      process.exit(1);
    }
    const existing = JSON.parse(readFileSync(`${stem0}.json`, "utf8"));
    const results = runChecks(contract, source, existing.doc, facts);
    console.log(`\nre-checking ${basename(stem0)}.json under ${contract.name} v${contract.version}`);
    console.log("(no model call, nothing charged)\n");
    let bad = false;
    for (const c of results) {
      const mark = c.passed ? "ok  " : c.fails_run ? "FAIL" : "warn";
      if (!c.passed && c.fails_run) bad = true;
      console.log(`  ${mark} ${c.id.padEnd(20)} ${c.detail}`);
    }
    const changesPath = `${stem0}.changes.json`;
    if (existsSync(changesPath)) {
      const changes = JSON.parse(readFileSync(changesPath, "utf8"));
      changes.checks = results;
      changes.rechecked_at = new Date().toISOString();
      changes.rechecked_under = `${contract.name} v${contract.version}`;
      writeFileSync(changesPath, `${JSON.stringify(changes, null, 2)}\n`, "utf8");
      console.log(`\nupdated ${basename(changesPath)}`);
    }
    process.exit(bad ? 1 : 0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set (it lives in .env.local)");
    process.exit(1);
  }

  const name = basename(sourcePath, extname(sourcePath));
  const stem = join(outDir ?? dirname(sourcePath), `${name}.lawpass`);
  if (existsSync(`${stem}.json`) && !force) {
    console.error(`\n${stem}.json already exists — pass --force to overwrite it.`);
    process.exit(1);
  }
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 15 * 60 * 1000 });

  console.log(`\nwriting with ${contract.pipeline.model} …`);
  const started = Date.now();

  // STREAMED, NOT AWAITED IN ONE PIECE. Opus 5 thinks by default and this asks
  // for 18 items of original Hebrew, so the reply takes minutes to produce. A
  // non-streaming request has to hold one HTTP response open for all of it and
  // hits the client timeout — which it did, three times over, before this was
  // changed. Streaming keeps bytes moving, and gives a progress line instead of
  // a silent wait.
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");

  let ticks = 0;
  const stream = client.messages
    .stream({
      model: contract.pipeline.model,
      max_tokens: contract.pipeline.max_tokens,
      output_config: {
        format: zodOutputFormat(DocSchema, "doc"),
        // Thinking is billed as output and was ~75% of the bill at the default
        // 'high'. These are short factual explanations of settled grammar, not
        // a reasoning problem. See pipeline.effort_note in the contract.
        ...(contract.pipeline.effort ? { effort: contract.pipeline.effort } : {}),
      },
      messages: [{ role: "user", content: prompt }],
    })
    .on("text", () => {
      // One dot per 2KB or so, purely so a long run looks alive.
      if (++ticks % 400 === 0) process.stdout.write(".");
    });

  const message = await stream.finalMessage();
  if (ticks >= 400) process.stdout.write("\n");

  // ── SPEND IS RECORDED HERE, BEFORE ANYTHING THAT CAN FAIL ──────────────────
  //
  // The tokens are already bought by the time finalMessage() returns. This used
  // to be computed further down, after the JSON parse, so a truncated reply
  // exited first and the cost of a five-minute run was simply lost — money
  // spent with no record anywhere. Anything that can fail now happens AFTER
  // this block, and every failure path writes the spend to disk on its way out.
  const rate = contract.pricing?.[contract.pipeline.model] ?? { input_per_mtok: 5, output_per_mtok: 25 };
  const u = message.usage ?? {};
  const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const outTok = u.output_tokens ?? 0;
  const cost = {
    input_tokens: inTok,
    output_tokens: outTok,
    usd: Number(((inTok / 1e6) * rate.input_per_mtok + (outTok / 1e6) * rate.output_per_mtok).toFixed(4)),
    rate,
  };
  console.log(
    `\ncost: ${cost.input_tokens} in + ${cost.output_tokens} out = ` +
      `$${cost.usd.toFixed(4)} (@ $${rate.input_per_mtok}/$${rate.output_per_mtok} per Mtok)`
  );

  /** Leave the spend on disk when the run cannot finish, then stop. */
  const abort = (outcome, detail) => {
    writeFileSync(
      `${stem}.failed.json`,
      `${JSON.stringify(
        {
          contract: `${contract.name} v${contract.version}`,
          model: contract.pipeline.model,
          attempted_at: new Date().toISOString(),
          outcome,
          detail,
          stop_reason: message.stop_reason,
          cost,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.error(`\n${detail}`);
    console.error(`spend recorded in ${basename(stem)}.failed.json — $${cost.usd.toFixed(4)} was still charged.`);
    process.exit(1);
  };

  // A truncated reply is the failure that looks like a parse bug: the JSON is
  // well formed right up to where it stops. Thinking tokens come out of the
  // same budget as the text, so this fires long before the prose is large.
  if (message.stop_reason === "max_tokens") {
    abort(
      "truncated",
      `the reply hit max_tokens (${contract.pipeline.max_tokens}) and was cut off mid-document. ` +
        `Raise pipeline.max_tokens in ${basename(contractPath)} and run again.`
    );
  }
  if (message.stop_reason === "refusal") {
    abort("refused", `the model declined (${message.stop_details?.category ?? "unknown"}).`);
  }

  const raw = message.content.find((b) => b.type === "text")?.text ?? "";
  let doc;
  try {
    doc = JSON.parse(raw.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim());
  } catch (error) {
    writeFileSync(`${stem}.raw.txt`, raw, "utf8");
    abort("unparseable", `the model did not return JSON — ${error.message}. Raw reply in ${basename(stem)}.raw.txt`);
  }

  const itemCount = (doc.groups ?? []).reduce((n, g) => n + (g.items ?? []).length, 0);

  const meta = {
    contract: `${contract.name} v${contract.version}`,
    model: contract.pipeline.model,
    generated_at: new Date().toISOString(),
    item_count: itemCount,
    cost,
  };

  console.log(
    `  ${(doc.groups ?? []).length} group(s), ${itemCount} item(s) in ` +
      `${Math.round((Date.now() - started) / 1000)}s`
  );

  // The checks read the source locally. It is not sent anywhere.
  const checks = runChecks(contract, source, doc, facts);
  console.log("\nchecks:");
  let blocked = false;
  for (const c of checks) {
    const mark = c.passed ? "ok  " : c.fails_run ? "FAIL" : "warn";
    if (!c.passed && c.fails_run) blocked = true;
    console.log(`  ${mark} ${c.id.padEnd(20)} ${c.detail}`);
  }

  writeFileSync(`${stem}.json`, `${JSON.stringify({ ...meta, doc }, null, 2)}\n`, "utf8");
  writeFileSync(`${stem}.html`, toHtml(doc, meta), "utf8");

  // The change record: what crossed the line, where it landed, what was dropped.
  // Fact pairs only, so this file carries no expression from the source.
  const changes = {
    ...meta,
    source_file: basename(sourcePath),
    withheld_from_model: {
      ...withheld,
      fields: contract.pipeline.withhold_from_model,
      rationale: contract.pipeline.withhold_rationale,
    },
    sent_to_model: { fact_pairs: facts.length, fields: contract.pipeline.send_to_model },
    reorganised_by: contract.pipeline.reorganise_by,
    checks,
    facts: facts.map((f) => {
      const group = (doc.groups ?? []).find((g) => (g.items ?? []).some((i) => i.avoid === f.avoid));
      return { avoid: f.avoid, use: f.use, moved_to: group?.heading ?? null };
    }),
  };
  writeFileSync(`${stem}.changes.json`, `${JSON.stringify(changes, null, 2)}\n`, "utf8");

  console.log(`\nwrote ${stem}.json`);
  console.log(`      ${stem}.html`);
  console.log(`      ${stem}.changes.json`);

  if (blocked) {
    console.log("\nA blocking check failed. Do not publish this until it is resolved.");
    process.exitCode = 1;
  } else {
    console.log(`\n${contract.disclaimer}`);
  }
}

export { extractFacts, buildPrompt, runChecks, ngrams };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
