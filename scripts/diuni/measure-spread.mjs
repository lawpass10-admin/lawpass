// measure-spread.mjs — how varied is a set of generated questions?
//
//   node scripts/diuni/measure-spread.mjs                 # every draft, by version
//   node scripts/diuni/measure-spread.mjs Q1 Q2 Q3        # only these versions
//   node scripts/diuni/measure-spread.mjs --sources=a,b   # only these sources
//
// WHY THIS EXISTS. The failure this catches is not a bad question — every draft
// passes the generator's own gates — but a bad PAPER: thirteen questions that
// are individually fine and collectively ask the same thing. That is invisible
// one file at a time and obvious in aggregate, so it needs measuring rather
// than reading.
//
// The headline number is the share of stems asking how to challenge a judgment.
// It moved 5/13 -> 8/13 when the exemplars were diversified on phrasing alone,
// which is what prompted diversifying on subject too; this script is how that
// is checked rather than assumed.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "generated");

const argv = process.argv.slice(2);
const only = argv.find((a) => a.startsWith("--sources="));
const sourceFilter = only ? only.slice("--sources=".length).split(",") : null;
const versions = argv.filter((a) => /^Q\d+$/.test(a));

/**
 * A stem asking how to challenge a decision.
 *
 * TESTED ON MEANING, NOT WORDING — and that distinction is the whole point.
 * The first version of this listed surface forms (להשיג, יתקוף, כיצד עליהם
 * לפעול) and reported 1/4 for a batch that was actually 4/4: the generator had
 * varied the verb (ישיגו, לתקוף, עליו) while asking exactly the same thing.
 * A measurement keyed to phrasing rewards a model for rephrasing, which is the
 * opposite of what is being measured.
 *
 * So: any inflection of the three challenge roots, or an explicit ערעור /
 * ערכאה, or a "how/when/where should they act" stem pointed at a judgment.
 */
const CHALLENGE_ROOT = /ערעור|לערער|יערער|ערכאה|ערכאת|[להיתשמ]שיג|השג[הת]|[להיתנ]תק[וף]|תקיפ/;
const RULING = /פסק ה?דין|פסה"ד|ההחלטה|החלטת/;
const HOW_STEM = /^(כיצד|באיזה אופן|מתי|לאיזו|באיזו|למי|היכן|להיכן)/;

function isChallengeStem(question) {
  const stem = (question.stem || "").replace(/\s+/g, " ").trim();
  if (CHALLENGE_ROOT.test(stem)) return true;
  // A bare "כיצד עליו לפעול?" names no ruling — the judgment is in the FACTS.
  // Classifying on the stem alone marks it as something other than an appeal
  // question, which is how the first version of this undercounted.
  if (!HOW_STEM.test(stem)) return false;
  if (RULING.test(stem)) return true;
  const facts = (question.fact_pattern || "").replace(/\s+/g, " ");
  // Only the tail: a judgment mentioned in passing early on is background,
  // where one handed down at the end is the thing being acted against.
  return RULING.test(facts.slice(-260));
}

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

const byVersion = new Map();
for (const f of files) {
  const m = f.match(/^(.*)-Q(\d+)\.json$/);
  if (!m) continue;
  const [, source, v] = m;
  if (sourceFilter && !sourceFilter.includes(source)) continue;
  const key = `Q${v}`;
  if (versions.length && !versions.includes(key)) continue;
  if (!byVersion.has(key)) byVersion.set(key, []);
  byVersion.get(key).push({ source, data: JSON.parse(readFileSync(join(dir, f), "utf8")) });
}

/**
 * What settings a group was generated under.
 *
 * Read from the drafts, NOT inferred from the -QN in the filename. The version
 * number counts drafts of one source, not configurations: a brand-new judgment
 * gets `-Q1` whatever the params were, so the first batch and the latest batch
 * both land as `-Q1` and a filename-based label calls them the same thing. It
 * did exactly that — reporting a batch generated with balanced selection and
 * ten exemplars as "3 exemplars, spread".
 *
 * Drafts written before the config was recorded fall back to "config not
 * recorded", which is honest where a guess would not be.
 */
function describeConfig(set) {
  const seen = new Set();
  for (const x of set) {
    const c = x.data.generated_from?.config;
    const n = x.data.generated_from?.exemplars?.length;
    seen.add(
      c
        ? `${c.exemplars_count} exemplars/${c.exemplars_pick}, select=${c.selection_order}`
        : n
          ? `${n} exemplars, pick+select not recorded`
          : "config not recorded"
    );
  }
  return [...seen].join(" + ");
}

for (const key of [...byVersion.keys()].sort()) {
  const set = byVersion.get(key);
  const appeal = set.filter((x) => isChallengeStem(x.data.question));
  const concepts = new Map();
  for (const x of set) {
    for (const c of x.data.review.concepts_and_skills) {
      concepts.set(c, (concepts.get(c) ?? 0) + 1);
    }
  }
  const clustered = [...concepts.entries()].filter(([, n]) => n >= 3);

  console.log(`${key}  [${describeConfig(set)}]  (n=${set.length})`);
  console.log(`  appeal/forum stems : ${appeal.length}/${set.length}`);
  console.log(`  distinct concepts  : ${concepts.size}`);
  console.log(
    `  concepts in >=3 Qs : ${
      clustered.length
        ? clustered.sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} x${n}`).join(", ")
        : "none"
    }`
  );
  for (const x of set) {
    const flag = isChallengeStem(x.data.question) ? "APPEAL" : "      ";
    console.log(`    ${flag}  ${x.source.padEnd(18)} ${x.data.question.stem.slice(0, 58)}`);
  }
  console.log();
}
