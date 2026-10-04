// publish-exam.mjs — put a generated paper in front of candidates, as the next
// מבחן מספר N.
//
//   node scripts/mahoti/publish-exam.mjs                       # list what exists
//   node scripts/mahoti/publish-exam.mjs --set=<uuid>          # show what would happen
//   node scripts/mahoti/publish-exam.mjs --set=<uuid> --commit # publish it
//   node scripts/mahoti/publish-exam.mjs --set=<uuid> --unpublish --commit
//
// Generating a paper no longer publishes it. A run inserts the row as `draft`,
// and this is the separate, deliberate step that makes it live — so a paper
// reaches candidates because someone looked at it, not because a script
// finished. The number it is given is permanent: candidates say "מבחן מספר 2",
// so that has to keep meaning this paper.
//
// Unpublishing keeps the number on the row rather than clearing it, so a paper
// pulled for a fix comes back as the number people already knew it by. The
// unique index is partial (WHERE exam_status = 'prod') precisely to allow that.

import dotenv from "dotenv";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const setId = flagOf("set");
const commit = argv.includes("--commit");
const unpublish = argv.includes("--unpublish");

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "publish-exam.mjs — make a generated paper live as the next מבחן מספר N.",
      "",
      "  node scripts/mahoti/publish-exam.mjs                        list every paper",
      "  node scripts/mahoti/publish-exam.mjs --set=<uuid>           dry run",
      "  node scripts/mahoti/publish-exam.mjs --set=<uuid> --commit  publish",
      "",
      "  --unpublish   back to draft, keeping the number for when it returns",
      "  --commit      write. Without it, nothing changes.",
    ].join("\n")
  );
  process.exit(0);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: all } = await client.query(`
  SELECT question_id, created_at, exam_status, exam_number, built_for,
         jsonb_array_length(coalesce(questions->'questions', '[]'::jsonb)) AS n
    FROM public.mahoti_questions
   WHERE questions IS NOT NULL AND question_notebook IS NOT NULL
   ORDER BY exam_number DESC NULLS LAST, created_at DESC`);

function show(rows) {
  for (const r of rows) {
    const name = r.exam_number === null ? "—" : `מבחן מספר ${r.exam_number}`;
    const mine = r.built_for ? "  (custom)" : "";
    console.log(
      `  ${r.exam_status.padEnd(5)}  ${String(name).padEnd(14)}  ${r.question_id}  ` +
        `${String(r.n).padStart(2)} questions  ${r.created_at.toISOString().slice(0, 10)}${mine}`
    );
  }
}

if (!setId) {
  console.log("\npapers in mahoti_questions:\n");
  show(all);
  console.log("\nPass --set=<uuid> to publish one.");
  await client.end();
  process.exit(0);
}

const row = all.find((r) => r.question_id === setId);
if (!row) {
  console.error(`\nno paper with question_id ${setId} (or it has no questions/notebook stored).`);
  await client.end();
  process.exit(1);
}
// The table forbids this too; saying so here names the reason rather than
// letting a CHECK constraint violation be the explanation.
if (row.built_for && !unpublish) {
  console.error(
    `\n${setId} was built for one candidate (built_for is set), so it cannot be published:\n` +
      "a custom paper belongs to the person who built it, not to everyone's picker."
  );
  await client.end();
  process.exit(1);
}

if (unpublish) {
  if (row.exam_status !== "prod") {
    console.log(`\n${setId} is already a draft — nothing to do.`);
    await client.end();
    process.exit(0);
  }
  console.log(`\nמבחן מספר ${row.exam_number} (${setId}) → draft, keeping its number.`);
  if (!commit) {
    console.log("\ndry run — nothing written. Pass --commit to apply.");
    await client.end();
    process.exit(0);
  }
  await client.query(
    `UPDATE public.mahoti_questions SET exam_status = 'draft' WHERE question_id = $1`,
    [setId]
  );
  console.log("UNPUBLISHED.");
  await client.end();
  process.exit(0);
}

if (row.exam_status === "prod") {
  console.log(`\n${setId} is already live as מבחן מספר ${row.exam_number} — nothing to do.`);
  await client.end();
  process.exit(0);
}

// A paper that was published before keeps the number it had; only a paper that
// has never been numbered takes the next one. MAX over every row rather than
// over the live ones, so a number belonging to an unpublished paper is not
// handed to a different one.
const { rows: maxRows } = await client.query(
  `SELECT coalesce(max(exam_number), 0) AS top FROM public.mahoti_questions`
);
const number = row.exam_number ?? Number(maxRows[0].top) + 1;

console.log(
  `\n${setId}\n` +
    `  ${row.n} questions, created ${row.created_at.toISOString().slice(0, 10)}\n` +
    `  draft → prod as מבחן מספר ${number}` +
    (row.exam_number ? "  (its previous number)" : "")
);

if (!commit) {
  console.log("\ndry run — nothing written. Pass --commit to apply.");
  await client.end();
  process.exit(0);
}

await client.query(
  `UPDATE public.mahoti_questions
      SET exam_status = 'prod', exam_number = $2
    WHERE question_id = $1`,
  [setId, number]
);
console.log(`\nPUBLISHED as מבחן מספר ${number}.`);

const { rows: live } = await client.query(`
  SELECT question_id, created_at, exam_status, exam_number, built_for,
         jsonb_array_length(coalesce(questions->'questions', '[]'::jsonb)) AS n
    FROM public.mahoti_questions
   WHERE exam_status = 'prod' ORDER BY exam_number DESC`);
console.log("\nlive now:\n");
show(live);

await client.end();
