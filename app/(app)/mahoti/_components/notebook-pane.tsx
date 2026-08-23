"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Notebook, NotebookLaw, NotebookSection } from "@/lib/db/mahoti";
import { cn } from "@/lib/utils";

/**
 * The notebook, one law per page, with arrows to flip.
 *
 * Paging by law rather than by rendered height: a law is the unit the
 * notebook was sampled in and the unit a citation names ("חוק הירושה, סעיף
 * 41"), so "page 4" here means something a reader can hold onto. Height-based
 * pagination would put the same section on a different page at a different
 * zoom level. Page 0 is the table of contents, mirroring the PDF the same
 * notebook renders to.
 */
export function NotebookPane({ notebook }: { notebook: Notebook }) {
  // 0 = table of contents, 1..laws.length = one law each.
  const [page, setPage] = useState(0);

  const laws = notebook.laws;
  const totalPages = laws.length + 1;
  const law = page === 0 ? null : laws[page - 1];

  function go(to: number): void {
    if (to < 0 || to >= totalPages) return;
    setPage(to);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {law ? law.law_name : "תוכן עניינים"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {law
              ? `${law.section_count} סעיפים במחברת`
              : `${notebook.notebook.law_count} חוקים · ${notebook.notebook.section_count} סעיפים`}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {page + 1} / {totalPages}
        </span>
      </header>

      {/* The scroll container is the page body, so flipping a page always
          starts the reader at the top of the new law rather than wherever
          the previous one was scrolled to. `key` remounts it per page. */}
      <div
        key={page}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        tabIndex={0}
        aria-label={law ? `${law.law_name} — נוסח הסעיפים` : "תוכן עניינים"}
      >
        {law ? (
          <LawPage law={law} />
        ) : (
          <TableOfContents laws={laws} onOpen={(i) => go(i + 1)} />
        )}
      </div>

      {/* RTL: ChevronRight moves back, ChevronLeft moves forward — the same
          direction mapping the exam player uses for prev/next. */}
      <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(page - 1)}
          disabled={page === 0}
        >
          <ChevronRight className="size-4" aria-hidden />
          <span className="ms-1.5">הקודם</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(0)}
          disabled={page === 0}
          className="text-xs text-muted-foreground"
        >
          תוכן עניינים
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(page + 1)}
          disabled={page === totalPages - 1}
        >
          <span className="me-1.5">הבא</span>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </footer>
    </div>
  );
}

function TableOfContents({
  laws,
  onOpen,
}: {
  laws: NotebookLaw[];
  onOpen: (index: number) => void;
}) {
  return (
    <ol className="space-y-1">
      {laws.map((law, i) => (
        <li key={law.law_id}>
          <button
            type="button"
            onClick={() => onOpen(i)}
            className={cn(
              "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-start transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {i + 2}
            </span>
            <span className="flex-1 text-[13px] leading-snug">
              {law.law_name}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {law.section_count}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Chapter headings are printed only where the chapter changes, so each
 * section needs to know what came before it. That is computed here, ahead of
 * the render, rather than by carrying a running variable through the map —
 * the sections are a fixed array, so the boundaries are derivable from the
 * index alone.
 */
function withChapterBreaks(
  sections: NotebookSection[]
): { section: NotebookSection; chapterLabel: string | null }[] {
  return sections.map((section, i) => {
    const previous = i > 0 ? sections[i - 1].chapter : null;
    const changed = Boolean(section.chapter) && section.chapter !== previous;
    return { section, chapterLabel: changed ? section.chapter : null };
  });
}

function LawPage({ law }: { law: NotebookLaw }) {
  return (
    <div className="space-y-3">
      {withChapterBreaks(law.sections).map(({ section, chapterLabel }) => (
        <div key={`${law.law_id}-${section.number}`}>
          {chapterLabel ? (
            <p className="pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
              {chapterLabel}
            </p>
          ) : null}
          <SectionBody section={section} />
        </div>
      ))}
    </div>
  );
}

function SectionBody({ section }: { section: NotebookSection }) {
  return (
    <article className="border-b border-border/60 pb-2.5 last:border-b-0">
      <h3 className="text-[13px] font-semibold" dir="auto">
        {section.heading
          ? `${section.number}. ${section.heading}`
          : `סעיף ${section.number}`}
      </h3>

      {section.text?.trim() ? (
        <p className="mt-0.5 text-[13px] leading-relaxed" dir="auto">
          {section.text}
        </p>
      ) : null}

      {section.subsections?.map((sub, i) => (
        <div key={`${section.number}-${sub.marker}-${i}`} className="mt-1">
          <p className="text-[13px] leading-relaxed ps-3" dir="auto">
            <span className="font-semibold text-primary">{sub.marker}</span>{" "}
            {sub.text}
          </p>
          {sub.paragraphs?.map((para, j) => (
            <p
              key={`${section.number}-${sub.marker}-${j}`}
              className="mt-0.5 text-[12.5px] leading-relaxed ps-7"
              dir="auto"
            >
              <span className="font-semibold text-primary">{para.marker}</span>{" "}
              {para.text}
            </p>
          ))}
        </div>
      ))}
    </article>
  );
}
