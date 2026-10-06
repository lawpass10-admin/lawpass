/**
 * Reads the `mahoti_questions` table — a generated דין־מהותי paper together
 * with the notebook it was generated from.
 *
 * The row is produced outside the app by knesset_scraper: a notebook is a
 * sampled subset of the scraped legislation, and it is the ONLY law the model
 * was shown. That is why the two travel in one row — every quote in
 * `questions` is checkable against `question_notebook` and nothing else, which
 * is exactly what the split study screen puts side by side.
 *
 * Access: `mahoti_questions` has RLS enabled with admin-only policies (see
 * supabase/migrations/20260823000003_mahoti_questions.sql), so a subscriber
 * reading their own study screen would be rejected by policy. This module
 * therefore reads through the service-role client, behind the page's own
 * `requireActiveSubscription()` gate. The content is authoring-side legal text
 * with no per-user rows in it, so there is nothing here to scope to a user —
 * but note this is a deliberate RLS bypass, not an oversight. The alternative
 * is a `TO authenticated USING (true)` SELECT policy on the table; if that is
 * added, swap `createAdminClient()` for the SSR client and delete this note.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Choice, Question360 } from "@/lib/db/practice";
import {
  DEFAULT_PAPER_ORDER,
  visibleToViewerFilter,
} from "@/lib/db/paper-visibility";

const TABLE = "mahoti_questions";

// ---------------------------------------------------------------------------
// Notebook shape — mirrors notebook.py's output
// ---------------------------------------------------------------------------

export type NotebookParagraph = {
  marker: string;
  text: string;
};

export type NotebookSubsection = {
  marker: string;
  text: string;
  paragraphs: NotebookParagraph[];
};

export type NotebookSection = {
  number: string;
  heading: string;
  text: string;
  subsections: NotebookSubsection[];
  chapter: string | null;
};

export type NotebookLaw = {
  law_id: number;
  law_name: string;
  section_count: number;
  sections: NotebookSection[];
};

export type NotebookMeta = {
  seed: number | null;
  law_count: number;
  section_count: number;
  estimated_a4_pages: number | null;
  built_at: string | null;
};

export type Notebook = {
  notebook: NotebookMeta;
  laws: NotebookLaw[];
};

// ---------------------------------------------------------------------------
// Question shape — mirrors the `questions` payload the loader writes
// ---------------------------------------------------------------------------

export type MahotiLetter = "א" | "ב" | "ג" | "ד";

export type MahotiOption = {
  letter: MahotiLetter;
  text: string;
};

/** A question the generator built: grounded in one section of the notebook. */
export type MahotiGeneratedSource = {
  law_id: number;
  law_name: string;
  section_number: string;
  /** The sentence from the notebook the question was built on. Verified
   *  against `question_notebook` before the row was ever written. */
  source_quote: string;
};

/**
 * A question taken verbatim from a real Bar paper and embedded in a generated
 * one by scripts/mahoti/embed-real-questions.mjs.
 *
 * It carries no `source_quote` and cannot: it was not built from the notebook,
 * and a quotation in that field is one the loader verified against the
 * notebook's text. What it has instead is the provision the Bar's own answer
 * key cites, as prose. `law_id` is present only once a human has matched that
 * prose to a law in the corpus.
 */
export type MahotiRealExamSource = {
  origin: "real_exam";
  /** The sitting, as a date — "2024-02-12". */
  paper: string;
  /** Its number in that sitting's paper, which is not its number here. */
  number: number;
  citation: string | null;
  law_id?: number;
  law_name?: string;
};

export type MahotiSource = MahotiGeneratedSource | MahotiRealExamSource;

const isRealExamSource = (source: MahotiSource): source is MahotiRealExamSource =>
  "origin" in source && source.origin === "real_exam";

/**
 * One question as the study screen sees it. `correct_answer` is deliberately
 * absent: the row carries it, and `stripAnswers` below drops it server-side
 * before anything reaches the client — the same rule the exam player follows,
 * where choices arrive without `is_correct`.
 */
export type MahotiQuestion = {
  number: number;
  fact_pattern: string;
  stem: string;
  options: MahotiOption[];
  sources: MahotiSource[];
};

export type MahotiSet = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questions: MahotiQuestion[];
  notebook: Notebook;
};

/** The `questions` jsonb, before the answer key is removed. */
type StoredQuestion = MahotiQuestion & { correct_answer?: MahotiLetter };

type QuestionsPayload = {
  exam?: { title?: string } | null;
  questions?: StoredQuestion[] | null;
};

