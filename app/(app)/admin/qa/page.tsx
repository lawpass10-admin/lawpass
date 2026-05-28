import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin-gate";
import {
  listQaReports,
  type QaReportListRow,
  type QaReportStatus,
  type QaReportType,
} from "@/lib/db/qa-reports";
import { createClient } from "@/lib/supabase/server";

import QaFiltersBar from "./_components/qa-filters-bar";
import QaListTable from "./_components/qa-list-table";

export const dynamic = "force-dynamic";

function pickStr(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

function parseStatus(v: string | undefined): QaReportStatus | null {
  return v === "open" || v === "in_progress" || v === "resolved" ? v : null;
}

function parseReportType(v: string | undefined): QaReportType | null {
  return v === "bug" || v === "content" || v === "design" ? v : null;
}

function parseUuid(v: string | undefined): string | null {
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  )
    ? v
    : null;
}

/**
 * /admin/qa — Slice 10 Phase B-2.
 *
 * Newest-first list of QA reports with searchParam-driven filters:
 *   ?status=open|in_progress|resolved
 *   ?type=bug|content|design
 *   ?reporter=<uuid>
 *
 * Mirrors the /admin/users page convention: URL is the canonical
 * filter state; the filter bar reads + pushes search params.
 *
 * The table renders a small thumbnail for rows with screenshots; the
 * signed URL is created server-side (private bucket — no public
 * URLs) with a short TTL. The URL is part of the rendered HTML and
 * the TTL is intentionally short (5 minutes) — admin will refresh
 * the page if they're sitting on it for a while.
 */
export default async function AdminQaPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    type?: string | string[];
    reporter?: string | string[];
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = parseStatus(pickStr(params.status));
  const reportType = parseReportType(pickStr(params.type));
  const reporterId = parseUuid(pickStr(params.reporter));

  const supabase = await createClient();
  const rows = await listQaReports(supabase, {
    status,
    reportType,
    reporterId,
  });

  // Sign URLs for rows that carry a screenshot. The signing call is
  // batched in parallel; failures fall back to a null thumbnail (no
  // hard error for the list — admin can still triage).
  const SIGN_TTL_SECONDS = 300;
  const signed: Array<QaReportListRow & { thumbUrl: string | null }> =
    await Promise.all(
      rows.map(async (r) => {
        if (!r.screenshotPath) return { ...r, thumbUrl: null };
        const { data } = await supabase.storage
          .from("qa-screenshots")
          .createSignedUrl(r.screenshotPath, SIGN_TTL_SECONDS);
        return { ...r, thumbUrl: data?.signedUrl ?? null };
      })
    );

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heebo text-lg font-semibold text-[var(--color-navy-ink)]">
            דיווחי QA
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
            לחיצה על שורה פותחת את פרטי הדיווח.
          </p>
        </div>
        {reporterId ? (
          <Link
            href="/admin/qa"
            className="text-xs text-[var(--color-ink-dim)] hover:text-foreground hover:underline"
          >
            נקה סינון מדווח
          </Link>
        ) : null}
      </header>
      <QaFiltersBar
        currentStatus={status}
        currentType={reportType}
        currentReporter={reporterId}
      />
      <QaListTable rows={signed} />
    </div>
  );
}
