// convert-study-material.mjs — take a study_material row's source, convert it
// under LLM-text-converting, and write the result to lawpass_text.
//
//   node scripts/ingestion/convert-study-material.mjs --paper-id="<name>"          # dry run
//   node scripts/ingestion/convert-study-material.mjs --paper-id="<name>" --commit
//   node scripts/ingestion/convert-study-material.mjs --paper-id="<name>" --reconvert --commit
//
// WHAT IT CHAINS. The three steps that were being run by hand, in one command
// and in the only order that is safe:
//
//   1. read `original_text` for the row and write it to tmp/ (the converter
//      reads a file; the source never leaves this machine either way)
//   2. run rewrite-source.mjs over it — the model sees only the unprotectable
//      core, and the contract's four checks must pass
//   3. write the result to `lawpass_text` for that row
//
// Step 3 does not run unless step 2 exited 0. That is the point of chaining
// them: a conversion whose checks failed must not reach the column that feeds
// study_material_public, and the gap between "the run failed" and "somebody
// loaded it anyway" is exactly where that goes wrong.
//
// SAFE BY DEFAULT. Without --commit nothing is written to the database, and the
// conversion is still shown in full so it can be read before it is stored.
//
// IT NEVER WRITES VERBATIM SOURCE. Whatever this script puts in lawpass_text
// came out of the contract, carries its version and the model's name, and
// passed the checks. Copying a source unchanged into that column is a different
// operation with different consequences and lives behind
// `load-study-material.mjs --verbatim`, which holds the row out of the
// candidate view until someone clears it.
//
// WHAT IT CANNOT DO, and this is the important limit. The contract is
// `source_kind: "usage_guide"` — it converts tables of (incorrect, correct)
// pairs. For חוברת מיקוד בניסוח משפטי that is 29 pairs out of an 88-section
// booklet: the three language tables, and nothing else. The other 888
// paragraphs are instructional prose, and v1.2 has no notion of what their
// unprotectable core is, so it neither converts them nor pretends to. A booklet
// converted by this script publishes a language guide derived from it — not the
// booklet. Anything more needs a contract that does not exist yet.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};

const paperId = flagOf("paper-id");
const textField = flagOf("text-field") ?? "open_questions";
const commit = argv.includes("--commit");
// Re-run the model even though a conversion already exists on disk. Off by
// default because a conversion costs real money and the one already written is
// usually the one wanted — restoring a row does not need a new run.
const reconvert = argv.includes("--reconvert");
// Replace a lawpass_text that is already stored. The same rule the other
// loaders follow: published text is not overwritten by accident.
const refresh = argv.includes("--refresh");

const TEXT_FIELDS = ["diuni", "mahoti", "open_questions"];

function usage(code) {
  console.log(
    "usage: node scripts/ingestion/convert-study-material.mjs \\\n" +
      `         --paper-id="<row's paper_id>" [--text-field=<${TEXT_FIELDS.join("|")}>]\n\n` +
      "  --commit     write lawpass_text; without it nothing is stored\n" +
      "  --reconvert  run the model again instead of reusing the conversion on disk\n" +
      "  --refresh    replace a lawpass_text that is already present\n"
  );
  process.exit(code);
}

async function connect() {
  const direct = process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!direct && !pooled) throw new Error("neither DIRECT_URL nor DATABASE_URL is set");

  for (const url of [direct, pooled].filter(Boolean)) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      if (err.code !== "ENOTFOUND" && err.code !== "EAI_AGAIN") throw err;
    }
  }
  throw new Error("no reachable database host");
}