/** The `question_review` jsonb — one entry per question, aligned to
 *  `questions` by `number` (see load_questions_supabase.py). */
type StoredReview = {
  number: number;
  legal_topic_analysis?: string;
  explanation?: string;
  common_pitfall?: string;
  quick_thinking_360?: string;
  summary_for_memory?: string;
  concepts_and_skills?: string[];
  distractor_analysis?: Partial<Record<MahotiLetter, string>>;
};

type ReviewPayload = {
  questions?: StoredReview[] | null;
};

type Row = {
  question_id: string;
  created_at: string | null;
  exam_number: number | null;
  questions: QuestionsPayload | null;
  question_notebook: Notebook | null;
};

function stripAnswers(questions: StoredQuestion[]): MahotiQuestion[] {
  return questions.map((q) => ({
    number: q.number,
    fact_pattern: q.fact_pattern ?? "",
    stem: q.stem ?? "",
    options: (q.options ?? []).map((o) => ({ letter: o.letter, text: o.text })),
    sources: q.sources ?? [],
  }));
}

/**
 * One generated paper: the row named by `questionId`, or the newest usable row
 * when no id is given.
 *
 * Rows are written notebook-first, so `questions IS NULL` is a normal
 * intermediate state and those rows are skipped rather than treated as an
 * error. Returns null when the table holds nothing usable — the page renders
 * an empty state instead of throwing, since this is authoring content that
 * simply may not be loaded yet on a given environment.
 */
export async function getMahotiSet(
  questionId: string | undefined,
  viewerId: string
): Promise<MahotiSet | null> {
  const supabase = createAdminClient();

  const base = supabase
    .from(TABLE)
    .select("question_id, created_at, exam_number, questions, question_notebook")
    .not("questions", "is", null);

  const { data, error } = questionId
    ? // THE ID COMES FROM `?set=` AND IS THEREFORE UNTRUSTED. This branch used
      // to apply no filters at all, which let any candidate open an
      // unpublished draft or another candidate's custom exam by URL — the
      // reasoning two lines below was applied to the branch a URL cannot
      // reach. See lib/db/paper-visibility.ts.
      await base
        .eq("question_id", questionId)
        .or(visibleToViewerFilter(viewerId))
        .maybeSingle<Row>()
    : // Published papers only. Custom exams ("שאלון מותאם אישית") live in this
      // same table — they have to, because mahoti_answers has a foreign key
      // onto it — and this branch answers with מבחן מספר 1, the same paper the
      // picker preselects, so /mahoti with no ?set= and /mahoti-start's default
      // open the same thing. Without the filters, the first exam any candidate
      // built for themselves, or any draft a generation run had just inserted,
      // would silently become the default paper served to everyone else.
      await base
        .eq("exam_status", "prod")
        .is("built_for", null)
        .order("exam_number", { ascending: true })
        .limit(1)
        .maybeSingle<Row>();

  if (error) {
    throw new Error(`failed to read ${TABLE}: ${error.message}`);
  }
  if (!data?.questions?.questions?.length || !data.question_notebook) {
    return null;
  }

  return {
    questionId: data.question_id,
    createdAt: data.created_at,
    title: examTitle(data.exam_number, data.questions.exam?.title, "דיון מהותי"),
    questions: stripAnswers(data.questions.questions),
    notebook: data.question_notebook,
  };
}

/**
 * One line in the paper picker — enough to choose between papers, and
 * deliberately not enough to sit one.
 *
 * `questionCount` and `lawCount` are nullable because they are read out of the
 * stored json rather than counted: a row written before the generator recorded
 * `exam.question_count` simply has no number to show, which the picker renders
 * as a paper with no subtitle rather than as a paper with "0 שאלות".
 */
export type MahotiSetSummary = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questionCount: number | null;
  lawCount: number | null;
};

/**
 * How many of a candidate's OWN papers the "שאלונים שבניתי" list offers.
 *
 * Only the authored list is governed by `exam_status`; a paper someone built
 * for themselves is never published, so it needs a plain cap instead. One, as
 * before — the custom builder overwrites rather than accumulates in practice.
 */
export const MAHOTI_CUSTOM_PICKER_LIMIT = 1;

/**
 * The name a published paper is shown under: מבחן מספר 1, מבחן מספר 2.
 *
 * Derived from `exam_number` rather than read from `questions -> exam -> title`,
 * which every generated row sets to the same "דיון מהותי" — a picker of papers
 * all called the same thing is not a choice. The stored title is left alone
 * rather than rewritten: it records what the generator produced.
 *
 * An unnumbered row falls back to that stored title, which is what a custom
 * paper ("שאלון מותאם אישית") and any draft reached by its `?set=` URL use.
 */
