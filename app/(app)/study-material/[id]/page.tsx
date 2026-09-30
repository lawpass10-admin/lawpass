import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { documentName, getStudyMaterial } from "@/lib/db/study-material";
import { createClient } from "@/lib/supabase/server";

import { ExamPageNav } from "../../_components/exam-page-nav";
import { DocumentReader } from "../_components/document-reader";
import { ProcedureReader } from "../_components/procedure-reader";
import { StudyReader } from "../_components/study-reader";

/**
 * /study-material/[id] — one document, laid out to be read and revised from.
 *
 * The page is a server shell that fetches and hands the document to a client
 * reader; the reader owns the parts that need state (the contents rail, the
 * search box). Splitting it that way keeps the document itself server-rendered,
 * which is what makes it appear at once rather than after a hydration pass —
 * it is a reading page, and reading pages should not flash.
 */
export default async function StudyMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActiveSubscription();
  const { id } = await params;

  const supabase = await createClient();
  const material = await getStudyMaterial(supabase, id);
  if (!material) notFound();

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6">
      {/* The way out, at the top and again at the end.
          A study document is long — seven sections of tables — and a candidate
          who has read to the bottom is exactly the person who wants to go back
          to the contents. Making them scroll up to the breadcrumb to do it is
          the kind of small friction that stops people reading the next one. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="breadcrumbs"
          className="flex items-center gap-2 font-heebo"
          style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
        >
          <Link
            href="/dashboard"
            className="font-semibold transition-colors hover:underline"
            style={{ color: "var(--color-gold-deep)" }}
          >
            דשבורד
          </Link>
          <span aria-hidden>›</span>
          <Link
            href="/study-material"
            className="font-semibold transition-colors hover:underline"
            style={{ color: "var(--color-gold-deep)" }}
          >
            חומר ללימוד
          </Link>
          <span aria-hidden>›</span>
          <span className="truncate">{documentName(material.paperId)}</span>
        </nav>

        <ExamPageNav backHref="/study-material" backLabel="חזרה לתוכן העניינים" />
      </div>

      {/* Which reader depends on what the document IS, not on a flag: a guide
          is a table of pairs to compare, a booklet is pages to read in order.
          See lib/db/study-material for why the two are a union. */}
      {material.doc.kind === "guide" ? (
        <StudyReader doc={material.doc} />
      ) : material.doc.kind === "procedure" ? (
        <ProcedureReader doc={material.doc} />
      ) : (
        <DocumentReader doc={material.doc} name={documentName(material.paperId)} />
      )}

      <footer className="flex justify-center pt-2 pb-6">
        <ExamPageNav backHref="/study-material" backLabel="חזרה לתוכן העניינים" />
      </footer>
    </div>
  );
}
