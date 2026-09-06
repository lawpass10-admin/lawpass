"use strict";

// subject-stats.js — one card's worth of numbers per study subject.
//
// Feeds the three squares at the top of the personal dashboard: דין מהותי,
// דין דיוני and מטלת כתיבה. For each, how many QUESTIONS the candidate has
// answered (not how many sittings they opened), and the average, lowest and
// highest score they scored.
//
// READ UNDER THE CALLER'S OWN CLIENT, NOT THE SERVICE ROLE. All three answer
// tables carry a `students_select_own` policy, so RLS already restricts these
// rows to their owner. The explicit `.eq("user_id", …)` below is belt and
// braces, not the boundary — it means a future change that loosened a policy
// would still not leak another candidate's scores through this endpoint.
//
// WHY THE AGGREGATION IS HERE AND NOT IN SQL. Three different shapes have to
// become one: mahoti and diuni store a percentage per sitting plus a jsonb
// body holding the per-question counts, while a writing task stores points
// awarded out of points available. Normalising them in one place is what lets
// the three cards be compared at a glance; pushing it into SQL would mean
// three dialects of the same arithmetic.

// Required at the top rather than inside getTopicStats: neither module requires
// this one back, so there is no cycle to avoid.
const mahotiDb = require("./mahoti");
const diuniDb = require("./diuni");

const MAHOTI_ANSWERS = "mahoti_answers";
const DIUNI_ANSWERS = "diuni_answers";
const OPEN_QUESTION_ANSWERS = "open_question_answers";

/** One decimal, matching how `answer_score` is stored. */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Summarise a list of percentages.
 *
 * Returns nulls rather than zeros for an empty list, and that distinction is
 * the point: a candidate who has never sat a diuni paper has no average, and
 * showing them "0%" would read as a score they earned. The card renders a dash
 * for null.
 */
function summarise(percentages, questions) {
  if (percentages.length === 0) {
    return { attempts: 0, questions, average: null, lowest: null, highest: null };
  }
  const sum = percentages.reduce((a, b) => a + b, 0);
  return {
    attempts: percentages.length,
    questions,
    average: round1(sum / percentages.length),
    lowest: round1(Math.min(...percentages)),
    highest: round1(Math.max(...percentages)),
  };
}

/**
 * A multiple-choice subject: mahoti or diuni. Identical row shape, so one
 * reader serves both.
 *
 * QUESTIONS COUNTED ARE THE ONES ANSWERED, not the paper's length. A candidate
 * who submits 30 of 40 has done 30 questions; the 10 blanks still count against
 * the score (that is the paper's own marking rule) but they are not work done,
 * and a "questions practised" number that goes up when you skip is not one.
 * Older rows written before `answered` was recorded fall back to the total.
 */
