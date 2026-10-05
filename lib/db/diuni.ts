/**
 * Reads the `diuni_questions` table — a generated דין דיוני paper and the
 * review content for its questions.
 *
 * The sibling of lib/db/mahoti.ts, and deliberately the same shape. The one
 * structural difference is what the questions are grounded in: mahoti carries
 * its legislation notebook in the same row, while a diuni paper points at rows
 * in `verdict_list` (see 20260831000003). Each question keeps its grounding
 * quotes on `sources`, so the review can show what the answer rests on without
 * this module reading the judgments at all.
 *
 * Access: `diuni_questions` has RLS enabled with admin-only policies, so a
 * subscriber reading their own study screen would be rejected by policy. This
 * module therefore reads through the service-role client, behind the page's own
 * `requireActiveSubscription()` gate — the same deliberate bypass lib/db/mahoti.ts
 * documents, for the same reason: the content is authoring-side legal text with
 * no per-user rows in it. If a `TO authenticated USING (…)` SELECT policy is
 * ever added to the table, swap `createAdminClient()` for the SSR client and
 * delete this note.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Choice, Question360 } from "@/lib/db/practice";
import {
  DEFAULT_PAPER_ORDER,
  visibleToViewerFilter,
} from "@/lib/db/paper-visibility";

const TABLE = "diuni_questions";

export type DiuniLetter = "א" | "ב" | "ג" | "ד";

export type DiuniOption = {
  letter: DiuniLetter;
  text: string;
};

/**
 * A passage the question rests on, verified verbatim against its origin at
 * generation time — see scripts/diuni/generate-diuni-set.mjs.
 *
 * Two origins, because the paper is built from two kinds of material: a
 * judgment (verdict_list) or a statutory section (mahoti_laws). `kind` says
 * which, so nothing downstream has to infer it from which fields happen to be
 * present.
 */
export type DiuniVerdictSource = {
  kind?: "verdict";
  verdict_id: string;
  case_number: string;
  role: string;
  quote: string;
};

export type DiuniLawSource = {
  kind: "law";
  law_id: number;
  law_name: string;
  section_number: string;
  role: string;
  quote: string;
};

export type DiuniSource = DiuniVerdictSource | DiuniLawSource;

/**
 * One question as the study screen sees it. `correct_answer` is deliberately
 * absent: the row carries it, and `stripAnswers` below drops it server-side
 * before anything reaches the client — the same rule the exam player and the
 * mahoti screen follow.
 */
export type DiuniQuestion = {
  number: number;
  fact_pattern: string;
  stem: string;
  options: DiuniOption[];
  sources: DiuniSource[];
};

export type DiuniSet = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questions: DiuniQuestion[];
};

/** The `questions` jsonb, before the answer key is removed. */
type StoredQuestion = DiuniQuestion & { correct_answer?: DiuniLetter };

type QuestionsPayload = {
  exam?: { title?: string } | null;
  questions?: StoredQuestion[] | null;
};

/** The `question_review` jsonb — one entry per question, aligned to
 *  `questions` by `number`. Field names follow mahoti's StoredReview: note
 *  `explanation`, not `full_explanation`. */
type StoredReview = {
  number: number;
  legal_topic_analysis?: string;
  explanation?: string;
  common_pitfall?: string;
  quick_thinking_360?: string;
  summary_for_memory?: string;
  concepts_and_skills?: string[];
  distractor_analysis?: Partial<Record<DiuniLetter, string>>;
};

type ReviewPayload = {
  questions?: StoredReview[] | null;
};

type Row = {
  question_id: string;
  created_at: string | null;
  exam_number: number | null;
  questions: QuestionsPayload | null;
};

