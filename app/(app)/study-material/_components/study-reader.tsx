"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudyDoc, StudyItem } from "@/lib/db/study-material";

/** The guide half of the union — the only shape this reader draws. */
type StudyGuide = Extract<StudyDoc, { kind: "guide" }>;

/**
 * The reading surface for one study document.
 *
 * SAME SHAPE AS THE GENERATED HTML. scripts/ingestion/rewrite-source.mjs writes
 * a standalone .lawpass.html for review, and this renders the same document the
 * same way: the title, the introduction, one table of contents, then each group
 * as a heading and a four-column table — במקום · עדיף · למה · דוגמה. Two
 * renderings of one document that disagree on layout are two things to keep in
 * step and one of them will drift; agreeing on the table means what the
 * operator checks in the file is what the candidate sees on the page.
 *
 * A table rather than cards because these rows are meant to be COMPARED. The
 * wrong form and the right one sit in adjacent columns at the same height down
 * the whole document, so the eye can run down one column — which is the thing a
 * candidate revising actually does, and what a stack of cards prevents.
 *
 * Every string rendered here comes from `lawpass_text` through
 * study_material_public, so none of the source's expression can reach the
 * screen even if this component is reused for another document.
 */
export function StudyReader({ doc }: { doc: StudyGuide }) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  // Matching on the fields a candidate would search by. `reason` is included
  // because the rule they half-remember is often phrased as its explanation.
  const groups = useMemo(() => {
    if (!q) return doc.groups;
    const needle = q.toLowerCase();
    const hit = (item: StudyItem) =>
      [item.avoid, item.use, item.reason, item.example, item.exam_note]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    return doc.groups
      .map((g) => ({ ...g, items: g.items.filter(hit) }))
      .filter((g) => g.items.length > 0);
  }, [doc.groups, q]);

  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const total = doc.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <article className="mx-auto w-full max-w-[1100px] space-y-8">
      <header className="space-y-3">
        <h1
          className="font-heebo font-extrabold tracking-tight"
          style={{
            fontSize: "clamp(24px, 2.2vw, 32px)",
            color: "var(--color-navy-ink)",
            lineHeight: 1.2,
          }}
        >
          {doc.title}
        </h1>
        {doc.intro ? (
          <p
            className="font-heebo leading-[1.9]"
            style={{ fontSize: 15, color: "var(--color-ink-muted)" }}
          >
            {doc.intro}
          </p>
        ) : null}
      </header>

      {/* ONE table of contents, headed by the document it belongs to. */}
      <nav
        aria-label="תוכן העניינים"
        className="rounded-2xl border p-5 md:p-6"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
      >
        <p
          className="font-heebo font-bold"
          style={{ fontSize: 15, color: "var(--color-navy-ink)" }}
        >
          תוכן העניינים
        </p>
        <p className="mt-0.5 font-heebo" style={{ fontSize: 13, color: "var(--color-ink-dim)" }}>
          {doc.title}
        </p>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {doc.groups.map((g, i) => (
            <li key={g.id}>
              <a
                href={`#${anchor(g.id, i)}`}
                className="font-heebo leading-snug transition-colors hover:underline"
                style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}
              >
                <span className="font-semibold" style={{ color: "var(--color-gold-deep)" }}>
                  {i + 1}.
                </span>{" "}
                {g.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-2">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 -translate-y-1/2"
            style={{ width: 16, height: 16, color: "var(--color-ink-dim)" }}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בחומר — למשל: בכדי"
            aria-label="חיפוש בחומר הלימוד"
            className="w-full rounded-xl border bg-transparent py-2.5 ps-10 pe-9 font-heebo outline-none transition-colors focus:border-[var(--color-gold-deep)]"
            style={{ fontSize: 14, borderColor: "var(--color-border)" }}
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="נקה חיפוש"
              className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors hover:bg-black/10"
            >
              <X style={{ width: 15, height: 15, color: "var(--color-ink-dim)" }} />
            </button>
          ) : null}
        </div>
        {q ? (
          <p className="font-heebo" style={{ fontSize: 13, color: "var(--color-ink-dim)" }}>
            {shown > 0 ? `${shown} מתוך ${total} פריטים` : "לא נמצאו תוצאות"}
          </p>
        ) : null}
      </div>

      {groups.map((g, i) => {
        // Documents written under contract v1.1 carry no example or exam note;
        // earlier ones do. The columns appear only when something would go in
        // them, so both shapes read as a full table instead of one with a
        // column of blanks.
        const hasExample = g.items.some((it) => it.example);
        const hasNote = g.items.some((it) => it.exam_note);
        return (
        <section key={g.id} id={anchor(g.id, i)} className="scroll-mt-6 space-y-2">
          <h2
            className="font-heebo font-bold"
            style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
          >
            {g.heading}
          </h2>
          {g.why_this_group ? (
            <p
              className="font-heebo leading-[1.85]"
              style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}
            >
              {g.why_this_group}
            </p>
          ) : null}

          {/* Scrolls on its own below the breakpoint where four columns stop
              fitting, so a narrow screen never widens the whole page. */}
          <div
            className="overflow-x-auto rounded-xl border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <table className="w-full border-collapse" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <Th style={{ width: "15%" }}>במקום</Th>
                  <Th style={{ width: "15%" }}>עדיף</Th>
                  <Th>למה</Th>
                  {hasExample ? <Th style={{ width: "26%" }}>דוגמה</Th> : null}
                </tr>
              </thead>
              <tbody>
                {g.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <span
                        className="font-heebo font-semibold line-through"
                        style={{ fontSize: 14, color: "#c0392b" }}
                      >
                        {item.avoid}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="font-heebo font-bold"
                        style={{ fontSize: 14.5, color: "#1e8449" }}
                      >
                        {item.use}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="font-heebo leading-[1.8]"
                        style={{ fontSize: 13.5, color: "var(--color-ink)" }}
                      >
                        {item.reason}
                      </span>
                      {hasNote && item.exam_note ? (
                        <span
                          className="mt-2 block border-s-[3px] ps-2.5 font-heebo leading-[1.75]"
                          style={{
                            fontSize: 12.5,
                            color: "var(--color-ink-muted)",
                            borderColor: "var(--color-gold-deep)",
                          }}
                        >
                          {item.exam_note}
                        </span>
                      ) : null}
                    </Td>
                    {hasExample ? (
                      <Td>
                        <span
                          className="font-heebo italic leading-[1.8]"
                          style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
                        >
                          {item.example}
                        </span>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        );
      })}
    </article>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      scope="col"
      className="border-b px-3 py-2.5 text-start font-heebo font-semibold"
      style={{
        fontSize: 13,
        color: "var(--color-navy-ink)",
        background: "color-mix(in oklab, var(--color-navy-ink) 5%, transparent)",
        borderColor: "var(--color-border)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="border-b px-3 py-3 align-top"
      style={{ borderColor: "var(--color-border)" }}
    >
      {children}
    </td>
  );
}

/** A stable id even when the pipeline wrote a slug that repeats or is missing. */
function anchor(id: string, index: number) {
  return `group-${index + 1}-${id.replace(/[^\w-]/g, "")}`;
}
