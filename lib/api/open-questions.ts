"use client";

/**
 * Writing task (מטלת כתיבה) — client wrapper over the Express API.
 *
 * Unlike the other modules in this folder, there is NO server-action fallback:
 * this feature was built after the extraction, so lawpass_server is its only
 * backend. When NEXT_PUBLIC_API_BASE_URL is unset (production today) the calls
 * below return a clear Hebrew error instead of failing with an opaque fetch
 * error against a relative URL.
 */

import { apiEnabled, apiGetJson, apiPostJson } from "@/lib/api/client";

export type OpenQuestionSubject = {
  subject: string;
  count: number;
  latest: string;
};

export type OpenQuestionListEntry = {
  open_question_id: string;
  title: string;
  external_id: string | null;
  difficulty_level: string | null;
  deliverable: string | null;
  answer_limit: string | null;
  created_at: string;
};

export type OpenQuestionQuote = {
  id: string;
  type?: string;
  citation?: string;
  text?: string;
};

export type OpenQuestionTimelineEntry = { date?: string; event?: string };

/**
 * The candidate's paper. The exam-writer fields (legal_topic_analysis,
 * model_answer_outline, common_pitfall) are absent by construction — the
 * server's allowlist never sends them, so they cannot be typed here either.
 */
export type OpenQuestionDetail = {
  open_question_id: string;
  subject: string | null;
  type: string;
  created_at: string;
  external_id?: string;
  question_type?: string;
  angle_title?: string;
  title?: string;
  difficulty_level?: string;
  client_role?: string;
  deliverable?: string;
  fact_pattern?: string;
  task_instructions?: string;
  answer_limit?: string;
  timeline?: OpenQuestionTimelineEntry[];
  quotes: OpenQuestionQuote[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DISABLED_ERROR =
  "שרת ה-API אינו זמין. ודא ש-lawpass_server רץ ושהוגדר NEXT_PUBLIC_API_BASE_URL.";
const FALLBACK_ERROR = "שגיאה בטעינת הנתונים — נסה שוב";

function failed<T>(body: Record<string, unknown>): Result<T> {
  return {
    ok: false,
    error: typeof body.error === "string" ? body.error : FALLBACK_ERROR,
  };
}

export async function fetchSubjects(): Promise<Result<OpenQuestionSubject[]>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson("/api/open-questions/subjects", { auth: true });
    if (body.ok === true) {
      return { ok: true, data: (body.subjects ?? []) as OpenQuestionSubject[] };
    }
    return failed(body);
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}

export async function fetchQuestionsBySubject(
  subject: string
): Promise<Result<OpenQuestionListEntry[]>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson(
      `/api/open-questions?subject=${encodeURIComponent(subject)}`,
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: (body.questions ?? []) as OpenQuestionListEntry[] };
    }
    return failed(body);
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}

export type SubmittedAnswer = {
  answer_id: string;
  open_question_id: string;
  /** Which sitting this was for this student on this question: 1, 2, 3… */
  attempt_number: number;
  created_at: string;
  word_count: number;
  grading_status: GradingStatus;
};

/**
 * pending  — queued, nothing has started
 * grading  — a marker has it now
 * graded   — `score` is populated
 * failed   — marking gave up; the answer is safe, the mark is not coming by itself
 */
export type GradingStatus = "pending" | "grading" | "graded" | "failed";

export type ScoredItem = {
  id: string;
  title: string;
  requirement: string;
  points_awarded: number;
  points_max: number;
  verdict: "full" | "partial" | "none";
  comment: string;
  /** The student's own words that earned the points. Empty when nothing did. */
  evidence: string;
  /** False when the quote could not be found verbatim in the answer. */
  evidence_verified: boolean;
  model_answer_section: string;
};

export type AppliedDeduction = {
  id: string;
  fault: string;
  points_off: number;
  reason: string;
};

export type BandedDimension = {
  awarded: number;
  max: number;
  band: string;
  comment: string;
  criteria: string;
};

/** The shape stored in open_question_answers.score, written by the grader. */
export type AnswerScore = {
  total: number;
  max: number;
  dimensions: {
    content: {
      awarded: number;
      max: number;
      items_total: number;
      deductions_total: number;
      criteria: string;
      items: ScoredItem[];
      deductions_applied: AppliedDeduction[];
    };
    language: BandedDimension;
    organization: BandedDimension;
  };
  summary: string;
  meta?: Record<string, unknown>;
};

export type AnswerState = {
  answer_id: string;
  open_question_id: string;
  attempt_number: number;
  grading_status: GradingStatus;
  created_at: string;
  graded_at: string | null;
  text: string;
  word_count: number;
  score: AnswerScore | null;
};

/**
 * File the student's answer against a question.
 *
 * The student is not sent — the server takes the owner from the Supabase
 * bearer token, and the row's RLS check compares it against auth.uid(). Nor is
 * the score: the insert policy requires it to arrive NULL. Nor is the attempt
 * number: the database counts the student's earlier submissions and stamps it.
 *
 * Calling this again for the same question is allowed and files another row —
 * nothing rejects a re-sitting.
 */
export async function submitAnswer(
  questionId: string,
  text: string
): Promise<Result<SubmittedAnswer>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiPostJson(
      `/api/open-questions/${encodeURIComponent(questionId)}/answers`,
      { text },
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: body.answer as SubmittedAnswer };
    }
    return failed(body);
  } catch {
    return { ok: false, error: "שליחת התשובה נכשלה — נסה שוב" };
  }
}

/**
 * One of the caller's own submissions, with its grading state and — once marked
 * — the score. This is what the page polls while "בבדיקה" is on screen and what
 * the results screen reads afterwards. Someone else's answer id is "not found":
 * RLS scopes the row to its owner.
 */
export async function fetchAnswer(answerId: string): Promise<Result<AnswerState>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson(
      `/api/open-questions/answers/${encodeURIComponent(answerId)}`,
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: body.answer as AnswerState };
    }
    return failed(body);
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}

export async function fetchQuestion(
  id: string
): Promise<Result<OpenQuestionDetail>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson(
      `/api/open-questions/${encodeURIComponent(id)}`,
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: body.question as OpenQuestionDetail };
    }
    return failed(body);
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