function examTitle(examNumber: number | null, storedTitle: string | undefined, fallback: string) {
  if (examNumber !== null && examNumber !== undefined) return `מבחן מספר ${examNumber}`;
  return storedTitle ?? fallback;
}

/** The `questions -> exam` and `question_notebook -> notebook` sub-objects,
 *  which is all the picker reads. Selecting the whole `questions` array to
 *  count it would pull the entire paper — 40 questions of legal text — for
 *  every row in a list that shows one line each. */
type SummaryRow = {
  question_id: string;
  created_at: string | null;
  exam_number: number | null;
  exam: { title?: string; question_count?: number } | null;
  notebook_meta: { law_count?: number } | null;
};

/**
 * The authored papers a candidate may open, newest first.
 *
 * Same two filters as the default read in `getMahotiSet`, for the same two
 * reasons: `built_for IS NULL` keeps one candidate's custom exam out of
 * everyone else's list, and a row is only listed once BOTH halves are present —
 * a notebook-only row is an intermediate state, and offering it would open a
 * paper with nothing in it.
 */
/**
 * The candidate's OWN custom-built papers, newest first.
 *
 * `listMahotiSets` excludes these on purpose — a paper someone built for
 * themselves does not belong in everyone's picker. The consequence, until
 * this existed, was that a custom exam was reachable only by the `?set=` URL
 * the builder happened to redirect to: navigate away and it was gone, with
 * nothing anywhere listing it.
 *
 * THE `built_for` FILTER IS THE AUTHORIZATION. This read goes through the
 * service-role client, like every other read in this file, because the table
 * is admin-only under RLS — so there is no policy underneath to scope the
 * rows. Widening or dropping that filter would hand one candidate another's
 * papers.
 */
export async function listMyCustomMahotiSets(
  userId: string,
  limit: number = MAHOTI_CUSTOM_PICKER_LIMIT
): Promise<MahotiSetSummary[]> {
  if (!userId) return [];
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "question_id, created_at, exam_number, exam:questions->exam, notebook_meta:question_notebook->notebook"
    )
    .eq("built_for", userId)
    .not("questions", "is", null)
    .not("question_notebook", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SummaryRow[]>();

  if (error) {
    throw new Error(`failed to list custom ${TABLE}: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    questionId: row.question_id,
    createdAt: row.created_at,
    title: examTitle(row.exam_number, row.exam?.title, "שאלון מותאם אישית"),
    questionCount: row.exam?.question_count ?? null,
    lawCount: row.notebook_meta?.law_count ?? null,
  }));
}

/**
 * Every published paper, מבחן מספר 1 first.
 *
 * `exam_status = 'prod'` replaced "the newest row, capped at one": publication
 * is now a deliberate step (scripts/mahoti/publish-exam.mjs), so generating a
 * paper no longer puts it in front of candidates by itself, and there is no
 * longer a cap to raise when a second paper is ready. See the migration
 * 20261004000001_mahoti_exam_publication.sql.
 *
 * Ordered by `exam_number` ASCENDING, not by `created_at` — a numbered series
 * reads 1, 2, 3, the way a candidate works through it, and the two orders can
 * disagree anyway (a paper published later may be numbered earlier). The first
 * row is also the one PaperChoice preselects, so the default is מבחן מספר 1.
 *
 * `built_for IS NULL` stays, though the table now also forbids publishing a
 * custom paper: it is the filter the other reads here use, and a read that
 * depends on a CHECK constraint elsewhere for its authorization is harder to
 * verify than one that states its own.
 */
export async function listMahotiSets(): Promise<MahotiSetSummary[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "question_id, created_at, exam_number, exam:questions->exam, notebook_meta:question_notebook->notebook"
    )
    .eq("exam_status", "prod")
    .is("built_for", null)
    .not("questions", "is", null)
    .not("question_notebook", "is", null)
    .order("exam_number", { ascending: true })
    .returns<SummaryRow[]>();

  if (error) {
    throw new Error(`failed to list ${TABLE}: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    questionId: row.question_id,
    createdAt: row.created_at,
    title: examTitle(row.exam_number, row.exam?.title, "דין מהותי"),
    questionCount: row.exam?.question_count ?? null,
    lawCount: row.notebook_meta?.law_count ?? null,
  }));
}

