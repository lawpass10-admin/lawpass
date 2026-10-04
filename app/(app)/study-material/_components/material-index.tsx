import Link from "next/link";

import { listStudyMaterial, type StudyMaterial } from "@/lib/db/study-material";
import { createClient } from "@/lib/supabase/server";

/**
 * חומר ללימוד — the contents page for one part of the exam.
 *
 * WHY THIS IS A COMPONENT AND NOT THREE PAGES. The same list serves מטלת כתיבה,
 * דין מהותי and דין דיוני; only the text_field it reads and the breadcrumb above
 * it differ. It was inlined in /study-material until the two exam subjects got
 * their own submenu rows and needed the same screen.
 *
 * NOT ONE ROUTE WITH ?part=. The sidebar decides which row is lit with
 * `usePathname()`, which does not carry the query string — so a single route
 * would light all three חומר ללימוד rows at once. Separate routes keep that
 * honest, and `activeFor: ["/mahoti"]` already covers /mahoti/study-material
 * because the check is a `startsWith`.
 */

type Part = StudyMaterial["textField"];

const COPY: Record<Part, { parent: string; parentHref: string; blurb: string }> = {
  open_questions: {
    parent: "מטלת כתיבה",
    parentHref: "/writing-task",
    blurb: "חומרי הלימוד למטלת הכתיבה",
  },
  mahoti: {
    parent: "דין מהותי",
    parentHref: "/mahoti-start",
    blurb: "חומרי הלימוד לדין מהותי",
  },
  diuni: {
    parent: "דין דיוני",
    parentHref: "/diuni-start",
    blurb: "חומרי הלימוד לדין דיוני",
  },
};

export async function MaterialIndex({ part }: { part: Part }) {
  const supabase = await createClient();
  const material = await listStudyMaterial(supabase, part);
  const copy = COPY[part];

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7">
      <PageHead count={material.length} copy={copy} />
      {material.length === 0 ? <EmptyState /> : <MaterialContents material={material} />}
    </div>
  );
}

function PageHead({
  count,
  copy,
}: {
  count: number;
  copy: (typeof COPY)[Part];
}) {
  return (
    <header className="space-y-2">
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
          href={copy.parentHref}
          className="font-semibold transition-colors hover:underline"
          style={{ color: "var(--color-gold-deep)" }}
        >
          {copy.parent}
        </Link>
        <span aria-hidden>›</span>
        <span>חומר ללימוד</span>
      </nav>
      <h1
        className="font-heebo font-extrabold tracking-tight"
        style={{
          fontSize: "clamp(28px, 2.4vw, 36px)",
          color: "var(--color-navy-ink)",
          lineHeight: 1.1,
        }}
      >
        חומר ללימוד
      </h1>
      <p className="font-heebo font-normal" style={{ fontSize: 15, color: "var(--color-ink-muted)" }}>
        {count > 0
          ? `תוכן עניינים · ${count} ${count === 1 ? "מסמך" : "מסמכים"} ללימוד לפני התרגול`
          : copy.blurb}
      </p>
    </header>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border px-6 py-14 text-center"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
    >
      <p className="font-heebo font-bold" style={{ fontSize: 17, color: "var(--color-navy-ink)" }}>
        אין עדיין חומר לימוד זמין
      </p>
      <p className="mt-2 font-heebo" style={{ fontSize: 14, color: "var(--color-ink-dim)" }}>
        החומר ייפתח כאן ברגע שיתווסף.
      </p>
    </div>
  );
}

/**
 * The library's contents page: one row per document, by NAME.
 *
 * A list, not a grid of cards. This is a table of contents — the question it
 * answers is "which document", and the answer is a name. Cards spend most of
 * their area on an excerpt, which is the right thing when you are browsing
 * unfamiliar material and the wrong thing when you are looking up the one
 * document you already know you want.
 *
 * The name shown is the DOCUMENT's — "טעויות לשון כתיבה משפטית" — not the
 * headline LawPass wrote for the page ("למה דווקא כאן אתה נכשל?"). That
 * headline belongs at the top of the document itself; in a list of documents it
 * is the one thing that does not identify which document this is.
 */
function MaterialContents({
  material,
}: {
  material: Awaited<ReturnType<typeof listStudyMaterial>>;
}) {
  return (
    <nav
      aria-label="תוכן עניינים"
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
    >
      <ol>
        {material.map((m, i) => (
          <li
            key={m.id}
            className={i > 0 ? "border-t" : undefined}
            style={i > 0 ? { borderColor: "var(--color-border)" } : undefined}
          >
            <Link
              href={`/study-material/${m.id}`}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.03]"
            >
              <span
                className="font-heebo font-bold tabular-nums"
                style={{ fontSize: 14, color: "var(--color-gold-deep)", minWidth: 20 }}
              >
                {i + 1}.
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className="block font-heebo font-bold leading-snug group-hover:underline"
                  style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
                >
                  {m.name}
                </span>
                <span
                  className="mt-0.5 block font-heebo"
                  style={{ fontSize: 12.5, color: "var(--color-ink-dim)" }}
                >
                  {/* Counted in the unit the document actually has. A booklet
                      of pages has no "items", and printing 0 of them would
                      read as an empty document rather than a different kind. */}
                  {m.kind === "sections"
                    ? `${m.groupCount} פרקים`
                    : m.kind === "procedure"
                      ? `${m.groupCount} שלבים · ${m.itemCount} כללים`
                      : `${m.groupCount} נושאים · ${m.itemCount} פריטים`}
                </span>
              </span>

              <span
                className="shrink-0 font-heebo font-semibold"
                style={{ fontSize: 13.5, color: "var(--color-gold-deep)" }}
                aria-hidden
              >
                ←
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
