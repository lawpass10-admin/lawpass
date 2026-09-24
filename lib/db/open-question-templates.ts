/**
 * The legal-writing skeletons a candidate fills in for a מטלת כתיבה.
 *
 * Reads `public.open_question_templates` (migration 20260924000002). Unlike the
 * question pools, that table is readable by any signed-in user — a skeleton
 * carries no question and no answer — so this runs on the caller's own client
 * rather than the service role.
 *
 * MATCHING IS BY LEGAL AREA (migration 20260924000003). A template states its
 * area — the part it is printed under — and a subject belongs to an area, which
 * is a fact about the law rather than about any one question. So:
 *
 *   open_questions.subject
 *     -> open_question_subject_areas.legal_area
 *     -> open_question_templates.legal_area  (plus 'general')
 *
 * This replaced a subjects-array on each template, which meant editing up to 36
 * rows to introduce one subject and left 18 templates reachable by nothing.
 *
 * ORDER is then decided by the question's `deliverable` — the document it asks
 * the candidate to produce. Area says which skeletons are eligible; deliverable
 * says which of them is the one being asked for.
 */

import type { createClient } from "@/lib/supabase/server";

export type OpenQuestionTemplate = {
  number: number;
  part: string;
  title: string;
  summary: string | null;
  body: string;
  isGeneric: boolean;
  /**
   * Set on the first template when the question said clearly enough which
   * document it wants — the top score beats the runner-up by a clear margin.
   * The pane shows one skeleton either way; this is what lets it say "this is
   * the one" rather than "the closest of these".
   */
  isBestMatch?: boolean;
  /**
   * The one the ranking picked — what the pane shows before the candidate
   * touches anything. Separate from list position: the general skeletons are
   * listed last as a group, but the chosen one is often among them.
   */
  isChosen?: boolean;
};

const COLUMNS = "number, part, title, summary, body, is_generic";

type Row = {
  number: number;
  part: string;
  title: string;
  summary: string | null;
  body: string;
  is_generic: boolean;
};


/**
 * A word and, if it is long enough to survive it, the same word without a
 * leading ל/ב/ה/ו/מ/כ/ש.
 *
 * Hebrew attaches those as prefixes, so "לבקשה" in a title and "בקשה" in a
 * deliverable are the same word. What does NOT work is stripping one letter
 * unconditionally and comparing the results: ב and מ are also ordinary root
 * letters, so "בקשה" became "קשה" and "משפט" became "שפט", the two sides
 * stemmed to different things, and the titles that should have matched best
 * scored zero. Keeping BOTH forms and intersecting them matches a prefixed
 * word with a bare one without mangling either.
 *
 * The length guard is the second half of it — stripping a three-letter word
 * leaves two letters, which match far too much.
 */
const variants = (word: string): string[] => {
  const withPrefix =
    word.length >= 4 && /^[לבהומכש]/.test(word) ? [word, word.slice(1)] : [word];
  // A feminine noun ends in ה alone and ת in the construct state, and the same
  // noun is spelled with א or ה depending on who is writing: the template says
  // "אגרה" and "פלוגתא", the tasks say "אגרת בית משפט" and "בפלוגתה". Same
  // words — and each mismatch cost the skeleton that those very words name.
  const endings = withPrefix.flatMap((w) => {
    const stem = w.slice(0, -1);
    if (w.endsWith("ה")) return [w, `${stem}ת`, `${stem}א`];
    if (w.endsWith("ת")) return [w, `${stem}ה`, `${stem}א`];
    if (w.endsWith("א")) return [w, `${stem}ה`, `${stem}ת`];
    return [w];
  });
  // The consonantal root, for matching a noun against a verb built on it:
  // the title says "הכרעה מוקדמת", the task says "ולהכריע בפלוגתה". Dropping
  // the letters Hebrew uses as vowels leaves כרע for both. Roots shorter than
  // three consonants are discarded — "הגנה" reduces to גנ, which would match
  // far too much.
  const roots = endings
    .map((w) => w.replace(/[אויה]/g, ""))
    .filter((r) => r.length >= 3);
  return [...new Set([...endings, ...roots.map((r) => `root:${r}`)])];
};

const NOISE = new Set(["תבנית", "כללית", "מטעם", "לפני", "בכתב", "בעניין", "של", "עם"]);

/**
 * How well a template's title describes the document a task asks for.
 *
 * WHY THIS EXISTS AND SUBJECT MATCHING DOES NOT REPLACE IT. `subject` names the
 * LAW, so every civil task returns all twelve civil skeletons in number order —
 * which puts כתב תביעה first. But seven of the eight student-facing tasks ask
 * for a בקשה, and one asks for a בקשה לסעד זמני. The question states this
 * itself, in `deliverable`: "בקשה דחופה לסעד זמני (צו עיכוב יציאה מן הארץ)".
 * Scoring the title against it is what puts the right skeleton first instead of
 * the first-numbered one.
 *
 * A score of 0 is not a rejection — the template stays in the list, just lower.
 * The candidate chooses; this only decides what they see before they choose.
 */
