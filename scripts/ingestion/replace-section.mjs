// replace-section.mjs — swap a section of a stored study_material document for
// a guide written by rewrite-source.mjs.
//
//   node scripts/ingestion/replace-section.mjs --id=<uuid> \
//     --heading="דברי הסבר" --with=tmp/<guide>.lawpass.json            # dry run
//   ... --commit
//
// SAFE BY DEFAULT: without --commit it reports the swap in full and writes
// nothing. With it, the pre-swap document is written to tmp/ first.
//
// WHY THIS EXISTS. convert-study-material.mjs replaces a row's WHOLE
// lawpass_text with a conversion. That is right when the conversion covers the
// document. It is wrong here: חוברת הדוגמאות is 113 sections of worked examples
// and one section of instructional prose, and only the prose has been converted.
// Overwriting the row would throw away the examples; leaving it alone would keep
// serving the prose. So the guide is grafted into the place the prose held.
//
// SHAPES. The guide is stages — {heading, why_this_stage, rules[{requirement,
// do, pitfall}]} — and the document is sections — {heading, paragraphs[],
// tables[]}. The reader renders sections, so the stages are flattened into
// them: one section per stage, its rules written out as labelled paragraphs.
// `do` and `pitfall` get a Hebrew label each, because paragraphs render as
// plain <p> with no styling of their own and three unlabelled paragraphs in a
// row read as one undifferentiated block.
//
// ONE SECTION BECOMES SEVERAL, and that is deliberate. The reader builds its
// contents rail from sections that have a heading, so the stage names become
// navigable — which is the point of organising by the candidate's workflow. The
// first replacement keeps the original heading so the document's outline still
// has the landmark it had.
//
// IT RECORDS THE GRAFT. A document that was loaded verbatim and now carries
// authored text in the middle of it is a different object, and the row says so:
// `authored_sections` names which headings are LawPass's own, under which
// contract and model. Nothing else can tell them apart by looking.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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
const paperId = flagOf("paper-id");
const heading = flagOf("heading");
// Position, for a document with several sections under one heading. חוברת
// הדוגמאות has nine headed "דגשים", one per worked example, so a heading match
// would always land on the first.
const index = flagOf("index");
// One section out instead of one per stage. A דגשים is a short note attached to
// an example, not a booklet section: expanding it into stage headings would put
// three new entries in the contents rail for every note in the book.
const flat = argv.includes("--flat");
const guidePath = flagOf("with");
const commit = argv.includes("--commit");

/** Labels for the two authored fields. Short, so they read as a lead-in rather
 *  than as a form. */
const DO_LABEL = "מה לעשות:";
const PITFALL_LABEL = "איפה נופלים:";