function stripAnswers(questions: StoredQuestion[]): DiuniQuestion[] {
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
 * `questions IS NULL` is a normal intermediate state — a row can exist before
 * its questions are generated — so those rows are skipped rather than treated
 * as an error. Returns null when the table holds nothing usable; the page then
 * renders an empty state instead of throwing, since this is authoring content
 * that may simply not be loaded yet on a given environment.
 */
export async function getDiuniSet(
  questionId: string | undefined,
  viewerId: string
): Promise<DiuniSet | null> {
  const supabase = createAdminClient();

  const base = supabase
    .from(TABLE)
    .select("question_id, created_at, exam_number, questions")
    .not("questions", "is", null);

  const { data, error } = questionId
    ? // The id comes from `?set=` and is untrusted — same fix, same reasoning
      // as lib/db/mahoti.ts. See lib/db/paper-visibility.ts.
      await base
        .eq("question_id", questionId)
        .or(visibleToViewerFilter(viewerId))
        .maybeSingle<Row>()
    : // Published papers only — see the same filters in lib/db/mahoti.ts. Custom
      // exams share this table, and this branch answers with מבחן מספר 1, the
      // paper the picker preselects, so /diuni with no ?set= opens the same
      // thing. Without the filters, a candidate's own exam or a freshly
      // generated draft would silently become everyone's default paper.
      await base
        .eq("exam_status", "prod")
        .is("built_for", null)
        .order("exam_number", { ascending: true })
        .limit(1)
        .maybeSingle<Row>();

  if (error) {
    throw new Error(`failed to read ${TABLE}: ${error.message}`);
  }
  if (!data?.questions?.questions?.length) return null;

  return {
    questionId: data.question_id,
    createdAt: data.created_at,
    title: examTitle(data.exam_number, data.questions.exam?.title, "דין דיוני"),
    questions: stripAnswers(data.questions.questions),
  };
}

/**
 * One line in the paper picker — enough to choose between papers, and
 * deliberately not enough to sit one. The mahoti twin of this type carries a
 * law count as well; a diuni paper has no notebook behind it, so a paper's
 * size here is its question count alone.
 *
 * `questionCount` is nullable because it is read out of the stored json rather
 * than counted: a row written before the loader recorded `exam.question_count`
 * has no number to show, which the picker renders as a paper with no subtitle
 * rather than as a paper with "0 שאלות".
 */
export type DiuniSetSummary = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questionCount: number | null;
};

/**
 * How many of a candidate's OWN papers the custom list offers.
 *
 * Only the authored list is governed by `exam_status`; a paper someone built
 * for themselves is never published, so it needs a plain cap instead. One, as
 * before — the custom builder overwrites rather than accumulates in practice.
 */
export const DIUNI_CUSTOM_PICKER_LIMIT = 1;

/**
 * The name a published paper is shown under: מבחן מספר 1, מבחן מספר 2.
 *
 * The twin of `examTitle` in lib/db/mahoti.ts — see the note there. Derived
 * from `exam_number` rather than read from `questions -> exam -> title`, which
 * every generated row sets to the same "דין דיוני"; the stored title is left
 * alone because it records what the generator produced.
 */
function examTitle(examNumber: number | null, storedTitle: string | undefined, fallback: string) {
  if (examNumber !== null && examNumber !== undefined) return `מבחן מספר ${examNumber}`;
  return storedTitle ?? fallback;
}

/** The `questions -> exam` sub-object, which is all the picker reads.
 *  Selecting the whole `questions` array to count it would pull the entire
 *  paper for every line of a one-line-per-paper list. */
type SummaryRow = {
  question_id: string;
  created_at: string | null;
  exam_number: number | null;
  exam: { title?: string; question_count?: number } | null;
};

/**
 * The authored papers a candidate may open, newest first.
 *
 * Same filters as the default read in `getDiuniSet`: `built_for IS NULL` keeps
 * one candidate's custom exam out of everyone else's list, and a row without
 * `questions` is an intermediate state rather than a paper.
 */
/**
 * The candidate's OWN custom-built papers, newest first.
 *
 * The mirror of listMyCustomMahotiSets — see the note there. `listDiuniSets`
 * excludes these on purpose, which until now left a custom exam reachable
 * only by the `?set=` URL the builder redirected to.
 *
 * THE `built_for` FILTER IS THE AUTHORIZATION: this read uses the
 * service-role client because the table is admin-only under RLS, so there is
 * no policy underneath to scope the rows.
 */
export async function listMyCustomDiuniSets(
  userId: string,
  limit: number = DIUNI_CUSTOM_PICKER_LIMIT
): Promise<DiuniSetSummary[]> {
  if (!userId) return [];
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("question_id, created_at, exam_number, exam:questions->exam")
    .eq("built_for", userId)
    .not("questions", "is", null)
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
  }));
}

/**
 * Every published paper, מבחן מספר 1 first.
 *
 * `exam_status = 'prod'` replaced "the newest row, capped at one": publication
 * is now a deliberate step (scripts/diuni/publish-exam.mjs), so generating a
 * paper no longer puts it in front of candidates by itself, and there is no
 * longer a cap to raise when a second paper is ready. See the migration
 * 20261004000002_diuni_exam_publication.sql.
 *
 * Ordered by `exam_number` ascending rather than by `created_at`: a numbered
 * series reads 1, 2, 3, the way a candidate works through it, and the first row
 * is the one PaperChoice preselects.
 *
 * `built_for IS NULL` stays, though the table now also forbids publishing a
 * custom paper: it is the filter the other reads here use, and a read that
 * depends on a CHECK constraint elsewhere for its authorization is harder to
 * verify than one that states its own.
 */
