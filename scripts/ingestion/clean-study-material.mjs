// clean-study-material.mjs — remove extraction artefacts from a stored
// study_material document.
//
//   node scripts/ingestion/clean-study-material.mjs --id=<uuid>            # dry run
//   node scripts/ingestion/clean-study-material.mjs --id=<uuid> --commit
//
// SAFE BY DEFAULT: without --commit it connects, reports every line it would
// remove, and writes nothing.
//
// WHAT IT REMOVES, and why these two and nothing else:
//
//   1. A section headed "תוכן עניינים". The booklet has a printed contents
//      page, and the extractor read it as a section like any other — so the
//      reader shows the document's own contents INSIDE the document, under the
//      contents rail it already builds from the headings. Two tables of
//      contents, one of them unclickable.
//
//   2. Running page footers: "ספר הדוגמאות בניסוח | 12 | מועד קיץ 2026". These
//      are page furniture that the PDF repeats on every page, and they land
//      mid-section wherever a page happened to break — so a paragraph of a
//      worked example is interrupted by a page number.
//
// THE PATTERN MATCHES A WHOLE PARAGRAPH, never a substring, and that is
// load-bearing rather than fussy. The phrase "ספר הדוגמאות" also appears inside
// the opening sentence of דברי הסבר, which is real text: "…ומומלץ לעיין גם
// בספר הדוגמאות שלפניכם". A substring match would cut a hole in it. On this
// document the anchored pattern hits 57 paragraphs and leaves that one alone;
// the dry run prints both numbers so a change in the booklet cannot quietly
// widen the match.
//
// IT DOES NOT CONVERT ANYTHING. Removing furniture is not the same operation as
// rewriting prose under LLM-text-converting, and this script must never be
// mistaken for it. Sections whose text is someone else's expression are still
// exactly that after this runs — see convert-study-material.mjs.
//
// IDEMPOTENT: a second run finds nothing to remove and reports so.

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
const paperId = flagOf("paper-id");
const textField = flagOf("text-field") ?? "open_questions";
const commit = argv.includes("--commit");

/**
 * Headings that are the document's own contents page.
 *
 * Both spellings, because the booklet prints one and the reader's rail is
 * labelled with the other, and a future extraction could produce either.
 */
const CONTENTS_HEADINGS = ["תוכן עניינים", "תוכן העניינים"];

/**
 * A running footer, anchored to the whole paragraph.
 *
 * Deliberately loose about the numbers and the season — "מועד קיץ 2026" today,
 * "מועד חורף 2027" in the next edition — and strict about the shape, so it
 * cannot match a sentence that merely mentions the booklet.
 */
const FOOTER = /^\s*ספר הדוגמאות בניסוח\s*\|\s*\d+\s*\|\s*מועד\s+\S+\s+\d{4}\s*$/;

/**
 * The OCR's own marker for text it could not read.
 *
 * Stripped rather than kept: it tells a candidate nothing they can act on, and
 * in the middle of a worked pleading it reads as part of the document being
 * demonstrated. Where the marker IS the whole paragraph, the paragraph goes.
 */
const ILLEGIBLE = /\[\s*לא\s+קריא[^\]]*\]/g;

/**
 * The booklet's running head, in the two halves the extractor split it into:
 * the edition line, and the masthead word beside it.
 *
 * Both are page furniture like FOOTER above, and both land mid-section wherever
 * a page happened to break. The masthead is matched in its mangled spellings
 * too — the OCR read "המתמחה" as "ה/אתמחה" on at least one page — because a
 * misread artefact is still an artefact.
 *
 * Anchored to the WHOLE paragraph, so a sentence that mentions the edition in
 * passing is untouched.
 */
const EDITION_LINE = /^\s*מהדור[הת]\s+\S+\s+\d{4}(\s+ה?\/?[אמ]?תמחה)?\s*$/;
// "המתמחה" as the OCR variously read it: "תמחה", "התמחה", "ה/תמחה", "ה/אתמחה".
// The first pass required a מ or א before "תמחה" and so left five of them.
const MASTHEAD = /^\s*ה?\/?[אמ]?תמחה\s*$/;

/** Hyphen variants and runs of space, flattened, so two spellings of one
 *  heading compare equal: "על-תנאי" and "על־תנאי" are the same title. */
