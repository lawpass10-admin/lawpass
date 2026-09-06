"use client";

/**
 * שאלון מותאם אישית — the pool a candidate can build from, and the build.
 *
 * API-only, like the rest of the dashboard's data: the pool lives in tables
 * that are admin-only under RLS because they carry the answer key, so the
 * counting happens on the server and only totals reach the browser.
 */

import { apiEnabled, apiGetJson, apiPostJson } from "@/lib/api/client";

export type ExamPoolArea = { area: string; available: number };
export type ExamPool = { total: number; areas: ExamPoolArea[] };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DISABLED_ERROR =
  "שרת ה-API אינו זמין. ודא ש-lawpass_server רץ ושהוגדר NEXT_PUBLIC_API_BASE_URL.";
const FALLBACK_ERROR = "שגיאה — נסה שוב";

export async function fetchExamPool(
  subject: "mahoti" | "diuni"
): Promise<Result<ExamPool>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiGetJson(
      `/api/custom-exam/pool?subject=${encodeURIComponent(subject)}`,
      { auth: true }
    );
    if (body.ok === true && body.pool) {
      return { ok: true, data: body.pool as ExamPool };
    }
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : FALLBACK_ERROR,
    };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}

/** Builds the exam and returns its id. Nothing is generated; see the server. */
export async function buildCustomExam(
  subject: "mahoti" | "diuni",
  counts: Record<string, number>,
  total: number
): Promise<Result<{ examId: string }>> {
  if (!apiEnabled()) return { ok: false, error: DISABLED_ERROR };
  try {
    const body = await apiPostJson(
      "/api/custom-exam",
      { subject, counts, total },
      { auth: true }
    );
    if (body.ok === true && typeof body.exam_id === "string") {
      return { ok: true, data: { examId: body.exam_id } };
    }
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : FALLBACK_ERROR,
    };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
