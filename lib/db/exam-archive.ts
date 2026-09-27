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
 *   * Writing-task TITLES are read through the service-role client. That read
 *     is keyed only by ids taken from the caller's own rows, and only a title
 *     comes back — so it can reach no task the candidate has not sat, and
 *     nothing of any task but its name. Multiple-choice sittings need no such
 *     read: they are titled by number, see listMcq.
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
  /** The 40-question timed simulation at /exam. */
  simulation: ArchiveEntry[];
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
 * A multiple-choice subject's sittings, titled "<subject> — מבחן N".
 *
 * NUMBERED, NOT NAMED. The papers' own stored titles do not tell sittings
 * apart: every מהותי paper is called "דיון מהותי" and every דיוני one
 * "דין דיוני — מבחן 1", so the list read as the same line over and over. N is
 * the sitting's place in the candidate's own history for this subject — the
 * first exam they ever filed is מבחן 1 — so a number, once seen, stays attached
 * to that sitting as more are added. A retake of the same paper is a new
 * sitting and gets its own number; which retake it was stays on the subtitle
 * (ניסיון k), next to the date.
 *
 * Counted with `count: "exact"` rather than from the rows returned, so the
 * numbers stay true for a candidate with more sittings than PER_SUBJECT: the
 * newest row is always number `count`, whatever the cap cut off below it.
 */
async function listMcq(
  answersTable: "mahoti_answers" | "diuni_answers",
  route: "/mahoti/review" | "/diuni/review",
  subject: string
): Promise<ArchiveEntry[]> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from(answersTable)
    .select("answer_id, question_id, attempts, answer_score, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(PER_SUBJECT)
    .returns<McqAnswerRow[]>();

  if (error) throw new Error(`failed to read ${answersTable}: ${error.message}`);
  const rows = data ?? [];
  const total = count ?? rows.length;

  return rows.map((row, index) => ({
    answerId: row.answer_id,
    title: `${subject} — מבחן ${total - index}`,
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

/** What each sampling pool is called on screen, matching the /exam intro. */
const SIMULATION_MODE_LABELS: Record<string, string> = {
  procedural: "דיוני בלבד",
  substantive: "מהותי בלבד",
  combined: "משולב",
};

type ExamSessionArchiveRow = {
  id: string;
  mode: string | null;
  final_score: number | null;
  completed_at: string | null;
  created_at?: string | null;
};

/**
 * Completed runs of the timed simulation.
 *
 * THE ONE READ IN THIS FILE THAT FILTERS BY USER ID, and deliberately so.
 * Everywhere else RLS is the whole authorization story, but `exam_sessions`
 * carries a second policy — `admins_view_exam_sessions` grants an admin
 * SELECT over every row. Without the filter an admin opening their own
 * archive would be handed the entire cohort's sittings. The filter is scoped
 * to the signed-in caller's id, so it narrows, never widens.
 *
 * Only completed sittings appear: an abandoned or still-running one has no
 * result to show, and a live one belongs in the player, not the archive.
 */
async function listSimulations(): Promise<ArchiveEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error, count } = await supabase
    .from("exam_sessions")
    .select("id, mode, final_score, completed_at", { count: "exact" })
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(PER_SUBJECT)
    .returns<ExamSessionArchiveRow[]>();

  if (error) throw new Error(`failed to read exam_sessions: ${error.message}`);
  const rows = data ?? [];
  const total = count ?? rows.length;

  return rows.map((row, index) => {
    const label = SIMULATION_MODE_LABELS[row.mode ?? ""] ?? null;
    return {
      answerId: row.id,
      title: label
        ? `סימולציה (${label}) — מבחן ${total - index}`
        : `סימולציה — מבחן ${total - index}`,
      // The simulation has no per-paper re-sit counter the way a fixed paper
      // does — each run samples its own questions, so the sitting number IS
      // its position in this list.
      attempt: total - index,
      createdAt: row.completed_at ?? "",
      // Marked out of 40, the same total the intro screen promises. A row
      // that somehow completed without a score says so rather than showing
      // "0 / 40", which would read as having got everything wrong.
      result: row.final_score === null ? "—" : `${row.final_score} / 40`,
      href: `/exam/results/${encodeURIComponent(row.id)}`,
    };
  });
}

/** Every sitting the signed-in candidate has filed, newest first, per subject. */
export async function getMyExamArchive(): Promise<ExamArchive> {
  const [mahoti, diuni, writing, simulation] = await Promise.all([
    listMcq("mahoti_answers", "/mahoti/review", "דין מהותי"),
    listMcq("diuni_answers", "/diuni/review", "דין דיוני"),
    listWriting(),
    listSimulations(),
  ]);
  return { mahoti, diuni, writing, simulation };
}
