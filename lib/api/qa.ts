"use client";

/**
 * QA report submit — client wrapper (safe dual-path). Same signature +
 * return shape as the server action; the widget imports THIS.
 *
 * The report carries an optional screenshot File, so the API path builds
 * multipart/form-data (matching the server's multer upload). Null
 * identity fields are omitted — the server's Zod preprocess maps a
 * missing field to null. Falls back to the server action when the Express
 * API is disabled (production).
 */

import { apiEnabled, apiPostForm } from "@/lib/api/client";
import { submitQaReport as submitQaReportAction } from "@/app/(app)/qa/_actions";

type SubmitResult = Awaited<ReturnType<typeof submitQaReportAction>>;

type SubmitQaInput = {
  reportType: string;
  problemText: string;
  expectedText: string;
  pagePath: string;
  questionId: string | null;
  questionType: string | null;
  userAgent?: string | null;
  viewport?: string | null;
};

export async function submitQaReport(
  input: unknown,
  screenshot: File | null = null
): Promise<SubmitResult> {
  // [VERIFY-EXPRESS] fallback disabled — see the banner in lib/api/auth.ts.
  // if (!apiEnabled()) {
  //   return submitQaReportAction(input, screenshot);
  // }
  try {
    const inp = input as SubmitQaInput;
    const fd = new FormData();
    fd.append("reportType", inp.reportType);
    fd.append("problemText", inp.problemText);
    fd.append("expectedText", inp.expectedText);
    fd.append("pagePath", inp.pagePath);
    if (inp.questionId != null) fd.append("questionId", inp.questionId);
    if (inp.questionType != null) fd.append("questionType", inp.questionType);
    if (inp.userAgent != null) fd.append("userAgent", inp.userAgent);
    if (inp.viewport != null) fd.append("viewport", inp.viewport);
    if (screenshot) fd.append("screenshot", screenshot);

    const data = await apiPostForm("/api/qa/reports", fd, { auth: true });
    if (data.ok === true) {
      return { ok: true, reportId: String(data.reportId ?? "") };
    }
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "שמירת הדיווח נכשלה. נסה שוב",
    };
  } catch {
    return { ok: false, error: "שמירת הדיווח נכשלה. נסה שוב" };
  }
}