/**
 * The paper that follows `currentId` in the table's own order — what
 * "למבחן הבא" moves to at the end of a review.
 *
 * The order is the one the screen already implies: `exam_number ASC`, the same
 * order the picker lists, so "next" walks up the series — מבחן מספר 1 to מבחן
 * מספר 2. It wraps at the end rather than dead-ending, so a candidate who
 * finishes the last paper is sent round to the first instead of hitting a
 * disabled button.
 *
 * Returns null when there is nothing to move to (a single paper, or none).
 * The id list is read whole because `mahoti_questions` is authoring content —
 * one row per generated paper, loaded by hand, so this is tens of rows, not a
 * user-scale table.
 */
export async function getNextMahotiSetId(
  currentId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Published papers only — see the same filters in `listMahotiSets`. Custom
  // exams belong to one candidate each, so listing them here would walk one
  // person's private paper into everyone else's "next exam"; an unpublished
  // draft would do the same with a paper nobody has approved.
  const { data, error } = await supabase
    .from(TABLE)
    .select("question_id")
    .eq("exam_status", "prod")
    .is("built_for", null)
    .not("questions", "is", null)
    .order("exam_number", { ascending: true });

  if (error) {
    throw new Error(`failed to read ${TABLE}: ${error.message}`);
  }

  const ids = (data ?? []).map((row) => row.question_id as string);
  if (ids.length < 2) return null;

  const at = ids.indexOf(currentId);
  // An id that is no longer in the table (row deleted between the two reads)
  // falls back to the newest paper rather than to nothing.
  if (at === -1) return ids[0];
  return ids[(at + 1) % ids.length];
}

// ---------------------------------------------------------------------------
// Review — the answer key and the 360° content
// ---------------------------------------------------------------------------

/**
 * One question, shaped for `<Learning360Panel>`.
 *
 * The panel is the app's existing review surface (practice play, exam
 * results, notes bank), and the mahoti payload maps onto its types without
 * loss, so the review page reuses it rather than growing a second look for
 * the same content. The two field names that differ are mapped here:
 * `explanation` -> `full_explanation`, and `sources` -> `references_list`,
 * where a reference is the citation followed by the quote the generator was
 * held to.
 */
export type MahotiReviewItem = {
  number: number;
  fact_pattern: string;
  stem: string;
  correctChoice: Choice;
  question: Question360;
  /**
   * The law this question was built from — the same subject the server stamps
   * onto a marked answer (lawpass_server/db/mahoti.js#getAnswerKey), resolved
   * the same way, so a mid-sitting check and a filed sitting group a paper into
   * the same rows. Null for a question whose source carries no law name.
   */
  topic: string | null;
};

export type MahotiReview = {
  questionId: string;
  title: string;
  items: MahotiReviewItem[];
};

function toChoices(
  question: StoredQuestion,
  review: StoredReview | undefined
): Choice[] {
  return (question.options ?? []).map((option, i) => ({
    // No choices table behind these — the id only has to be unique within
    // the question, and the panel uses it as a React key.
    id: `${question.number}-${option.letter}`,
    letter: option.letter,
    choice_text: option.text,
    is_correct: option.letter === question.correct_answer,
    distractor_analysis: review?.distractor_analysis?.[option.letter] ?? null,
    display_order: i,
  }));
}

function toReferences(sources: MahotiSource[]): string[] {
  return sources.map((source) => {
    // An embedded real question has no section number and no verified quote, so
    // the generated spelling would render "undefined, סעיף undefined". It cites
    // the sitting it came from and the provision that sitting's key named.
    if (isRealExamSource(source)) {
      const sitting = `שאלה ${source.number} בבחינת ההסמכה מיום ${source.paper}`;
      return source.citation ? `${sitting} — ${source.citation}` : sitting;
    }
    return source.source_quote
      ? `${source.law_name}, סעיף ${source.section_number} — "${source.source_quote}"`
      : `${source.law_name}, סעיף ${source.section_number}`;
  });
}

/**
 * The review for one generated paper — the same row `getMahotiSet` reads for
 * the same `questionId`, so the questions the candidate answered and the
 * review behind them line up. Without an id it falls back to the SAME default
 * paper `getMahotiSet` falls back to, through the shared
 * `DEFAULT_PAPER_ORDER`: מבחן מספר 1, not the most recently created row. The
 * two readers disagreed from 20261004000001 until this was fixed — the set
 * moved to `exam_number ASC` when publication landed and this one stayed on
 * `created_at DESC`, so a candidate with no `?set=` could read the review of
 * one paper beside the questions of another.
 *
 * Questions whose `correct_answer` names no option are dropped rather than
 * rendered with an empty answer banner: the panel's whole frame is built
 * around a correct choice, and a review that cannot say which answer is right
 * is worse than one question short.
 */
