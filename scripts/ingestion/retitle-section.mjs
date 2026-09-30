// retitle-section.mjs — correct a section's heading in a stored document.
//
//   node scripts/ingestion/retitle-section.mjs --id=<uuid> \
//     --index=12 --from="בקשה לביטול פסק בורר" --to="בקשה לביטול פסק בוררות"
//   ... --commit
//
// SAFE BY DEFAULT: without --commit it reports the change and writes nothing.
//
// WHY A SCRIPT AND NOT A ONE-OFF. An OCR'd booklet mis-reads headings, and a
// mis-read heading is not only a typo on screen: the contents rail groups
// entries by the words their headings share, so "בקשה למעצר עד לתום ההליכים"
// and "בקשה למעצר עד תום ההליכים" become two subjects instead of one. That will
// happen again in the next booklet.
//
// --from IS REQUIRED and is checked against what is actually at --index. An
// index that has shifted since it was read would otherwise rewrite the heading
// of a different section, and nothing downstream would notice.

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

const id = flagOf("id");
const index = flagOf("index");
const from = flagOf("from");
const to = flagOf("to");
const commit = argv.includes("--commit");

function usage(code) {
  console.log(
    "retitle-section.mjs — correct a section heading\n\n" +
      "  --id=<uuid>      the study_material row\n" +
      "  --index=<n>      which section\n" +
      "  --from=<text>    the heading as it is now, checked before writing\n" +
      "  --to=<text>      the heading it should be\n" +
      "  --commit         write it back\n"
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
  if (!id || index === null || !from || !to) {
    console.error("--id, --index, --from and --to are all required.\n");
    usage(2);
  }

  const client = await connect();
  try {
    const found = await client.query(
      `SELECT study_material_id, paper_id, lawpass_text
         FROM public.study_material WHERE study_material_id = $1`,
      [id]
    );
    if (found.rowCount === 0) {
      console.error("no such study_material row");
      process.exitCode = 1;
      return;
    }

    const row = found.rows[0];
    const payload = row.lawpass_text;
    const wrapped = payload?.doc != null;
    const doc = wrapped ? payload.doc : payload;
    const at = Number(index);
    const section = (doc.sections ?? [])[at];
    if (!section) {
      console.error(`--index=${index} is outside this document's ${doc.sections?.length ?? 0} sections`);
      process.exitCode = 1;
      return;
    }

    const current = String(section.heading ?? "").trim();
    if (current !== from.trim()) {
      console.error(`section [${at}] is '${current}', not '${from}' — refusing`);
      process.exitCode = 1;
      return;
    }
    if (current === to.trim()) {
      console.log(`section [${at}] already reads '${to}' — nothing to do.`);
      return;
    }

    console.log(`paper_id   ${row.paper_id}`);
    console.log(`[${at}]      ${current}`);
    console.log(`       →   ${to}`);

    if (!commit) {
      console.log("\ndry run — nothing written. Re-run with --commit to apply.");
      return;
    }

    const sections = doc.sections.map((s, k) => (k === at ? { ...s, heading: to } : s));
    const nextDoc = { ...doc, sections };
    const retitle = { at: new Date().toISOString(), index: at, from: current, to };
    const next = wrapped
      ? {
          ...payload,
          doc: nextDoc,
          retitled: [...(payload.retitled ?? []), retitle],
        }
      : nextDoc;

    const tmp = join(here, "tmp");
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
    writeFileSync(
      join(tmp, `${row.paper_id}.before-retitle.json`),
      JSON.stringify(payload, null, 2),
      "utf8"
    );

    await client.query(
      `UPDATE public.study_material SET lawpass_text = $1, updated_at = now()
        WHERE study_material_id = $2`,
      [JSON.stringify(next), row.study_material_id]
    );
    console.log("committed.");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
