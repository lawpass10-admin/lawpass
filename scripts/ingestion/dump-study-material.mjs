// dump-study-material.mjs — write a study_material row to tmp/ so it can be
// read and worked on. READ ONLY: it issues one SELECT and writes files on this
// machine. There is no --commit, because there is nothing to commit.
//
//   node scripts/ingestion/dump-study-material.mjs --list
//   node scripts/ingestion/dump-study-material.mjs --paper-id="<name>"
//   node scripts/ingestion/dump-study-material.mjs --id=<uuid>
//   node scripts/ingestion/dump-study-material.mjs --id=<uuid> --source
//
// WHY IT EXISTS. convert-study-material.mjs already pulls `original_text` to
// tmp/, but only as step one of a conversion it then runs and pays for. Fixing
// what is ALREADY stored — a running header that came through extraction, a
// contents section the reader duplicates — needs the text and nothing else.
// Doing that by starting a conversion is expensive and misleading.
//
// IT DUMPS `lawpass_text` BY DEFAULT, not `original_text`, and that is the
// difference that matters here. lawpass_text is what /study-material serves, so
// it is what a reader is complaining about. `--source` dumps original_text
// instead, which for a booklet held under `pending_legal_review` is the same
// text arrived at differently — see migration 20260930000001.
//
// Writes `<paper_id>.lawpass.json` (or `.source.json`), the same names the
// converter and loader use, so a cleaned file drops straight back into the
// pipeline those scripts already have.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const paperId = flagOf("paper-id");
const id = flagOf("id");
const textField = flagOf("text-field") ?? "open_questions";
const wantSource = argv.includes("--source");
const list = argv.includes("--list");

function usage(code) {
  console.log(
    "dump-study-material.mjs — write a study_material row to tmp/ (read only)\n\n" +
      "  --list                 every row: id, paper_id, which texts it has\n" +
      "  --paper-id=<name>      the row to dump\n" +
      "  --id=<uuid>            …or by study_material_id (what the URL carries)\n" +
      "  --text-field=<field>   default open_questions\n" +
      "  --source               dump original_text instead of lawpass_text\n"
  );
  process.exit(code);
}

/** Same two-URL strategy the other ingestion scripts use: direct first for
 *  speed, the Supavisor pooler when the direct host does not resolve. */
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

/** A document's sections, counted — enough to tell at a glance whether the dump
 *  holds what the screen showed. */
function describe(doc) {
  if (!doc || typeof doc !== "object") return "not an object";
  if (Array.isArray(doc.sections)) {
    return `sections: ${doc.sections.length}, paragraphs: ${doc.sections.reduce(
      (n, s) => n + (Array.isArray(s.paragraphs) ? s.paragraphs.length : 0),
      0
    )}`;
  }
  if (Array.isArray(doc.groups)) {
    return `groups: ${doc.groups.length}, items: ${doc.groups.reduce(
      (n, g) => n + (Array.isArray(g.items) ? g.items.length : 0),
      0
    )}`;
  }
  return `keys: ${Object.keys(doc).join(", ")}`;
}

async function main() {
  if (argv.includes("--help")) usage(0);
  if (!list && !paperId && !id) {
    console.error("one of --list, --paper-id or --id is required.\n");
    usage(2);
  }

  const client = await connect();
  try {
    if (list) {
      const rows = await client.query(
        `SELECT study_material_id, paper_id, text_field,
                original_text IS NOT NULL AS has_source,
                lawpass_text  IS NOT NULL AS has_lawpass,
                lawpass_text->'provenance'->>'publication' AS publication
           FROM public.study_material
          ORDER BY paper_id`
      );
      for (const r of rows.rows) {
        console.log(
          `${r.study_material_id}  ${r.paper_id}  [${r.text_field}]  ` +
            `source=${r.has_source ? "y" : "n"} lawpass=${r.has_lawpass ? "y" : "n"} ` +
            `publication=${r.publication ?? "approved (default)"}`
        );
      }
      console.log(`\n${rows.rowCount} row(s).`);
      return;
    }

    const where = id ? "study_material_id = $1" : "paper_id = $1 AND text_field = $2";
    const args = id ? [id] : [paperId, textField];
    const found = await client.query(
      `SELECT study_material_id, paper_id, text_field, original_text, lawpass_text
         FROM public.study_material
        WHERE ${where}`,
      args
    );
    if (found.rowCount === 0) {
      console.error(`no study_material row for ${id ? `id='${id}'` : `paper_id='${paperId}'`}`);
      process.exitCode = 1;
      return;
    }

    const row = found.rows[0];
    const payload = wantSource ? row.original_text : row.lawpass_text;
    if (payload == null) {
      console.error(
        `row has no ${wantSource ? "original_text" : "lawpass_text"} — nothing to dump`
      );
      process.exitCode = 1;
      return;
    }

    const tmp = join(here, "tmp");
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
    const outPath = join(tmp, `${row.paper_id}${wantSource ? ".source" : ".lawpass"}.json`);
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    // The doc is nested under `doc` when rewrite-source.mjs wrote the row, and
    // is the whole payload when something else did. Both are reported rather
    // than guessed at, because which one it is says how the row was produced.
    const doc = payload.doc ?? payload;
    console.log(`paper_id     ${row.paper_id}`);
    console.log(`id           ${row.study_material_id}`);
    console.log(`text_field   ${row.text_field}`);
    console.log(`shape        ${payload.doc ? "wrapped ({ doc, … })" : "bare document"}`);
    console.log(`contents     ${describe(doc)}`);
    console.log(`written      ${outPath}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