function normHeading(text) {
  return String(text ?? "")
    .replace(/[־‐-―-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same length, at most one character different — "בקשה למעצר…" against
 *  "בקשת למעצר…", which is one OCR slip rather than two sections. */
function nearlySame(a, b) {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let at = 0; at < a.length; at += 1) {
    if (a[at] !== b[at] && (differences += 1) > 1) return false;
  }
  return true;
}

/** How far ahead a repeat of a title may appear and still be the same title. */
const TITLE_ECHO_WINDOW = 3;

function usage(code) {
  console.log(
    "clean-study-material.mjs — remove extraction artefacts from a stored document\n\n" +
      "  --id=<uuid>            the row (what /study-material/<id> carries)\n" +
      "  --paper-id=<name>      …or by name\n" +
      "  --text-field=<field>   default open_questions\n" +
      "  --commit               write the cleaned document back\n"
  );
  process.exit(code);
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

/**
 * Returns the cleaned document plus a report of what came out. The input is not
 * mutated: the caller still holds the original for the backup it writes.
 */
/**
 * Is this section a printed title the extractor turned into a section of its
 * own — rather than a section?
 *
 * The booklet prints a document type as a page title and again as a running
 * head, and a title that falls across a page break arrives in pieces. All of
 * them come through with a heading and NO content: "כתב" then "ערעור" then the
 * real "כתב ערעור", or "עתירה מינהלית" twice over. In the body they read as
 * duplicate headings stacked with nothing between them; in the contents rail
 * they are entries that lead to a heading with nothing under it.
 *
 * So: empty, AND its title said again close by — identically, as part of a
 * longer title, or one OCR slip away. An empty heading that is NOT echoed is
 * left alone, because that is a chapter divider doing its job.
 */
function isEchoedTitle(sections, at) {
  const section = sections[at];
  const heading = normHeading(section.heading);
  if (!heading) return false;
  if ((section.paragraphs ?? []).length > 0 || (section.tables ?? []).length > 0) return false;

  for (let ahead = at + 1; ahead <= at + TITLE_ECHO_WINDOW && ahead < sections.length; ahead += 1) {
    const other = normHeading(sections[ahead].heading);
    if (!other) continue;
    if (other === heading || other.includes(heading) || nearlySame(other, heading)) return true;
  }
  return false;
}

function clean(doc) {
  const removedSections = [];
  const removedParagraphs = [];
  const removedHeaders = [];
  const removedEchoes = [];
  const strippedMarkers = [];
  const keptMentions = [];

  const all = doc.sections ?? [];
  const sections = [];
  for (const [index, section] of all.entries()) {
    const heading = String(section.heading ?? "").trim();
    if (CONTENTS_HEADINGS.includes(heading)) {
      removedSections.push({ index, heading, paragraphs: section.paragraphs?.length ?? 0 });
      continue;
    }
    if (isEchoedTitle(all, index)) {
      removedEchoes.push({ index, heading });
      continue;
    }

    const paragraphs = [];
    for (const paragraph of section.paragraphs ?? []) {
      if (FOOTER.test(paragraph)) {
        removedParagraphs.push({ index, heading, text: paragraph.trim() });
        continue;
      }

      // The marker comes off FIRST, because the two inline cases in this
      // booklet are running-head lines with a marker embedded in them —
      // "מהדורת קיץ 2026 [לא קריא]". Stripping first lets what is left be
      // recognised as the header it is, instead of surviving as a fragment.
      let text = paragraph;
      if (ILLEGIBLE.test(text)) {
        ILLEGIBLE.lastIndex = 0;
        strippedMarkers.push({ index, heading, text: paragraph.trim().slice(0, 60) });
        text = text.replace(ILLEGIBLE, "").replace(/[ \t]{2,}/g, " ").trim();
      }
      ILLEGIBLE.lastIndex = 0;

      if (text === "" || EDITION_LINE.test(text) || MASTHEAD.test(text)) {
        // Empty means the marker WAS the paragraph. Either way nothing a
        // candidate can read is being thrown away.
        removedHeaders.push({ index, heading, text: paragraph.trim() || "(marker only)" });
        continue;
      }
      // Anything that names the booklet but is not a footer is real text. It is
      // counted and shown so the run can be checked by eye rather than trusted.
      if (paragraph.includes("ספר הדוגמאות")) {
        keptMentions.push({ index, heading, text: paragraph.trim().slice(0, 80) });
      }
      // `text`, not `paragraph`: a line that kept its words but lost a marker
      // goes back in stripped.
      paragraphs.push(text);
    }
    sections.push({ ...section, paragraphs });
  }

  const cleaned = { ...doc, sections };
  // The extractor's own tally travels with the document; leaving it at 114 next
  // to 113 sections would make the metadata lie about the thing it describes.
  if (typeof doc.section_count === "number") cleaned.section_count = sections.length;

  return {
    cleaned,
    removedSections,
    removedParagraphs,
    removedHeaders,
    removedEchoes,
    strippedMarkers,
    keptMentions,
  };
}

async function main() {
  if (argv.includes("--help")) usage(0);
  if (!id && !paperId) {
    console.error("one of --id or --paper-id is required.\n");
    usage(2);
  }

  const client = await connect();
  try {
    const where = id ? "study_material_id = $1" : "paper_id = $1 AND text_field = $2";
    const args = id ? [id] : [paperId, textField];
    const found = await client.query(
      `SELECT study_material_id, paper_id, lawpass_text
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
    const payload = row.lawpass_text;
    if (!payload) {
      console.error("row has no lawpass_text — nothing to clean");
      process.exitCode = 1;
      return;
    }
    // Written by rewrite-source.mjs as { doc, … }; a verbatim load is the bare
    // document. Both shapes are handled so the caller does not have to know.
    const wrapped = payload.doc != null;
    const doc = wrapped ? payload.doc : payload;

    const {
      cleaned,
      removedSections,
      removedParagraphs,
      removedHeaders,
      removedEchoes,
      strippedMarkers,
      keptMentions,
    } = clean(doc);

    console.log(`paper_id   ${row.paper_id}`);
    console.log(`id         ${row.study_material_id}`);
    console.log(
      `sections   ${doc.sections?.length ?? 0} → ${cleaned.sections.length}` +
        `  (removed ${removedSections.length})`
    );
    for (const s of removedSections) {
      console.log(`             − [${s.index}] ${s.heading} (${s.paragraphs} paragraphs)`);
    }
    console.log(`footers    removed ${removedParagraphs.length}`);
    for (const p of removedParagraphs.slice(0, 5)) {
      console.log(`             − ${p.text}`);
    }
    if (removedParagraphs.length > 5) {
      console.log(`             … and ${removedParagraphs.length - 5} more`);
    }
    console.log(`markers    [לא קריא] found in ${strippedMarkers.length} paragraph(s)`);
    console.log(`headers    removed ${removedHeaders.length} (marker-only lines and running heads)`);
    for (const h of removedHeaders.slice(0, 6)) {
      console.log(`             − ${h.text}`);
    }
    if (removedHeaders.length > 6) {
      console.log(`             … and ${removedHeaders.length - 6} more`);
    }
    console.log(`titles     removed ${removedEchoes.length} empty heading(s) echoed nearby`);
    for (const e of removedEchoes.slice(0, 8)) {
      console.log(`             − [${e.index}] ${e.heading}`);
    }
    if (removedEchoes.length > 8) {
      console.log(`             … and ${removedEchoes.length - 8} more`);
    }
    console.log(`kept       ${keptMentions.length} paragraph(s) that name the booklet in prose`);
    for (const m of keptMentions) {
      console.log(`             ✓ [${m.index}] ${m.heading}: ${m.text}…`);
    }

    if (
      removedSections.length === 0 &&
      removedParagraphs.length === 0 &&
      removedHeaders.length === 0 &&
      removedEchoes.length === 0 &&
      strippedMarkers.length === 0
    ) {
      console.log("\nnothing to remove — already clean.");
      return;
    }

    if (!commit) {
      console.log("\ndry run — nothing written. Re-run with --commit to apply.");
      return;
    }

    // The document as it stood, on disk, before the write. Cheap, and the only
    // way back if a pattern turns out to have been too broad.
    const tmp = join(here, "tmp");
    if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
    const backup = join(tmp, `${row.paper_id}.before-clean.json`);
    writeFileSync(backup, JSON.stringify(payload, null, 2), "utf8");

    const next = wrapped
      ? {
          ...payload,
          doc: cleaned,
          // An edit to stored content, recorded where the content is. The
          // provenance block already says how this document was produced; this
          // says what was done to it afterwards.
          // One entry per run rather than one field, so a document cleaned
          // twice keeps both records instead of the second erasing the first.
          cleanup: [
            ...(Array.isArray(payload.cleanup)
              ? payload.cleanup
              : payload.cleanup
                ? [payload.cleanup]
                : []),
            {
              at: new Date().toISOString(),
              by: "scripts/ingestion/clean-study-material.mjs",
              removed_sections: removedSections.map((s) => s.heading),
              removed_footer_paragraphs: removedParagraphs.length,
              removed_header_paragraphs: removedHeaders.length,
              removed_echoed_titles: removedEchoes.length,
              stripped_illegible_markers: strippedMarkers.length,
            },
          ],
        }
      : cleaned;

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
