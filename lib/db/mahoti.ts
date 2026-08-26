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

export type MahotiSource = {
  law_id: number;
  law_name: string;
  section_number: string;
  /** The sentence from the notebook the question was built on. Verified
   *  against `question_notebook` before the row was ever written. */
  source_quote: string;
};

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
  questionId?: string
): Promise<MahotiSet | null> {
  const supabase = createAdminClient();

  const base = supabase
    .from(TABLE)
    .select("question_id, created_at, questions, question_notebook")
    .not("questions", "is", null);

  const { data, error } = questionId
    ? await base.eq("question_id", questionId).maybeSingle<Row>()
    : await base
        .order("created_at", { ascending: false })
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
    title: data.questions.exam?.title ?? "דיון מהותי",
    questions: stripAnswers(data.questions.questions),
    notebook: data.question_notebook,
  };
}

/**
 * The paper that follows `currentId` in the table's own order — what
 * "למבחן הבא" moves to at the end of a review.
 *
 * The order is the one the screen already implies: newest first, the same
 * `created_at DESC` the default read uses, so "next" walks backwards through
 * the papers as they were generated. It wraps at the end rather than dead-
 * ending, so a candidate who reaches the oldest paper is sent round to the
 * newest instead of hitting a disabled button.
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

  const { data, error } = await supabase
    .from(TABLE)
    .select("question_id")
    .not("questions", "is", null)
    .order("created_at", { ascending: false });

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
  return sources.map((source) =>
    source.source_quote
      ? `${source.law_name}, סעיף ${source.section_number} — "${source.source_quote}"`
      : `${source.law_name}, סעיף ${source.section_number}`
  );
}

/**
 * The review for one generated paper — the same row `getMahotiSet` reads for
 * the same `questionId`, so the questions the candidate answered and the
 * review behind them line up. Without an id it falls back to the newest
 * paper, which is the one the study screen shows by default.
 *
 * Questions whose `correct_answer` names no option are dropped rather than
 * rendered with an empty answer banner: the panel's whole frame is built
 * around a correct choice, and a review that cannot say which answer is right
 * is worse than one question short.
 */
export async function getMahotiReview(
  questionId?: string
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

  const { data, error } = questionId
    ? await base.eq("question_id", questionId).maybeSingle<ReviewRow>()
    : await base
        .order("created_at", { ascending: false })
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
 * One of the caller's OWN sittings, by id.
 *
 * Read through the SSR client, not the service-role client the rest of this
 * module uses — and that difference is the authorization. `mahoti_answers` has
 * a students-select-own policy (20260826000001), so RLS scopes this to
 * `user_id = auth.uid()`: someone else's answer id simply returns no row. That
 * is why there is no ownership check in this function, and why there must not
 * be a service-role read here.
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

  const { data, error } = await supabase
    .from("mahoti_answers")
    .select("answer_id, question_id, attempts, answer_score, answer_body")
    .eq("answer_id", answerId)
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