function deliverableScore(title: string, deliverable: string): number {
  if (!deliverable) return 0;
  // Words shorter than three letters are dropped from both sides: "בת" out of a
  // docket number is not evidence, and letting two-letter forms match is how
  // "כתב תביעה" came top for a task asking for a בקשה.
  const words = new Set(
    deliverable
      .replace(/[^֐-׿\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .flatMap(variants)
  );
  // A DOCKET NUMBER MEANS THE CASE ALREADY EXISTS. "בקשה בכתב לבית המשפט
  // המחוזי מרכז-לוד בת\"א 26-01-8877" never says which document it wants, but
  // citing a file number says the proceeding is under way — which is precisely
  // what "בקשה בכתב בהליך תלוי ועומד" is for, and what separates it from a
  // fee waiver filed WITH the claim, before any file exists. Added as words so
  // the ordinary scoring weighs it against everything else rather than as an
  // override.
  if (/(?:ת["']?א|עת["']?מ|בש["']?פ|רע["']?א|ע["']?א)\s*\d/.test(deliverable)) {
    for (const w of ["הליך", "תלוי", "עומד"]) for (const v of variants(w)) words.add(v);
  }
  const wanted = title
    .replace(/[^֐-׿\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w));
  if (wanted.length === 0) return 0;
  const matched = wanted.filter((w) => variants(w).some((v) => words.has(v))).length;
  if (matched === 0) return 0;

  // THE HEAD NOUN DECIDES THE DOCUMENT. A deliverable names what to write first
  // and then says where it goes and what it accompanies:
  //
  //   "בקשה לפטור מתשלום אגרה, המוגשת עם כתב התביעה"
  //
  // The document is the בקשה; the כתב תביעה is the thing it is filed with. On
  // word overlap alone "כתב תביעה" scores 2 of 2 and wins, and the candidate is
  // handed the wrong skeleton.
  //
  // Head against HEAD, not head against any word: "תגובה לבקשה" also contains
  // "בקשה", but it is a response TO one — its own head is תגובה, and a task
  // asking for a בקשה does not want it. Comparing the two head nouns is what
  // tells "the document" from "the document it mentions".
  const head = deliverable
    .replace(/[^֐-׿\s]/g, " ")
    .split(/\s+/)
    .find((w) => w.length >= 3);
  const titleHead = wanted[0];
  const headBonus =
    head && titleHead && variants(titleHead).some((v) => variants(head).includes(v)) ? 2 : 0;
  // HOW MANY WORDS MATCHED, plus precision as a fraction to break ties.
  //
  // This used to be matched²/length, which divides by the title's length and so
  // punishes a long title for being long: "בקשה למתן פסק דין חלקי / הכרעה
  // מוקדמת בפלוגתא" matched five of its eight words against a task that asked
  // in almost those words, and still lost to a three-word general title that
  // matched all three. Five matched words are more evidence than three, and the
  // score now says so; precision only settles ties between equal counts.
  return headBonus + matched + matched / wanted.length;
}

const toTemplate = (row: Row): OpenQuestionTemplate => ({
  number: row.number,
  part: row.part,
  title: row.title,
  summary: row.summary,
  body: row.body,
  isGeneric: row.is_generic,
});

/**
 * The templates offered for one writing task, most specific first.
 *
 * `questionId` is the open_question_id the route carries. The subject is read
 * from the question rather than passed in, because the page knows the id and
 * the client only learns the subject after it has fetched the question — and a
 * template that arrives one render later than the question it belongs beside
 * reads as the page changing its mind.
 *
 * Returns [] rather than throwing when anything is missing: a writing task with
 * no skeleton beside it is a smaller failure than a writing task that will not
 * open.
 */
export async function getTemplatesForQuestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questionId: string
): Promise<OpenQuestionTemplate[]> {
  const { data: question } = await supabase
    .from("open_questions")
    .select("subject, question, legal_area")
    .eq("open_question_id", questionId)
    .maybeSingle();

  const subject = (question?.subject ?? "").trim();
  // What the task actually asks the candidate to produce. Optional: the
  // `source` questions (the original papers) carry no deliverable, and only the
  // `new` ones a student can open do.
  const deliverable = String(
    (question?.question as { deliverable?: unknown } | null)?.deliverable ?? ""
  ).trim();

  // The question's OWN area wins when it has one — it is a fact about the
  // proceeding rather than about the law the paper was drawn from. Otherwise
  // fall back to the subject mapping, which is one row per subject and covers
  // the ordinary case; and to the general skeletons when even that is missing.
  let area = (question?.legal_area as string | null) ?? "";
  if (!area && subject) {
    const { data: mapped } = await supabase
      .from("open_question_subject_areas")
      .select("legal_area")
      .eq("subject", subject)
      .maybeSingle();
    area = mapped?.legal_area ?? "";
  }
  if (!area) area = "general";

  // The area's own skeletons plus the cross-cutting ones — appeals, summations,
  // letters and the תבנית כללית set, which belong to no field of law and are
  // offered everywhere.
  const areas = area === "general" ? ["general"] : [area, "general"];
  const { data, error } = await supabase
    .from("open_question_templates")
    .select(COLUMNS)
    .in("legal_area", areas)
    .order("number", { ascending: true });

  // Dev-only trace. This lookup crosses two tables, RLS and table grants, and
  // every one of those failures surfaces to the caller as "no rows" rather than
  // as an error — which is exactly how a missing GRANT (20260924000004) looked
  // like an empty pane with nothing in any log. `error` is printed explicitly
  // because a permission denial is reported there and nowhere else.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[templates] question=${questionId} subject=${JSON.stringify(subject)} ` +
        `area=${area} areas=${JSON.stringify(areas)} ` +
        `deliverable=${JSON.stringify(deliverable.slice(0, 60))} ` +
        `rows=${data?.length ?? 0}` +
        (error ? ` error=${JSON.stringify(error.message)}` : "")
    );
  }

  if (error || !data || data.length === 0) {
    const generic = await getGenericTemplates(supabase);
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[templates] falling back to generic — ${generic.length} row(s)` +
          (generic.length === 0
            ? " — none either: check GRANT SELECT on open_question_templates"
            : "")
      );
    }
    return rank(generic, deliverable);
  }
  return rank((data as Row[]).map(toTemplate), deliverable);
}

/**
 * Order the matches: the document the task asks for first.
 *
 * Ties fall back to the old rule — specific before universal, then the number
 * the source document prints — so a task with no deliverable is ordered exactly
 * as it was.
 */
/**
 * How far ahead the winner must be to be called the match rather than the
 * closest guess. Measured against the real tasks: six of the eight lead by
 * 1.50 or more, and the two below it are genuinely ambiguous — a fee waiver
 * that any בקשה skeleton fits, and a בקשה למתן פסק דין חלקי that is half a
 * default-judgment request and half a general one. Those two SHOULD read as
 * "closest", because that is what they are.
 */
const CONFIDENT_GAP = 1;

function rank(
  templates: OpenQuestionTemplate[],
  deliverable: string
): OpenQuestionTemplate[] {
  const sorted = [...templates].sort((a, b) => {
    const byScore = deliverableScore(b.title, deliverable) - deliverableScore(a.title, deliverable);
    if (byScore !== 0) return byScore;
    if (a.isGeneric !== b.isGeneric) {
      // A TIE MEANS EQUAL EVIDENCE, and then the general skeleton is the safer
      // one: a specific template that matched no more of the deliverable than
      // the general one has nothing to justify its specificity. "בקשה לפטור
      // מתשלום אגרה" matches בקשה and nothing else, so "בקשה לסעד זמני" and
      // "תבנית כללית לבקשה לבית משפט" tie — and offering a candidate an
      // interim-relief skeleton for a fee waiver is worse than offering the
      // general one.
      //
      // Only when the question SAYS what it wants. With no deliverable there is
      // no evidence either way, and the old order — specific first, by number —
      // is the sensible default.
      if (deliverable) return a.isGeneric ? -1 : 1;
      return a.isGeneric ? 1 : -1;
    }
    return a.number - b.number;
  });

  if (sorted.length === 0) return sorted;
  const top = deliverableScore(sorted[0].title, deliverable);
  const next = sorted.length > 1 ? deliverableScore(sorted[1].title, deliverable) : 0;
  const confident = top > 0 && top - next >= CONFIDENT_GAP;
  const winner = sorted[0].number;

  // LIST ORDER IS NOT RANK ORDER. The area's own skeletons come first and the
  // general ones last as a block, because that is how a candidate scans them:
  // "the documents for my kind of case", then "the all-purpose ones". Rank
  // decides which single skeleton is SHOWN, and that one can perfectly well be
  // a general template — for most of these tasks it is the right answer — so
  // the winner is marked rather than moved to the front.
  const byGroup = [
    ...sorted.filter((t) => !t.isGeneric),
    ...sorted.filter((t) => t.isGeneric),
  ];
  return byGroup.map((t) =>
    t.number === winner ? { ...t, isBestMatch: confident, isChosen: true } : t
  );
}

/** The תבנית כללית skeletons, for a question whose subject matches nothing. */
async function getGenericTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<OpenQuestionTemplate[]> {
  const { data, error } = await supabase
    .from("open_question_templates")
    .select(COLUMNS)
    .eq("is_generic", true)
    .order("number", { ascending: true });

  if (error || !data) return [];
  return (data as Row[]).map(toTemplate);
}