export async function listDiuniSets(): Promise<DiuniSetSummary[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("question_id, created_at, exam_number, exam:questions->exam")
    .eq("exam_status", "prod")
    .is("built_for", null)
    .not("questions", "is", null)
    .order("exam_number", { ascending: true })
    .returns<SummaryRow[]>();

  if (error) {
    throw new Error(`failed to list ${TABLE}: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    questionId: row.question_id,
    createdAt: row.created_at,
    title: examTitle(row.exam_number, row.exam?.title, "דין דיוני"),
    questionCount: row.exam?.question_count ?? null,
  }));
}

/**
 * The paper that follows `currentId` in the table's own order — what
 * "למבחן הבא" moves to at the end of a review. Wraps at the end rather than
 * dead-ending. Returns null when there is nothing to move to.
 */
export async function getNextDiuniSetId(
  currentId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Published papers only. "למבחן הבא" walks this list in series order, so it
  // runs מבחן מספר 1 → 2 and wraps. Custom exams belong to one candidate each —
  // including another candidate's exam here would hand one person's private
  // paper to everyone who finished a review — and an unpublished draft would do
  // the same with a paper nobody has approved.
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
  if (at === -1) return ids[0];
  return ids[(at + 1) % ids.length];
}

// ---------------------------------------------------------------------------
// Review — the answer key and the 360° content
// ---------------------------------------------------------------------------

export type DiuniReviewItem = {
  number: number;
  fact_pattern: string;
  stem: string;
  correctChoice: Choice;
  question: Question360;
  /**
   * The subject this question belongs to — the law for a statute-grounded
   * question, the judgment's area of practice for a judgment-grounded one.
   * Resolved exactly as the server resolves it when marking a sitting
   * (lawpass_server/db/diuni.js#topicOf), so a mid-sitting check and a filed
   * sitting group the same paper into the same rows. Null rather than a guess.
   */
  topic: string | null;
};

export type DiuniReview = {
  questionId: string;
  title: string;
  items: DiuniReviewItem[];
};

function toChoices(
  question: StoredQuestion,
  review: StoredReview | undefined
): Choice[] {
  return (question.options ?? []).map((option, i) => ({
    // No choices table behind these — the id only has to be unique within the
    // question, and the panel uses it as a React key.
    id: `${question.number}-${option.letter}`,
    letter: option.letter,
    choice_text: option.text,
    is_correct: option.letter === question.correct_answer,
    distractor_analysis: review?.distractor_analysis?.[option.letter] ?? null,
    display_order: i,
  }));
}

/**
 * The passages a question rests on, as reference lines.
 *
 * A statute reference reads the way the Bar's own answer key cites one — law,
 * section, then the words relied on. A judgment reference leads with the case
 * number, which is how a candidate would look it up. Either way the `role`
 * explains what the passage does in the answer, which is what makes the list
 * readable rather than a wall of quotation.
 */
function toReferences(sources: DiuniSource[]): string[] {
  return sources.map((source) => {
    const cite =
      source.kind === "law"
        ? `${source.law_name}, סעיף ${source.section_number}`
        : source.case_number;
    return source.role
      ? `${cite} — ${source.role}: "${source.quote}"`
      : `${cite} — "${source.quote}"`;
  });
}

/**
 * The subject a question belongs to, for the per-subject table.
 *
 * TWO KINDS OF QUESTION, TWO KINDS OF SUBJECT. A statute-grounded question is
 * about a named law, and that name is already on the question's own `sources`.
 * A judgment-grounded one is not about a law at all — its subject is the area of
 * practice the judgment sits in, which lives on `verdict_list` and reaches here
 * through `areaByVerdict`.
 *
 * A port of `topicOf` in lawpass_server/db/diuni.js, which decides the same
 * thing at marking time. The two must agree: a candidate who checks their work
 * mid-sitting and then files the paper would otherwise be shown the same
 * questions grouped two different ways.
 */
function topicOf(
  question: StoredQuestion,
  areaByVerdict: Map<string, string>
): string | null {
  const source = (question.sources ?? [])[0];
  if (!source) return null;
  if (source.kind === "law") return source.law_name ?? null;
  return areaByVerdict.get(source.verdict_id) ?? null;
}

/**
 * The judgment area behind every judgment-grounded question of a paper.
 *
 * One join for the whole paper, not one per question — and none at all for a
 * paper built entirely from statutes, which carries no verdict ids to look up.
 */
async function getJudgmentAreas(
  questions: StoredQuestion[]
): Promise<Map<string, string>> {
  const verdictIds = [
    ...new Set(
      questions
        .map((q) => (q.sources ?? [])[0])
        .filter(
          (source): source is DiuniVerdictSource =>
            !!source && source.kind !== "law" && !!source.verdict_id
        )
        .map((source) => source.verdict_id)
    ),
  ];

  const areaByVerdict = new Map<string, string>();
  if (verdictIds.length === 0) return areaByVerdict;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("verdict_list")
    .select("verdict_id, judgment_area")
    .in("verdict_id", verdictIds)
    .returns<{ verdict_id: string; judgment_area: string | null }[]>();

  if (error) {
    throw new Error(`failed to read verdict_list: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (row.judgment_area) areaByVerdict.set(row.verdict_id, row.judgment_area);
  }
  return areaByVerdict;
}

/**
 * The review for one generated paper — the same row `getDiuniSet` reads for the
 * same `questionId`, so the questions the candidate answered and the review
 * behind them line up.
 *
 * Questions whose `correct_answer` names no option are dropped rather than
 * rendered with an empty answer banner: the panel's whole frame is built around
 * a correct choice, and a review that cannot say which answer is right is worse
 * than one question short.
 */
export async function getDiuniReview(
  questionId: string | undefined,
  viewerId: string
): Promise<DiuniReview | null> {
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

  // Both branches filtered, and the default now shares getDiuniSet's ordering
  // so the review and the questions are the same paper — see the fuller note
  // on getMahotiReview in lib/db/mahoti.ts.
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

  const areaByVerdict = await getJudgmentAreas(data.questions.questions);

  const items: DiuniReviewItem[] = [];
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
      topic: topicOf(question, areaByVerdict),
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
    title: data.questions.exam?.title ?? "דין דיוני",
    items,
  };
}