function usage(code) {
  console.log(
    "replace-section.mjs — swap a document section for a converted guide\n\n" +
      "  --id=<uuid>            the study_material row\n" +
      "  --paper-id=<name>      …or by name\n" +
      "  --heading=<text>       the section to replace, matched exactly\n" +
      "  --index=<n>            …or by position, for repeated headings\n" +
      "  --flat                 one section out, stages flattened into paragraphs\n" +
      "  --with=<file.json>     a guide written by rewrite-source.mjs\n" +
      "  --commit               write it back\n"
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

/**
 * The guide's stages as document sections.
 *
 * The first one carries the original heading and the guide's own intro, so the
 * document keeps the landmark the replaced section gave it; the rest are the
 * stages, in the order the guide put them.
 */
/**
 * The guide as ONE section, keeping the heading it replaces.
 *
 * A stage heading becomes a paragraph of its own, and only when there is more
 * than one stage — a single-stage guide is a list, and giving it a heading would
 * be a label on the only thing present.
 */
function flatSectionFromGuide(guideDoc, originalHeading) {
  const paragraphs = [];
  if (guideDoc.intro) paragraphs.push(guideDoc.intro);
  const stages = guideDoc.stages ?? [];
  for (const stage of stages) {
    if (stages.length > 1 && stage.heading) paragraphs.push(stage.heading);
    if (stage.why_this_stage) paragraphs.push(stage.why_this_stage);
    for (const rule of stage.rules ?? []) {
      if (rule.requirement) paragraphs.push(rule.requirement);
      if (rule.do) paragraphs.push(`${DO_LABEL} ${rule.do}`);
      if (rule.pitfall) paragraphs.push(`${PITFALL_LABEL} ${rule.pitfall}`);
    }
  }
  return [{ id: "lawpass-flat", heading: originalHeading, paragraphs, tables: [] }];
}

function sectionsFromGuide(guideDoc, originalHeading) {
  const sections = [
    {
      id: "lawpass-intro",
      heading: originalHeading,
      paragraphs: [guideDoc.title, guideDoc.intro].filter(Boolean),
      tables: [],
    },
  ];

  for (const stage of guideDoc.stages ?? []) {
    const paragraphs = [];
    if (stage.why_this_stage) paragraphs.push(stage.why_this_stage);
    for (const rule of stage.rules ?? []) {
      if (rule.requirement) paragraphs.push(rule.requirement);
      if (rule.do) paragraphs.push(`${DO_LABEL} ${rule.do}`);
      if (rule.pitfall) paragraphs.push(`${PITFALL_LABEL} ${rule.pitfall}`);
    }
    sections.push({
      id: `lawpass-${stage.id ?? sections.length}`,
      heading: stage.heading ?? "",
      paragraphs,
      tables: [],
    });
  }

  return sections;
}

async function main() {
  if (argv.includes("--help")) usage(0);
  if ((!id && !paperId) || (!heading && !index) || !guidePath) {
    console.error("--id (or --paper-id), --heading and --with are all required.\n");
    usage(2);
  }
  if (!existsSync(guidePath)) {
    console.error(`--with: no such file — ${guidePath}`);
    process.exit(2);
  }

  const guide = JSON.parse(readFileSync(guidePath, "utf8"));
  const guideDoc = guide.doc ?? guide;
  if (!Array.isArray(guideDoc.stages) || guideDoc.stages.length === 0) {
    console.error(`${guidePath} has no stages[] — is it a procedure_guide run?`);
    process.exit(2);
  }

  const client = await connect();
  try {
    const where = id ? "study_material_id = $1" : "paper_id = $1";
    const found = await client.query(
      `SELECT study_material_id, paper_id, lawpass_text
         FROM public.study_material
        WHERE ${where}`,
      [id ?? paperId]
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
    const at = index
      ? Number(index)
      : (doc.sections ?? []).findIndex(
          (s) => String(s.heading ?? "").trim() === heading.trim()
        );
    if (!Number.isInteger(at) || at < 0 || at >= (doc.sections ?? []).length) {
      console.error(
        index
          ? `--index=${index} is outside this document's ${doc.sections?.length ?? 0} section(s)`
          : `no section headed '${heading}' in this document`
      );
      process.exitCode = 1;
      return;
    }
    // A wrong index silently rewrites the wrong part of the book, so when both
    // are given the heading is checked against what is actually there.
    if (index && heading && String(doc.sections[at].heading ?? "").trim() !== heading.trim()) {
      console.error(
        `section [${at}] is '${doc.sections[at].heading}', not '${heading}' — refusing`
      );
      process.exitCode = 1;
      return;
    }

    const replaced = doc.sections[at];
    const incoming = flat
      ? flatSectionFromGuide(guideDoc, replaced.heading)
      : sectionsFromGuide(guideDoc, replaced.heading);
    const sections = [...doc.sections.slice(0, at), ...incoming, ...doc.sections.slice(at + 1)];
    const nextDoc = { ...doc, sections };
    if (typeof doc.section_count === "number") nextDoc.section_count = sections.length;

    console.log(`paper_id   ${row.paper_id}`);
    console.log(`replacing  [${at}] ${replaced.heading} (${replaced.paragraphs?.length ?? 0} paragraphs)`);
    console.log(`with       ${incoming.length} section(s) from ${guide.model ?? "a guide"}:`);
    for (const s of incoming) {
      console.log(`             + ${s.heading}  (${s.paragraphs.length} paragraphs)`);
    }
    console.log(`sections   ${doc.sections.length} → ${sections.length}`);

    if (!commit) {
      console.log("\ndry run — nothing written. Re-run with --commit to apply.");
      return;
    }

    const tmp = join(here, "tmp");
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
    const backup = join(tmp, `${row.paper_id}.before-graft.json`);
    writeFileSync(backup, JSON.stringify(payload, null, 2), "utf8");

    const authored = {
      at: new Date().toISOString(),
      by: "scripts/ingestion/replace-section.mjs",
      replaced_heading: replaced.heading,
      // Which headings in this document are LawPass's own text. Nothing else in
      // the row distinguishes them from the verbatim material around them.
      headings: incoming.map((s) => s.heading),
      contract: guide.contract ?? null,
      model: guide.model ?? null,
      cost: guide.cost ?? null,
      requirements_from: guidePath,
    };

    const next = wrapped
      ? {
          ...payload,
          doc: nextDoc,
          authored_sections: [...(payload.authored_sections ?? []), authored],
        }
      : nextDoc;

    await client.query(
      `UPDATE public.study_material
          SET lawpass_text = $1, updated_at = now()
        WHERE study_material_id = $2`,
      [JSON.stringify(next), row.study_material_id]
    );

    console.log(`\nbackup     ${backup}`);
    console.log("committed.");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