export async function getMahotiReview(
  questionId: string | undefined,
  viewerId: string
): Promise<MahotiReview | null> {
  const supabase = createAdminClient();

  const base = supabase
    .from(TABLE)
    .select("question_id, questions, question_review")
    .not("questions", "is", null);

  type ReviewRow = {
    question_id: string;
    questions: QuestionsPayload | null;
    question_review: ReviewPayload | null;
  };

  // BOTH BRANCHES ARE FILTERED, and this reader needed it more than
  // getMahotiSet did: a review carries `question_review` and the correct
  // choice, with no stripAnswers between it and the page. Unfiltered, the
  // by-id branch handed out the answers to any paper named in `?set=`, and
  // the default branch answered with the newest row in the table — so a draft
  // a generation run had just inserted, or whichever candidate had most
  // recently built a custom exam, became the review everyone saw.
  const { data, error } = questionId
    ? await base
        .eq("question_id", questionId)
        .or(visibleToViewerFilter(viewerId))
        .maybeSingle<ReviewRow>()
    : await base
        .eq("exam_status", "prod")
        .is("built_for", null)
        .order(DEFAULT_PAPER_ORDER.column, {
          ascending: DEFAULT_PAPER_ORDER.ascending,
        })
        .limit(1)
        .maybeSingle<ReviewRow>();

  if (error) {
    throw new Error(`failed to read ${TABLE}: ${error.message}`);
  }
  if (!data?.questions?.questions?.length) return null;

  const reviews = new Map(
    (data.question_review?.questions ?? []).map((r) => [r.number, r])
  );

  const items: MahotiReviewItem[] = [];
  for (const question of data.questions.questions) {
    const review = reviews.get(question.number);
    const choices = toChoices(question, review);
    const correctChoice = choices.find((c) => c.is_correct);
    if (!correctChoice) continue;

    items.push({
      number: question.number,
      fact_pattern: question.fact_pattern ?? "",
      stem: question.stem ?? "",
      correctChoice,
      topic: (question.sources ?? [])[0]?.law_name ?? null,
      question: {
        choices,
        legal_topic_analysis: review?.legal_topic_analysis ?? "",
        full_explanation: review?.explanation ?? "",
        common_pitfall: review?.common_pitfall ?? "",
        quick_thinking_360: review?.quick_thinking_360 ?? "",
        summary_for_memory: review?.summary_for_memory ?? "",
        concepts_and_skills: review?.concepts_and_skills ?? [],
        references_list: toReferences(question.sources ?? []),
      },
    });
  }

  if (!items.length) return null;

  return {
    questionId: data.question_id,
    title: data.questions.exam?.title ?? "דיון מהותי",
    items,
  };
}

// ---------------------------------------------------------------------------
// Sittings — what a candidate answered, as it was filed and marked
// ---------------------------------------------------------------------------

/** One question of a filed sitting, as `answer_body.given` stores it. */
export type MahotiGivenAnswer = {
  number: number;
  /** Null when the question was left blank. */
  letter: MahotiLetter | null;
  /** The key AT THE TIME OF MARKING — snapshot, not looked up again. */
  correct_letter: MahotiLetter | null;
  is_correct: boolean;
  /**
   * The law the question was built from, stamped on at marking time so the
   * per-subject table can be recomputed from the row alone — see
   * `breakdownByTopic`. Optional because sittings filed before the server
   * started carrying it have entries without one; they group under "ללא סיווג".
   */
  topic?: string | null;
};

/**
 * One filed sitting of a paper: which letters were chosen, how they were
 * marked, and the score that marking produced.
 *
 * `score` is the stored `answer_score` column — correct out of total as a
 * percentage. It is read, never recomputed: the whole point of filing it was
 * that one calculation decides what the sitting was worth, so a screen that
 * re-derived it could disagree with the table it came from.
 */
export type MahotiAttempt = {
  answerId: string;
  questionId: string;
  /** 1-based sitting number for this candidate on this paper. */
  attempts: number;
  score: number;
  correct: number;
  answered: number;
  total: number;
  given: MahotiGivenAnswer[];
};

type AttemptRow = {
  answer_id: string;
  question_id: string;
  attempts: number;
  answer_score: number;
  answer_body: {
    given?: MahotiGivenAnswer[] | null;
    correct?: number;
    answered?: number;
    total?: number;
  } | null;
};

