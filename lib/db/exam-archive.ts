/**
 * The candidate's own filed exams, for /exam-archive — one list per subject.
 *
 * TWO CLIENTS, AND WHICH ONE READS WHAT IS THE AUTHORIZATION.
 *
 *   * The answer rows are read through the SSR client. mahoti_answers,
 *     diuni_answers and open_question_answers all carry a
 *     students-select-own policy, so RLS scopes every read to
 *     `user_id = auth.uid()` — there is no user id parameter here, and there
 *     must never be one.
 *   * The paper TITLES are read through the service-role client, because
 *     mahoti_questions and diuni_questions are admin-only under RLS (see the
 *     note at the top of lib/db/mahoti.ts). That read is keyed only by ids taken
 *     from the caller's own rows, and only a title comes back — so it can reach
 *     no paper the candidate has not sat, and nothing of any paper but its name.
 *
 * Each entry links to the screen that already shows that sitting in full — the
 * paper, the candidate's answers, the correct ones and the 360 review — so the
 * archive is an index, not a second copy of those pages.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ArchiveEntry = {
  answerId: string;
  /** The paper's own name, or the subject's name when it has none. */
  title: string;
  /** 1-based sitting number of this candidate on this paper. */
  attempt: number;
  createdAt: string;
  /** Short result line: "75%", "17 / 20", or a marking status. */
  result: string;
  /** Where the full sitting opens. */
  href: string;
};

export type ExamArchive = {
  mahoti: ArchiveEntry[];
  diuni: ArchiveEntry[];
  writing: ArchiveEntry[];
};

/**
 * How many sittings each tab lists. A candidate filing every day for a year is
 * well under this; the cap is a guard against one query returning everything
 * forever, not a paging UI in disguise.
 */
const PER_SUBJECT = 200;

type McqAnswerRow = {
  answer_id: string;
  question_id: string;
  attempts: number;
  answer_score: number;
  created_at: string;
};

type WritingAnswerRow = {
  answer_id: string;
  open_question_id: string;
  attempt_number: number | null;
  grading_status: string | null;
  score: { total?: number; max?: number } | null;
  created_at: string;
};

const GRADING_LABEL: Record<string, string> = {
  pending: "ממתין לבדיקה",
  grading: "בבדיקה",
  failed: "הבדיקה לא הושלמה",
};

/** Percent with at most one decimal, and no ".0" on a whole number. */
function percent(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * Titles for a set of multiple-choice papers, keyed by question_id.
 * `table` is mahoti_questions or diuni_questions — the two share a shape.
 */
async function mcqTitles(
  table: "mahoti_questions" | "diuni_questions",
  ids: string[],
  fallback: string
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("question_id, title:questions->exam->>title")
    .in("question_id", ids)
    .returns<{ question_id: string; title: string | null }[]>();

  if (error) throw new Error(`failed to read ${table} titles: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.question_id, row.title || fallback]));
}

async function listMcq(
  answersTable: "mahoti_answers" | "diuni_answers",
  questionsTable: "mahoti_questions" | "diuni_questions",
  route: "/mahoti/review" | "/diuni/review",
  fallbackTitle: string
): Promise<ArchiveEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(answersTable)
    .select("answer_id, question_id, attempts, answer_score, created_at")
    .order("created_at", { ascending: false })
    .limit(PER_SUBJECT)
    .returns<McqAnswerRow[]>();

  if (error) throw new Error(`failed to read ${answersTable}: ${error.message}`);
  const rows = data ?? [];

  const titles = await mcqTitles(
    questionsTable,
    [...new Set(rows.map((r) => r.question_id))],
    fallbackTitle
  );

  return rows.map((row) => ({
    answerId: row.answer_id,
    title: titles.get(row.question_id) ?? fallbackTitle,
    attempt: row.attempts,
    createdAt: row.created_at,
    result: percent(row.answer_score),
    // The attempt form of the review: marked from the stored sitting, matched by
    // question number — see the note at the top of the review page.
    href: `${route}?attempt=${encodeURIComponent(row.answer_id)}`,
  }));
}

async function listWriting(): Promise<ArchiveEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("open_question_answers")
    .select("answer_id, open_question_id, attempt_number, grading_status, score, created_at")
    .order("created_at", { ascending: false })
    .limit(PER_SUBJECT)
    .returns<WritingAnswerRow[]>();

  if (error) throw new Error(`failed to read open_question_answers: ${error.message}`);
  const rows = data ?? [];

  const ids = [...new Set(rows.map((r) => r.open_question_id))];
  const titles = new Map<string, string>();
  if (ids.length > 0) {
    const admin = createAdminClient();
    const { data: questions, error: qErr } = await admin
      .from("open_questions")
      .select("open_question_id, angle_title:question->>angle_title, title:question->>title")
      .in("open_question_id", ids)
      .returns<{ open_question_id: string; angle_title: string | null; title: string | null }[]>();
    if (qErr) throw new Error(`failed to read open_questions titles: ${qErr.message}`);
    for (const q of questions ?? []) {
      titles.set(q.open_question_id, q.angle_title || q.title || "מטלת כתיבה");
    }
  }

  return rows.map((row) => {
    const graded =
      row.grading_status === "graded" &&
      typeof row.score?.total === "number" &&
      typeof row.score?.max === "number";
    return {
      answerId: row.answer_id,
      title: titles.get(row.open_question_id) ?? "מטלת כתיבה",
      attempt: row.attempt_number ?? 1,
      createdAt: row.created_at,
      result: graded
        ? `${row.score!.total} / ${row.score!.max}`
        : (GRADING_LABEL[row.grading_status ?? ""] ?? "ממתין לבדיקה"),
      href: `/writing-task/results/${encodeURIComponent(row.answer_id)}`,
    };
  });
}

/** Every sitting the signed-in candidate has filed, newest first, per subject. */
export async function getMyExamArchive(): Promise<ExamArchive> {
  const [mahoti, diuni, writing] = await Promise.all([
    listMcq("mahoti_answers", "mahoti_questions", "/mahoti/review", "דין מהותי"),
    listMcq("diuni_answers", "diuni_questions", "/diuni/review", "דין דיוני"),
    listWriting(),
  ]);
  return { mahoti, diuni, writing };
}