async function readChoiceSubject(supabase, userId, table) {
  const { data, error } = await supabase
    .from(table)
    .select("answer_score, answer_body")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = data ?? [];
  const percentages = rows
    .map((r) => Number(r.answer_score))
    .filter((n) => Number.isFinite(n));

  const questions = rows.reduce((sum, r) => {
    const body = r.answer_body ?? {};
    const answered = Number(body.answered);
    const total = Number(body.total);
    if (Number.isFinite(answered)) return sum + answered;
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);

  return summarise(percentages, questions);
}

/**
 * The writing task. One graded answer is one question, so `questions` is a row
 * count rather than a sum.
 *
 * Only GRADED answers count. A submitted-but-unmarked task has `score IS NULL`
 * and would otherwise drag an average toward zero for work that has simply not
 * been read yet — the candidate would watch their average fall by handing work
 * in. The score itself is points out of points, converted to a percentage here
 * so the three cards share one scale.
 */
async function readWritingSubject(supabase, userId) {
  const { data, error } = await supabase
    .from(OPEN_QUESTION_ANSWERS)
    .select("score")
    .eq("user_id", userId)
    .not("score", "is", null);

  if (error) throw error;

  const percentages = [];
  for (const row of data ?? []) {
    const total = Number(row.score?.total);
    const max = Number(row.score?.max);
    // A zero or missing max cannot produce a percentage. Skipped rather than
    // counted as 0%, for the same reason ungraded answers are skipped.
    if (!Number.isFinite(total) || !Number.isFinite(max) || max <= 0) continue;
    percentages.push((total / max) * 100);
  }

  return summarise(percentages, percentages.length);
}

/**
 * All three subjects, in the order the dashboard shows them.
 *
 * Queried in parallel: they touch three unrelated tables and the page cannot
 * paint until the slowest returns, so running them in series would spend three
 * round trips to save nothing.
 */
async function getSubjectStats(supabase, userId) {
  const [mahoti, diuni, writing] = await Promise.all([
    readChoiceSubject(supabase, userId, MAHOTI_ANSWERS),
    readChoiceSubject(supabase, userId, DIUNI_ANSWERS),
    readWritingSubject(supabase, userId),
  ]);

  return [
    { key: "mahoti", label: "דין מהותי", href: "/mahoti", ...mahoti },
    { key: "diuni", label: "דין דיוני", href: "/diuni", ...diuni },
    { key: "writing", label: "מטלת כתיבה", href: "/writing-task", ...writing },
  ];
}

// ---------------------------------------------------------------------------
// Per-topic aggregates — the two charts under each dashboard tab
// ---------------------------------------------------------------------------
//
// The subject cards above answer "how much have I done and how well". These
// answer "in WHICH areas of law", which is the question a candidate acts on:
// one pie showing how their practice is distributed across laws, and one bar
// showing what they actually score in each.
//
// AGGREGATED ACROSS EVERY SITTING, not per attempt. A single paper's breakdown
// already exists on the results screen; what is missing is the picture over all
// the work done, which is the only version that says what to revise next.

/** Questions whose source carries no subject. Matches lib/marking/topic-breakdown.js. */
const UNCLASSIFIED = "ללא סיווג";

/** One decimal, matching how `answer_score` is stored. */
const round1n = (n) => Math.round(n * 10) / 10;

/**
 * Roll every answered question of a multiple-choice subject up by law.
 *
 * THE LAW IS RESOLVED FROM THE PAPER, NOT FROM THE STORED ANSWER, and that is
 * the difference between a chart and a grey blob. Marked answers only began
 * carrying their own `topic` when per-subject scoring was added; every sitting
 * filed before that has none, which put 120 of this candidate's questions into
 * a single "ללא סיווג" slice. Reading it from the paper covers the whole
 * history, and `getAnswerKey` is already the one place that knows how — including
 * that a diuni question's subject is its law for a statute and its judgment area
 * for a judgment.
 *
 * The stored `topic` is still preferred when present: it is what the question was
 * actually marked against, so a paper edited afterwards cannot retroactively
 * rewrite a sitting's breakdown.
 *
 * TWO CLIENTS, ON PURPOSE. The attempts are read with the caller's own
 * RLS-scoped client, so the database restricts them to their owner. The papers
 * are read with the service-role client because `mahoti_questions` /
 * `diuni_questions` are admin-only — they are shared content, not user data.
 */
async function readChoiceTopics(supabase, admin, userId, table, answerKeyFor) {
  const { data, error } = await supabase
    .from(table)
    .select("question_id, attempts, answer_score, created_at, answer_body")
    .eq("user_id", userId)
    // Chronological, because the sittings are numbered in the UI as
    // "מבחן ראשון / שני / …" — the order a candidate sat them, not the order
    // the rows happen to come back in.
    .order("created_at", { ascending: true });

  if (error) throw error;

  const attempts = data ?? [];

  // One lookup per distinct paper, however many sittings there are of it.
  //
  // GROUPED BY AREA, NOT BY LAW. A history grouped by law name produced 32
  // topics over 40 diuni questions, 28 of them holding a single question — and a
  // single question can only ever average 0% or 100%. The area vocabulary
  // (db/legal-areas.js) is coarse enough that a row accumulates enough questions
  // for its average to say something, and it is the same vocabulary for statutes
  // and judgments, so one subject stops appearing twice under two names.
  const areaByPaper = new Map();
  for (const id of new Set(attempts.map((a) => a.question_id).filter(Boolean))) {
    try {
      const key = await answerKeyFor(admin, id);
      areaByPaper.set(id, new Map((key ?? []).map((e) => [e.number, e.area])));
    } catch (error) {
      // A paper we cannot READ costs its questions their area, not the whole
      // chart — they fall through to "ללא סיווג" below.
      //
      // A programming error is not that, and must not be swallowed. This catch
      // was briefly broad enough to absorb a ReferenceError from a missing
      // import, which turned a crash into a chart that quietly reported all 80
      // questions as unclassified — the worst of both outcomes, because it
      // looked like data rather than a bug.
      if (error instanceof TypeError || error instanceof ReferenceError) throw error;
      areaByPaper.set(id, new Map());
    }
  }

  // Counted TWICE over the same answers: once into the overall picture, and
  // once per sitting. Both come from one pass so the per-sitting rows can never
  // disagree with the total they are supposed to add up to.
  const overall = new Map();
  const perSitting = [];

  attempts.forEach((attempt, index) => {
    const fromPaper = areaByPaper.get(attempt.question_id);
    const sitting = new Map();

    for (const g of attempt.answer_body?.given ?? []) {
      // The stored per-answer value is a LAW name, not an area, so it is not a
      // fallback here — mixing the two vocabularies is the bug being fixed.
      const topic = fromPaper?.get(g.number) || UNCLASSIFIED;
      for (const target of [overall, sitting]) {
        const row = target.get(topic) ?? { topic, questions: 0, correct: 0 };
        row.questions += 1;
        if (g.is_correct) row.correct += 1;
        target.set(topic, row);
      }
    }

    perSitting.push({
      // 1-based position in the candidate's own history of this subject. NOT
      // `answer_body.attempts`, which counts sittings of ONE paper and so
      // repeats across papers — two different exams would both be "מבחן ראשון".
      index: index + 1,
      attemptOfPaper: attempt.attempts ?? null,
      questionId: attempt.question_id,
      score: attempt.answer_score ?? null,
      createdAt: attempt.created_at ?? null,
      rows: withPercent(sitting),
    });
  });

  return { all: withPercent(overall), sittings: perSitting };
}

/** Turn accumulated counts into ordered rows carrying their percentage. */
function withPercent(map) {
  return finalise(
    [...map.values()].map((r) => ({
      ...r,
      percent: r.questions > 0 ? round1n((r.correct / r.questions) * 100) : 0,
    }))
  );
}

/**
 * The writing task, grouped by `open_questions.subject`.
 *
 * One graded answer is one question, and its score is points out of points, so
 * a topic's percentage is the mean of its answers' percentages rather than a
 * ratio of counts. Ungraded answers are excluded for the same reason they are
 * excluded from the card above: a task nobody has marked yet is not a zero.
 */
async function readWritingTopics(supabase, userId) {
  const { data, error } = await supabase
    .from(OPEN_QUESTION_ANSWERS)
    .select("score, open_questions(subject)")
    .eq("user_id", userId)
    .not("score", "is", null);

  if (error) throw error;

  const rows = new Map();
  for (const answer of data ?? []) {
    const total = Number(answer.score?.total);
    const max = Number(answer.score?.max);
    if (!Number.isFinite(total) || !Number.isFinite(max) || max <= 0) continue;

    // The embed is an object for a to-one relation, but PostgREST returns an
    // array shape in some versions; both are handled so a client upgrade does
    // not silently drop every subject into "unclassified".
    const embedded = answer.open_questions;
    const subject =
      (Array.isArray(embedded) ? embedded[0]?.subject : embedded?.subject) || UNCLASSIFIED;

    const row = rows.get(subject) ?? { topic: subject, questions: 0, sum: 0 };
    row.questions += 1;
    row.sum += (total / max) * 100;
    rows.set(subject, row);
  }

  // Same envelope as the two exam subjects so the client has one shape to read,
  // with no sittings: a writing task is one answer marked on its own, not a
  // paper sat end to end, so "מבחן ראשון" has nothing to point at.
  return {
    all: finalise(
      [...rows.values()].map(({ topic, questions, sum }) => ({
        topic,
        questions,
        // No correct/incorrect split exists for a written answer; the chart
        // reads `percent` and derives the remainder.
        correct: null,
        percent: questions > 0 ? round1n(sum / questions) : 0,
      }))
    ),
    sittings: [],
  };
}

/**
 * Order for display: most-practised first.
 *
 * The pie is read as "where has my time gone", so its slices belong in size
 * order; the bar beside it shares the ordering so a law occupies the same
 * position in both and the two can be read together.
 */
function finalise(rows) {
  return rows.sort(
    (a, b) => b.questions - a.questions || a.topic.localeCompare(b.topic, "he")
  );
}

/** All three subjects' per-topic aggregates, keyed by subject. */
async function getTopicStats(supabase, admin, userId) {
  const [mahoti, diuni, writing] = await Promise.all([
    readChoiceTopics(supabase, admin, userId, MAHOTI_ANSWERS, mahotiDb.getAnswerKey),
    readChoiceTopics(supabase, admin, userId, DIUNI_ANSWERS, diuniDb.getAnswerKey),
    readWritingTopics(supabase, userId),
  ]);

  return { mahoti, diuni, writing };
}

module.exports = { getSubjectStats, getTopicStats, summarise };
