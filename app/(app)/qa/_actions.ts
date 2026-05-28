"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createQaReport,
  updateQaReportScreenshotPath,
} from "@/lib/db/qa-reports";
import { submitQaReportInput } from "@/lib/validators/qa-reports";

/**
 * Slice 10 Phase B-1 — submit a QA report.
 *
 * Flow:
 *   1. Validate input via zod (defense in depth — the widget validates
 *      client-side too).
 *   2. Resolve the caller via supabase.auth.getUser(); refuse if not
 *      authenticated.
 *   3. Cheap pre-check: refuse if the caller's profile is_qa_tester
 *      is FALSE. RLS would catch this on INSERT, but a typed error
 *      gives the widget a better UX message.
 *   4. INSERT the report row via the SSR client (RLS scopes the row to
 *      the caller — qa_reports_testers_insert_own).
 *   5. If a screenshot is present:
 *        a. Upload to bucket 'qa-screenshots' at path
 *           `${userId}/${reportId}.${ext}` via the SSR client. The
 *           bucket policy (qa_screenshots_testers_insert_own) checks
 *           the folder name matches auth.uid() AND that the caller is
 *           a tester.
 *        b. UPDATE the row's screenshot_path via the SERVICE-ROLE
 *           client. The qa_reports table has no testers-update RLS
 *           policy (writes are insert-only for testers), so the
 *           service-role client is the only path. We patch a single
 *           row by id which we just inserted — bounded scope.
 *   6. Return { ok: true, reportId }.
 *
 * The action MUST NOT:
 *   - call any router navigation
 *   - revalidate /exam/* or /practice/* (would force a re-fetch /
 *     potential remount of the active exam tree)
 *   - touch exam_sessions or any exam/practice RPC
 *   - write to localStorage (server-side anyway, but worth flagging)
 *
 * These are the constraints that let the widget render during an
 * active exam without disrupting the timer / window-token / auto-submit.
 */

type SubmitResult =
  | { ok: true; reportId: string }
  | { ok: false; error: string };

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB — matches bucket cap.

function mimeToExt(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/**
 * Server Action. The widget calls it with a plain object plus an
 * optional File handle (the form input). Files cross the action
 * boundary via the Next Server Actions encoding (a FormData under the
 * hood) — `screenshot` is typed as `File | null`.
 */
export async function submitQaReport(
  input: unknown,
  screenshot: File | null = null
): Promise<SubmitResult> {
  // 1. Validate input.
  const parsed = submitQaReportInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;

  // 2. Auth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "לא מחובר" };
  }

  // 3. Tester gate (RLS will also block — this is for a friendlier
  //    error path and to avoid wasting an INSERT round-trip).
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_qa_tester")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_qa_tester) {
    return { ok: false, error: "אין הרשאת דיווח QA" };
  }

  // 4. Screenshot pre-check (cheap; fail fast before the INSERT).
  let ext: string | null = null;
  if (screenshot) {
    if (screenshot.size <= 0) {
      // Empty File handle — treat as "no screenshot" rather than failing.
      screenshot = null;
    } else if (screenshot.size > SCREENSHOT_MAX_BYTES) {
      return { ok: false, error: "צילום המסך גדול מדי (מקסימום 5MB)" };
    } else if (!ALLOWED_MIME_TYPES.has(screenshot.type)) {
      return {
        ok: false,
        error: "סוג צילום מסך לא נתמך (PNG, JPEG או WebP בלבד)",
      };
    } else {
      ext = mimeToExt(screenshot.type);
      if (!ext) {
        return { ok: false, error: "סוג צילום מסך לא נתמך" };
      }
    }
  }

  // 5. INSERT the report row first (single source of the id).
  const insertResult = await createQaReport(supabase, {
    user_id: user.id,
    report_type: data.reportType,
    page_path: data.pagePath,
    question_id: data.questionId,
    question_type: data.questionType,
    problem_text: data.problemText,
    expected_text: data.expectedText,
    screenshot_path: null,
    user_agent: data.userAgent ?? null,
    viewport: data.viewport ?? null,
  });
  if (!insertResult.ok) {
    console.error(
      `[qa] insert failed user=${user.id} code=${insertResult.code ?? "unknown"} msg=${insertResult.error}`
    );
    return { ok: false, error: "שמירת הדיווח נכשלה. נסה שוב" };
  }
  const reportId = insertResult.id;

  // 6. Optional screenshot upload + path patch.
  if (screenshot && ext) {
    const storagePath = `${user.id}/${reportId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("qa-screenshots")
      .upload(storagePath, screenshot, {
        contentType: screenshot.type,
        upsert: false,
      });
    if (uploadErr) {
      // Row was already saved (no screenshot). Log + return success
      // anyway so the user's actual report is preserved; the admin
      // can follow up if they need the missing screenshot.
      console.error(
        `[qa] screenshot upload failed user=${user.id} report=${reportId} msg=${uploadErr.message}`
      );
      return { ok: true, reportId };
    }

    const adminClient = createAdminClient();
    const patchResult = await updateQaReportScreenshotPath(
      adminClient,
      reportId,
      storagePath
    );
    if (!patchResult.ok) {
      console.error(
        `[qa] screenshot_path UPDATE failed user=${user.id} report=${reportId} msg=${patchResult.error}`
      );
      // Same rationale: row exists, file exists, just the FK between
      // them is missing. Return success and let the admin reconcile.
    }
  }

  console.info(
    `[qa] report created user=${user.id} report=${reportId} type=${data.reportType} path=${data.pagePath}`
  );
  return { ok: true, reportId };
}