/**
 * How the caller has done on each paper so far: how many times they have sat
 * it, and their best score.
 *
 * What the picker needs to say "הושלם" on a row. Read through the SSR client,
 * not the service-role one, for the same reason `getMahotiAttempt` below does:
 * `mahoti_answers` has a students-select-own policy (20260826000001), so RLS
 * scopes this to the caller's own rows and there is no ownership check to get
 * wrong here. A service-role read would show one candidate another's results.
 *
 * NOTE WHAT THIS CANNOT SEE. A row in `mahoti_answers` is written only when a
 * paper is SUBMITTED — the whole sitting is filed in one call at the end. A
 * paper someone is halfway through has nothing on the server at all; its
 * answers live in that browser's localStorage (lib/sittings/progress.ts). So
 * this answers "finished", never "started", and "בתהליך" has to be decided in
 * the browser. See PaperList.
 *
 * Keyed by `question_id`, so a caller can look up a row it already has without
 * a second query. One row per sitting and a handful of papers, so this is tens
 * of rows for a heavy user rather than a table scan worth paginating.
 */
export type MahotiSittingSummary = {
  sittings: number;
  /** The best score of those sittings, as a percentage. */
  bestScore: number | null;
};

export async function getMyMahotiSittings(): Promise<Record<string, MahotiSittingSummary>> {
  const supabase = await createClient();

  // Scoped by user_id, NOT by RLS alone. `mahoti_answers` carries
  // `mahoti_answers_admins_select USING is_admin()` beside the students-own
  // policy, and policies are OR-ed — so for an admin the students-own one
  // stops narrowing anything and this returned every candidate's sittings,
  // badging the paper picker with other people's scores. Same root cause as
  // the /exam-archive bug; see lib/db/exam-archive.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("mahoti_answers")
    .select("question_id, answer_score")
    .eq("user_id", user.id);

  // A failure here costs the picker its badges, not its list. Throwing would
  // take down a page that works perfectly well without this.
  if (error || !data) return {};

  const byPaper: Record<string, MahotiSittingSummary> = {};
  for (const row of data as { question_id: string; answer_score: number | null }[]) {
    const seen = byPaper[row.question_id] ?? { sittings: 0, bestScore: null };
    seen.sittings += 1;
    if (row.answer_score !== null) {
      seen.bestScore = seen.bestScore === null ? row.answer_score : Math.max(seen.bestScore, row.answer_score);
    }
    byPaper[row.question_id] = seen;
  }
  return byPaper;
}

/**
 * One of the caller's OWN sittings, by id.
 *
 * Read through the SSR client, not the service-role client the rest of this
 * module uses, AND filtered by user_id.
 *
 * The filter is not belt-and-braces here. This used to rely on the
 * students-select-own policy alone, on the reasoning that someone else's
 * answer id simply returns no row — which is true for a candidate and false
 * for an admin, because `mahoti_answers_admins_select USING is_admin()` sits
 * beside it and policies are OR-ed. The id arrives from the query string, so
 * without the filter an admin could open any candidate's marked paper by
 * pasting an id — and /exam-archive was handing them those ids.
 *
 * Null covers every miss — no such id, a malformed one, or a row belonging to
 * another candidate — on purpose: a caller probing ids learns nothing about
 * which ones exist. The review page treats null as "show the paper without
 * marking", which is the same thing it does for a visitor who never sat it.
 */
export async function getMahotiAttempt(
  answerId: string
): Promise<MahotiAttempt | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("mahoti_answers")
    .select("answer_id, question_id, attempts, answer_score, answer_body")
    .eq("answer_id", answerId)
    .eq("user_id", user.id)
    .maybeSingle<AttemptRow>();

  // A malformed uuid is a Postgres cast error rather than an empty result.
  // It means the same thing to this caller as a miss, so it reads as one.
  if (error || !data) return null;

  const given = data.answer_body?.given ?? [];

  return {
    answerId: data.answer_id,
    questionId: data.question_id,
    attempts: data.attempts,
    score: data.answer_score,
    // The counts are stored beside the answers, but fall back to counting the
    // array so a row written before they were added still reports correctly.
    correct: data.answer_body?.correct ?? given.filter((g) => g.is_correct).length,
    answered:
      data.answer_body?.answered ?? given.filter((g) => g.letter !== null).length,
    total: data.answer_body?.total ?? given.length,
    given,
  };
}
