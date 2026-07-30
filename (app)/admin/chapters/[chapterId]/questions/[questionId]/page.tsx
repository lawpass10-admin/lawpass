import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { getQuestionEditorPayload } from "@/lib/db/admin";
import { createClient } from "@/lib/supabase/server";

import QuestionEditor from "./_components/question-editor";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  active: "פעילה",
  archived: "בארכיון",
};

const STATUS_TONE_CLS: Record<string, string> = {
  active:
    "bg-[var(--color-status-strong-bg)] text-[var(--color-status-strong)]",
  draft:
    "bg-[var(--color-status-weak-bg)] text-[var(--color-status-weak)]",
  archived: "bg-muted text-muted-foreground",
};

/**
 * /admin/chapters/[chapterId]/questions/[questionId] — Tier 1 text-only
 * content editor. Tabs across the source + every angle (one editor
 * per tab). Whitelisted fields only — see _actions.ts.
 */
export default async function QuestionEditorPage({
  params,
}: {
  params: Promise<{ chapterId: string; questionId: string }>;
}) {
  await requireAdmin();

  const { chapterId, questionId } = await params;
  const supabase = await createClient();
  const payload = await getQuestionEditorPayload(
    supabase,
    chapterId,
    questionId
  );
  if (!payload) notFound();

  const { chapter, source, angles } = payload;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heebo text-xl font-semibold text-[var(--color-navy-ink)]">
            עריכת שאלה
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-dim)]">
            <span dir="auto">{chapter.title}</span>
            <span dir="ltr" className="font-mono text-xs">
              {source.externalId}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                STATUS_TONE_CLS[source.status] ??
                "bg-muted text-muted-foreground"
              }`}
            >
              {STATUS_LABEL[source.status] ?? source.status}
            </span>
          </div>
        </div>
        <Link
          href={`/admin/chapters/${chapter.id}`}
          className="text-sm text-[var(--color-ink-dim)] hover:text-foreground hover:underline"
        >
          ← חזרה לרשימת השאלות
        </Link>
      </div>

      <QuestionEditor source={source} angles={angles} />
    </div>
  );
}
