import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getQaReportDetail,
  resolveChapterForQuestion,
  resolveQuestionEditorTargetId,
} from "@/lib/db/qa-reports";
import { createClient } from "@/lib/supabase/server";

import QaStatusControl from "../_components/qa-status-control";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  bug: "באג טכני",
  content: "טעות תוכן",
  design: "עיצוב/UX",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * /admin/qa/[id] — one report's full payload.
 *
 * Resolves:
 *   - reporter name via the profiles join (already in
 *     getQaReportDetail)
 *   - reporter email via the Auth Admin API (mirrors getUserDetail
 *     in lib/db/admin.ts — never via PostgREST against auth.users)
 *   - signed URL for the screenshot (private bucket)
 *   - chapter id for the linked question (source → chapter_id;
 *     angle → parent source → chapter_id). The editor link targets
 *     the parent source even for angles, since the source editor
 *     hosts the angle UI inline.
 */
export default async function AdminQaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const report = await getQaReportDetail(supabase, id);
  if (!report) notFound();

  // Resolve reporter email + question→chapter link in parallel.
  const adminClient = createAdminClient();
  const [authRes, chapterId, editorTargetId, signedUrlRes] = await Promise.all([
    adminClient.auth.admin.getUserById(report.userId),
    report.questionId && report.questionType
      ? resolveChapterForQuestion(supabase, report.questionType, report.questionId)
      : Promise.resolve<string | null>(null),
    report.questionId && report.questionType
      ? resolveQuestionEditorTargetId(
          supabase,
          report.questionType,
          report.questionId
        )
      : Promise.resolve<string | null>(null),
    report.screenshotPath
      ? supabase.storage
          .from("qa-screenshots")
          .createSignedUrl(report.screenshotPath, 60 * 30)
      : Promise.resolve({ data: null } as { data: { signedUrl: string } | null }),
  ]);

  const reporterEmail = authRes.data?.user?.email ?? null;
  const screenshotUrl = signedUrlRes.data?.signedUrl ?? null;
  const editorUrl =
    chapterId && editorTargetId
      ? `/admin/chapters/${chapterId}/questions/${editorTargetId}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heebo text-xl font-semibold text-[var(--color-navy-ink)]">
            {TYPE_LABELS[report.reportType] ?? report.reportType}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
            דיווח #{report.id.slice(0, 8)}
          </p>
        </div>
        <Link
          href="/admin/qa"
          className="text-sm text-[var(--color-ink-dim)] hover:text-foreground hover:underline"
        >
          ← חזרה לרשימת הדיווחים
        </Link>
      </div>

      <div className="rounded-md border border-[var(--color-line)] bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">סטטוס</h3>
        <QaStatusControl reportId={report.id} currentStatus={report.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetaCard label="מדווח">
          <Link
            href={`/admin/users/${report.userId}`}
            className="text-sm hover:underline"
          >
            {report.reporterFullName ?? "—"}
          </Link>
          {reporterEmail ? (
            <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
              {reporterEmail}
            </div>
          ) : null}
        </MetaCard>
        <MetaCard label="נוצר">
          <span className="text-sm">{formatDateTime(report.createdAt)}</span>
        </MetaCard>
        <MetaCard label="דף">
          <code
            dir="ltr"
            className="block break-all font-mono text-xs text-muted-foreground"
          >
            {report.pagePath}
          </code>
        </MetaCard>
        <MetaCard label="שאלה משויכת">
          {report.questionId && report.questionType ? (
            editorUrl ? (
              <Link
                href={editorUrl}
                className="text-sm font-medium text-[var(--color-navy-ink)] hover:underline"
              >
                פתח עורך תוכן
                <span className="ms-2 font-mono text-[11px] text-muted-foreground">
                  ({report.questionType === "source" ? "מקור" : "זווית"} ·{" "}
                  {report.questionId.slice(0, 8)})
                </span>
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">
                לא נמצא פרק לשאלה ({report.questionType} · {report.questionId.slice(0, 8)}).
              </span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </MetaCard>
      </div>

      <section className="rounded-md border border-[var(--color-line)] bg-card p-5">
        <h3 className="text-sm font-semibold">מה לא עבד?</h3>
        <p
          dir="auto"
          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"
        >
          {report.problemText}
        </p>
      </section>

      <section className="rounded-md border border-[var(--color-line)] bg-card p-5">
        <h3 className="text-sm font-semibold">מה היה צריך לקרות?</h3>
        <p
          dir="auto"
          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"
        >
          {report.expectedText}
        </p>
      </section>

      {screenshotUrl ? (
        <section className="rounded-md border border-[var(--color-line)] bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">צילום מסך</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt="צילום מסך של הדיווח"
            className="max-h-[600px] w-auto rounded-md border border-[var(--color-line)]"
          />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {report.userAgent ? (
          <MetaCard label="User-Agent">
            <code
              dir="ltr"
              className="block break-all font-mono text-xs text-muted-foreground"
            >
              {report.userAgent}
            </code>
          </MetaCard>
        ) : null}
        {report.viewport ? (
          <MetaCard label="Viewport">
            <code
              dir="ltr"
              className="block font-mono text-xs text-muted-foreground"
            >
              {report.viewport}
            </code>
          </MetaCard>
        ) : null}
      </div>
    </div>
  );
}

function MetaCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