// ---------------------------------------------------------------------------
// Sittings — what a candidate answered, as it was filed and marked
// ---------------------------------------------------------------------------

/** One question of a filed sitting, as `answer_body.given` stores it. */
export type DiuniGivenAnswer = {
  number: number;
  /** Null when the question was left blank. */
  letter: DiuniLetter | null;
  /** The key AT THE TIME OF MARKING — snapshot, not looked up again. */
  correct_letter: DiuniLetter | null;
  is_correct: boolean;
  /**
   * The law or judgment area the question came from, stamped on at marking time
   * so the per-subject table can be recomputed from the row alone — see
   * `breakdownByTopic`. Optional because sittings filed before the server
   * started carrying it have entries without one; they group under "ללא סיווג".
   */
  topic?: string | null;
};

export type DiuniAttempt = {
  answerId: string;
  questionId: string;
  attempts: number;
  score: number;
  correct: number;
  answered: number;
  total: number;
  given: DiuniGivenAnswer[];
};

type AttemptRow = {
  answer_id: string;
  question_id: string;
  attempts: number;
  answer_score: number;
  answer_body: {
    given?: DiuniGivenAnswer[] | null;
    correct?: number;
    answered?: number;
    total?: number;
  } | null;
};

/**
 * One of the caller's OWN sittings, by id.
 *
 * Read through the SSR client, not the service-role client the rest of this
 * module uses — and that difference is the authorization. `diuni_answers` has a
 * students-select-own policy, so RLS scopes this to `user_id = auth.uid()`:
 * someone else's answer id simply returns no row. Null covers every miss on
 * purpose, so a caller probing ids learns nothing about which ones exist.
 */
export async function getDiuniAttempt(
  answerId: string
): Promise<DiuniAttempt | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diuni_answers")
    .select("answer_id, question_id, attempts, answer_score, answer_body")
    .eq("answer_id", answerId)
    .maybeSingle<AttemptRow>();

  // A malformed uuid is a Postgres cast error rather than an empty result. It
  // means the same thing to this caller as a miss, so it reads as one.
  if (error || !data) return null;

  const given = data.answer_body?.given ?? [];

  return {
    answerId: data.answer_id,
    questionId: data.question_id,
    attempts: data.attempts,
    score: data.answer_score,
    correct: data.answer_body?.correct ?? given.filter((g) => g.is_correct).length,
    answered:
      data.answer_body?.answered ?? given.filter((g) => g.letter !== null).length,
    total: data.answer_body?.total ?? given.length,
    given,
  };
}
