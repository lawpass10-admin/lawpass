"use client";

/**
 * דין דיוני — client wrapper over the Express API.
 *
 * Only the SITTING goes through here. The paper itself — questions, notebook,
 * review — is still read by the Next.js Server Components in lib/db/diuni.ts,
 * which reach `diuni_questions` through the service-role client because the
 * table is admin-only under RLS.
 *
 * Like lib/api/open-questions.ts there is no server-action fallback: this
 * feature has no Next.js write path to fall back to, so when
 * NEXT_PUBLIC_API_BASE_URL is unset the calls return a clear Hebrew error
 * rather than failing against a relative URL.
 */

import { apiEnabled, apiGetJson, apiPostJson } from "@/lib/api/client";

export type DiuniLetter = "א" | "ב" | "ג" | "ד";

/** One answered question as it is submitted. `letter: null` = left blank. */
export type DiuniGivenAnswer = {
  number: number;
  letter: DiuniLetter | null;
};

/**
 * One filed sitting, as the server reports it back.
 *
 * `score` is the stored `answer_score` column: correct out of the paper's
 * total as a percentage, one decimal (30/40 -> 75). The counts behind it come
 * from the same marking run — `answered` is separate from `total` because a
 * paper may be submitted with blanks, and "30 of the 32 I attempted" is a
 * different claim from "30 of 40".
 *
 * The counts are present on a freshly filed sitting and absent from the
 * listing, which reads only the score column — forty per-question entries are
 * not something a list of attempts renders.
 */
export type DiuniAttempt = {
  answer_id: string;
  question_id: string;
  /** 1-based sitting number for this candidate on this paper. */
  attempts: number;
  /** correct/total as a percentage, one decimal. 30/40 -> 75. */
  score: number;
  correct?: number;
  answered?: number;
  total?: number;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DISABLED_ERROR =
  "שרת ה-API אינו זמין. ודא ש-lawpass_server רץ ושהוגדר NEXT_PUBLIC_API_BASE_URL.";
const FALLBACK_ERROR = "שגיאה בשמירת המבחן — נסה שוב";

function failed<T>(body: Record<string, unknown>): Result<T> {
  return {
    ok: false,
    error: typeof body.error === "string" ? body.error : FALLBACK_ERROR,
  };
}

/**
 * File this sitting and get back its number and its score.
 *
 * The candidate is not sent — the server takes the owner from the Supabase
 * bearer token. Nor is the score: the answer key is admin-only and the marking
 * happens server-side, which is the whole reason this is an endpoint and not a
 * calculation in the browser.
 *
 * Re-sitting the same paper is allowed and uncapped; each filing is simply the
 * next `attempt_number`.
 */
export async function submitDiuniAttempt(
  questionId: string,
  given: DiuniGivenAnswer[]
): Promise<Result<DiuniAttempt>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiPostJson(
      `/api/diuni/questions/${encodeURIComponent(questionId)}/attempts`,
      { given },
      { auth: true }
    );
    if (body.ok === true) {
      return { ok: true, data: body.attempt as DiuniAttempt };
    }
    return failed(body);
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}

/**
 * The caller's own sittings, newest first — scoped to one paper when
 * `questionId` is given. Someone else's rows are unreachable: the server
 * scopes every read to the session's user id.
 */
export async function fetchDiuniAttempts(
  questionId?: string
): Promise<Result<DiuniAttempt[]>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const path = questionId
      ? `/api/diuni/attempts?question_id=${encodeURIComponent(questionId)}`
      : "/api/diuni/attempts";
    const body = await apiGetJson(path, { auth: true });
    if (body.ok === true) {
      return { ok: true, data: (body.attempts ?? []) as DiuniAttempt[] };
    }
    return failed(body);
  } catch {
    return { ok: false, error: "שגיאה בטעינת הניסיונות" };
  }
}