async function main() {
  if (argv.includes("--help")) usage(0);
  if (!paperId) {
    console.error("--paper-id is required.\n");
    usage(2);
  }
  if (!TEXT_FIELDS.includes(textField)) {
    console.error(`--text-field must be one of ${TEXT_FIELDS.join(", ")} (got '${textField}')`);
    process.exit(2);
  }

  const tmp = join(here, "tmp");
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
  const sourcePath = join(tmp, `${paperId}.json`);
  const convertedPath = join(tmp, `${paperId}.lawpass.json`);

  const client = await connect();
  let row;
  try {
    const found = await client.query(
      `SELECT study_material_id, original_text, lawpass_text IS NOT NULL AS has_lawpass,
              lawpass_text->>'contract' AS current_contract
         FROM public.study_material
        WHERE paper_id = $1 AND text_field = $2`,
      [paperId, textField]
    );
    if (found.rowCount === 0) {
      console.error(`no study_material row for paper_id='${paperId}', text_field='${textField}'`);
      process.exitCode = 1;
      return;
    }
    row = found.rows[0];
  } finally {
    // The conversion step can take minutes; holding a connection open across it
    // would be a pooler slot spent doing nothing.
    await client.end();
  }

  console.log(`row      ${row.study_material_id}`);
  console.log(`paper_id ${paperId}  (text_field=${textField})`);
  console.log(
    `current  lawpass_text: ${
      row.has_lawpass ? row.current_contract ?? "present" : "none yet"
    }\n`
  );

  // ── 1. the source, as a file for the converter ────────────────────────────
  writeFileSync(sourcePath, `${JSON.stringify(row.original_text, null, 2)}\n`, "utf8");
  const sections = Array.isArray(row.original_text?.sections)
    ? row.original_text.sections.length
    : 0;
  console.log(`1. source written — ${sections} section(s) -> ${sourcePath}`);

  // ── 2. the conversion ─────────────────────────────────────────────────────
  if (existsSync(convertedPath) && !reconvert) {
    console.log(`2. conversion reused — ${convertedPath}`);
    console.log("   (pass --reconvert to run the model again; it costs a real run)\n");
  } else {
    console.log("2. converting — this calls the model and costs money …\n");
    const run = spawnSync(
      process.execPath,
      [join(here, "rewrite-source.mjs"), sourcePath, `--out=${tmp}`, ...(reconvert ? ["--force"] : [])],
      { stdio: "inherit" }
    );
    // A non-zero exit means the contract's checks failed, or the run did. Either
    // way the output must not be stored — that is the whole reason this script
    // chains the steps instead of leaving them to be run separately.
    if (run.status !== 0) {
      console.error(`\nconversion failed (exit ${run.status}) — nothing will be written.`);
      process.exitCode = 1;
      return;
    }
  }

  if (!existsSync(convertedPath)) {
    console.error(`\nno conversion at ${convertedPath} — nothing to store.`);
    process.exitCode = 1;
    return;
  }
  const converted = JSON.parse(readFileSync(convertedPath, "utf8"));

  // A converted document must carry the contract that made it. Refusing here
  // stops a hand-edited or verbatim file being loaded through the safe path.
  if (!converted.contract || !converted.doc) {
    console.error(
      `\n${convertedPath} is not a conversion (no contract/doc) — refusing to store it.`
    );
    process.exitCode = 1;
    return;
  }

  const groups = Array.isArray(converted.doc.groups) ? converted.doc.groups.length : 0;
  const items = Array.isArray(converted.doc.groups)
    ? converted.doc.groups.reduce((n, g) => n + (g.items?.length ?? 0), 0)
    : 0;
  console.log(
    `\n3. to store: ${converted.contract}, ${groups} group(s), ${items} item(s)` +
      `${converted.cost ? `, $${converted.cost.usd}` : ""}`
  );
  if (sections > 0 && items > 0) {
    console.log(
      `   NOTE: the source has ${sections} section(s); this conversion covers the ` +
        `usage tables in it, not the prose.`
    );
  }

  // ── 3. store it ───────────────────────────────────────────────────────────
  if (row.has_lawpass && !refresh) {
    console.log(
      `\n   lawpass_text is already present (${row.current_contract ?? "unknown"}).` +
        `\n   Pass --refresh to replace it. Nothing written.`
    );
    return;
  }

  if (!commit) {
    console.log("\nDRY RUN — nothing written. Pass --commit to store it.");
    return;
  }

  const writer = await connect();
  try {
    await writer.query("BEGIN");
    await writer.query(
      `UPDATE public.study_material SET lawpass_text = $2::jsonb WHERE study_material_id = $1`,
      [row.study_material_id, JSON.stringify(converted)]
    );
    await writer.query("COMMIT");
    console.log("\nCOMMITTED — lawpass_text updated.");
    console.log(
      "This row is now candidate-visible through study_material_public " +
        "(it carries no publication hold)."
    );
  } catch (error) {
    await writer.query("ROLLBACK").catch(() => {});
    console.error(`\nFAILED — rolled back, nothing written.\n${error.message}`);
    process.exitCode = 1;
  } finally {
    await writer.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
