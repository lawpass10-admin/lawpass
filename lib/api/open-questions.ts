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

import {
  apiEnabled,
  apiGetJson,
  apiPostForm,
  apiPostJson,
} from "@/lib/api/client";

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
  /** How many photographed pages were filed with it. 0 for a typed answer. */
  hand_writing_pages?: number;
  /**
   * False when the submission was NOT queued for marking — today that means a
   * handwriting-only answer, which the text grader cannot read. The answer is
   * filed either way; only the marking is missing.
   */
  grading_queued?: boolean;
};

/**
 * One photographed page of a handwritten answer, as stored on the row.
 *
 * `public_id` travels with the url because it is what Cloudinary needs to
 * delete or transform the asset later — a url cannot reliably be turned back
 * into one.
 */
export type HandwritingPage = {
  /** 1 or 2 — an answer is at most two A4 sides. */
  page: number;
  url: string;
  public_id: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
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

/**
 * How far along a marking run is, while it is still running.
 *
 * Present only when the server process answering the poll is also the one doing
 * the marking — it is held in that process's memory, not on the row. Absent is
 * normal (a run picked up by the CLI worker, or a server restart), and the page
 * treats it as "no detail available" rather than as an error.
 */
export type GradingProgress = {
  elapsed_ms: number;
  /** The median of this server's recent runs — what to expect, not a promise. */
  expected_ms: number;
  /** Characters of marking received so far. Zero for as long as the model is
   *  still thinking, which is most of the run. */
  answer_chars: number;
  /** Capped below 100: a run that outlives the estimate is still running. */
  percent: number;
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
  /** The photographed pages, when the answer was written by hand. */
  hand_writing: HandwritingPage[] | null;
  score: AnswerScore | null;
  progress?: GradingProgress | null;
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
  text: string,
  handWriting: HandwritingPage[] = []
): Promise<Result<SubmittedAnswer>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiPostJson(
      `/api/open-questions/${encodeURIComponent(questionId)}/answers`,
      // Omitted rather than sent empty when there is no handwriting, so a typed
      // submission is byte-for-byte the request it was before this existed.
      handWriting.length > 0 ? { text, hand_writing: handWriting } : { text },
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
 * Upload the photographed pages of a handwritten answer.
 *
 * The files go to our own server, which signs the Cloudinary request — the API
 * secret is never in the browser. What comes back are the stored references,
 * which the caller holds and sends with `submitAnswer`.
 *
 * Uploading is NOT submitting: pages uploaded and then abandoned are simply
 * never referenced by a row.
 */
export async function uploadHandwriting(
  questionId: string,
  files: File[]
): Promise<Result<HandwritingPage[]>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  if (files.length === 0) return { ok: false, error: "לא נבחרו תמונות" };

  const form = new FormData();
  // One repeated field name, which is what multer's array("pages") reads.
  for (const file of files) form.append("pages", file);

  try {
    const body = await apiPostForm(
      `/api/open-questions/${encodeURIComponent(questionId)}/handwriting`,
      form,
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: (body.pages ?? []) as HandwritingPage[] };
    }
    return failed(body);
  } catch {
    return { ok: false, error: "העלאת התמונות נכשלה — נסה שוב" };
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

/* ─────────────────────────── the model answer ─────────────────────────── */

export type SolutionSection = { heading: string; paragraphs: string[] };
export type SolutionExhibit = { marker?: string; description?: string };
export type SolutionSourceUsed = { quote_id?: string; role?: string };

/**
 * The model answer for a task, as the review screen renders it: the document a
 * candidate was meant to produce, not the marking notes behind it. The server
 * projects it through its own allowlist (see toStudentSolution) — the rubric
 * reasoning attached to the stored answer never reaches the browser.
 */
export type ModelSolution = {
  document_type: string | null;
  court: string | null;
  case_number: string | null;
  parties: {
    applicant?: string;
    respondent?: string;
    applicant_role?: string;
    respondent_role?: string;
  } | null;
  opening: string | null;
  sections: SolutionSection[];
  exhibits: SolutionExhibit[];
  closing: string | null;
  signature_line: string | null;
  sources_used: SolutionSourceUsed[];
};

/**
 * The model answer for the task this submission belongs to.
 *
 * Keyed by the ANSWER id: the server unlocks the solution only for a
 * submission the caller owns whose marking has finished, so this cannot be
 * used to read the answer to a task the student has not sat yet. A locked or
 * missing solution comes back as `{ ok: false }` with the reason in Hebrew,
 * which the button shows as-is.
 */
export async function fetchSolution(
  answerId: string
): Promise<Result<ModelSolution>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson(
      `/api/open-questions/answers/${encodeURIComponent(answerId)}/solution`,
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: body.solution as ModelSolution };
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
