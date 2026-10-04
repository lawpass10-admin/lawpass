// apply-study-material.mjs — write an edited study_material document back.
//
//   node scripts/ingestion/apply-study-material.mjs --id=<uuid> --file=<edited.json>
//   node scripts/ingestion/apply-study-material.mjs --id=<uuid> --file=<edited.json> --commit
//
// SAFE BY DEFAULT: without --commit it connects, compares the file against what
// is stored, prints the section/paragraph delta and a sample of changed lines,
// and writes nothing.
//
// WHY IT EXISTS. dump-study-material.mjs pulls `lawpass_text` to tmp/ so a
// stored document can be read and repaired, but there was no way to put the
// repaired file back — clean-study-material.mjs only applies its own built-in
// rules. Fixing text by hand (or by script) and returning it is the other half
// of that loop.
//
// It takes a timestamped backup of the CURRENT stored value into
// scripts/ingestion/backups/ before it overwrites, so a bad apply is one file
// copy away from being undone.
//
// Writes `lawpass_text`, the column /study-material serves — not
// `original_text`, which is the pre-conversion record and is left untouched.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
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

const id = flagOf("id");
const file = flagOf("file");
const commit = argv.includes("--commit");

function usage(code) {
  console.log(
    "apply-study-material.mjs — write an edited document back to study_material\n\n" +
      "  --id=<uuid>      the study_material row (what the URL carries)\n" +
      "  --file=<path>    the edited JSON, same shape dump-study-material.mjs wrote\n" +
      "  --commit         actually write it (default: report only)\n"
  );
  process.exit(code);
}

if (argv.includes("--help")) usage(0);
if (!id || !file) {
  console.error("both --id and --file are required.\n");
  usage(2);
}

/** Same two-URL strategy the other ingestion scripts use. */
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

const shapeOf = (payload) => {
  const doc = payload.doc ?? payload;
  const sections = doc.sections ?? [];
  return {
    sections: sections.length,
    paragraphs: sections.reduce((n, s) => n + (s.paragraphs?.length ?? 0), 0),
  };
};

/** Every paragraph as "si.pi" -> text, so the two versions can be lined up. */
function index(payload) {
  const doc = payload.doc ?? payload;
  const map = new Map();
  (doc.sections ?? []).forEach((s, si) =>
    (s.paragraphs ?? []).forEach((p, pi) =>
      map.set(`${si}.${pi}`, typeof p === "string" ? p : (p.text ?? JSON.stringify(p)))
    )
  );
  return map;
}

async function main() {
  const next = JSON.parse(readFileSync(file, "utf8"));

  const client = await connect();
  try {
    const found = await client.query(
      `SELECT study_material_id, paper_id, lawpass_text
         FROM public.study_material
        WHERE study_material_id = $1`,
      [id]
    );
    if (found.rowCount === 0) {
      console.error(`no study_material row for id='${id}'`);
      process.exitCode = 1;
      return;
    }

    const row = found.rows[0];
    const current = row.lawpass_text;
    if (current == null) {
      console.error("row has no lawpass_text — refusing to apply over nothing");
      process.exitCode = 1;
      return;
    }

    const a = shapeOf(current);
    const b = shapeOf(next);
    console.log(`paper_id     ${row.paper_id}`);
    console.log(`id           ${row.study_material_id}`);
    console.log(`stored       sections ${a.sections}, paragraphs ${a.paragraphs}`);
    console.log(`incoming     sections ${b.sections}, paragraphs ${b.paragraphs}`);

    if (b.sections !== a.sections) {
      console.error(
        `\nREFUSING: section count changed (${a.sections} -> ${b.sections}). ` +
          `This script repairs text; it does not restructure documents.`
      );
      process.exitCode = 1;
      return;
    }

    const before = index(current);
    const after = index(next);
    let changed = 0;
    const samples = [];
    for (const [k, v] of before) {
      const w = after.get(k);
      if (w === undefined) continue;
      if (w !== v) {
        changed++;
        if (samples.length < 8) samples.push({ k, v, w });
      }
    }
    const removed = before.size - after.size;

    console.log(`paragraphs removed  ${removed}`);
    console.log(`paragraphs reworded ${changed}`);
    if (samples.length) {
      console.log(`\nsample of reworded paragraphs:`);
      for (const s of samples) {
        console.log(`  [${s.k}]`);
        console.log(`    -  ${s.v.slice(0, 110)}`);
        console.log(`    +  ${s.w.slice(0, 110)}`);
      }
    }

    if (!commit) {
      console.log("\ndry run — nothing written. Re-run with --commit to apply.");
      return;
    }

    const backups = join(here, "backups");
    if (!existsSync(backups)) mkdirSync(backups, { recursive: true });
    const backupPath = join(backups, `${row.study_material_id}-lawpass-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify(current, null, 2), "utf8");
    console.log(`\nbackup of current value  ${backupPath}`);

    const res = await client.query(
      `UPDATE public.study_material
          SET lawpass_text = $1, updated_at = now()
        WHERE study_material_id = $2`,
      [next, row.study_material_id]
    );
    console.log(`committed — ${res.rowCount} row updated.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
