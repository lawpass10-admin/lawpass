"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudyDoc, StudySection } from "@/lib/db/study-material";

/** The verbatim half of the union — sections of prose, not groups of pairs. */
type StudyDocument = Extract<StudyDoc, { kind: "sections" }>;

/**
 * Headings that are a note ON the section above them rather than a destination
 * of their own, and so are left out of the contents rail.
 *
 * They are the ones that repeat. A worked example is preceded by the הוראות
 * הדין that govern it, split internally into העובדות and הטענות המשפטיות, and
 * followed by its דגשים and its לסיכום — so the rail filled with thirty-three
 * entries saying one of four things, none of which can be told from the next.
 * Kept in the body, where the example they belong to is directly above or
 * below and says which one you are reading.
 *
 * What is NOT here: a document type that genuinely appears more than once, such
 * as עתירה מינהלית or כתב ערעור. The booklet shows those several times over —
 * the task, the structure, the worked answer — so each entry does lead
 * somewhere different. Repetition alone is not the test; leading nowhere of its
 * own is.
 */
const RAIL_SKIP = new Set([
  "דגשים",
  "לסיכום",
  "הוראות הדין",
  "הטענות המשפטיות",
]);

/**
 * The title a heading belongs under — everything before a dash or a bracket.
 *
 * "חוות דעת - מבנה", "חוות דעת - דוגמה למטלה" and "חוות דעת - דוגמה לפתרון" are
 * three views of one document type, and the booklet says so in the headings
 * themselves. Reading that stem back out is what lets the rail show the type
 * once with its parts under it, instead of three entries that each begin with
 * the same two words.
 *
 * Both dashes, because the extractor produced "-" in some headings and "–" in
 * others for the same construction.
 */
function titleStem(heading: string): string {
  return heading
    .split(/\s[-–—]\s/)[0]
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

/**
 * What a heading says once its group already says the stem.
 *
 * The prefix is removed ONLY when the heading actually starts with it. A stage
 * of the guide is filed under "דברי הסבר" without being named after it, and
 * slicing the stem's length off "שלב 1: להתמקם…" cut five characters out of the
 * middle of a word.
 */
function leafLabel(heading: string, stem: string): string {
  if (heading === stem) return "כללי";
  if (!heading.startsWith(stem)) return heading;
  const rest = heading.slice(stem.length).replace(/^\s*[-–—:]\s*/, "").trim();
  return rest || heading;
}

/** A stage of the authored guide: "שלב 3: …" belongs with what precedes it. */
const STAGE = /^שלב\s*\d/;

/**
 * "פרק ראשון", "פרק א׳", "פרק ג" — the marker, not the title after it.
 *
 * "סעיפים כלליים" counts as one. It is what load-converted-material.mjs calls
 * the sections a law files under no chapter, and there are 34 of them across
 * the sixteen books. Without it those rows alone had nothing to bold and
 * nothing to lead with on a phone, so they sat out of line with every other
 * entry in the same list — which is the one thing a contents list must not do.
 */
const CHAPTER_MARKER = /^(.*?)(פרק\s+[^\s:,־–—]+|סעיפים כלליים)(.*)$/;

/**
 * A rail entry with its chapter marker picked out.
 *
 * Only the marker darkens. The whole line in ink was the first attempt and it
 * was wrong: thirty bold dark lines are as flat as thirty gold ones, and the
 * thing a reader scans a contents list for is the numbering. So "פרק ראשון"
 * carries the weight and the title after it stays in the link colour.
 *
 * Returns the text untouched when there is no marker — the open-questions
 * booklets have headings like "דברי הסבר" that this must not touch.
 */
function ChapterLabel({ text }: { text: string }) {
  const match = text.match(CHAPTER_MARKER);
  if (!match) return <>{text}</>;
  const [, before, marker, after] = match;
  const markerEl = (
    <span style={{ color: "var(--color-navy-ink)", fontWeight: 700 }}>{marker}</span>
  );

  // BOTH ORDERS IN THE MARKUP, ONE SHOWN AT A TIME BY CSS.
  //
  // This started as a `useIsNarrow()` branch and did not take effect on a real
  // phone, while the CSS-only changes shipped in the same batch did. Whatever
  // the cause — a stale client bundle, hydration timing — a layout rule that
  // only works once JavaScript has run and agreed with the stylesheet is the
  // wrong mechanism for something the stylesheet can decide by itself.
  //
  // `hidden`/`md:inline` is display:none, so the copy that is not shown is not
  // read by a screen reader either; the duplication costs a few bytes of markup
  // and nothing else.
  if (!before.trim()) {
    return (
      <>
        {markerEl}
        {after}
      </>
    );
  }

  // The dash belonged between the law and the chapter. Moving the chapter in
  // front of it would leave it dangling at the start of the row.
  const tail = before.replace(/\s*[—–-]\s*$/, "").trim();

  return (
    <>
      {/* Phone: the marker leads, so every row starts with the one thing that
          tells it apart — at the inline-start edge, which in RTL is the right.
          `leafLabel` leaves the REST of the law name in front of the chapter,
          and at 360px that pushed "פרק א׳" into the middle of a wrapped line. */}
      <span className="md:hidden">
        {markerEl}
        {after}
        {tail ? <span className="text-muted-foreground"> — {tail}</span> : null}
      </span>

      {/* Desktop: unchanged. The rail is wide enough there that the law tail
          reads as context rather than as an obstacle. */}
      <span className="hidden md:inline">
        {before}
        {markerEl}
        {after}
      </span>
    </>
  );
}

/**
 * How many leading words two neighbouring titles must share before they are
 * treated as one subject.
 *
 * THREE, measured against this booklet rather than guessed. At three,
 * "בקשה לעיכוב ביצוע פסק דין…" gathers its four variants and
 * "בקשה לעיכוב הליכים…" its two. At two, "בקשה לצו עיקול זמני" would be
 * swallowed into "בקשה לצו עיכוב יציאה מן הארץ" — different remedies that
 * happen to start the same way, which is how a grouping rule starts lying.
 */
const MIN_SHARED_WORDS = 3;

/** The words two titles open with in common. */
function commonWordPrefix(a: string, b: string): string {
  const left = a.split(/\s+/);
  const right = b.split(/\s+/);
  const shared: string[] = [];
  for (let at = 0; at < Math.min(left.length, right.length); at += 1) {
    if (left[at] !== right[at]) break;
    shared.push(left[at]);
  }
  return shared.join(" ");
}


type RailGroup = { stem: string; items: { id: string; heading: string }[] };

/**
 * Entries sharing a subject, as one group, in the order each subject first
 * appears.
 *
 * NOT ONLY CONSECUTIVE ONES. The booklet sets out the rules for three interim
 * remedies together and only then works through their examples, so
 * "בקשה לצו עיכוב יציאה מן הארץ" sits several entries above its own
 * "- דוגמה" and "(במעמד צד אחד)" with another remedy's examples in between. Read
 * strictly in sequence that is three entries for one subject, the first of them
 * stranded — which is what the rail looked like.
 *
 * A group therefore keeps the position of its FIRST entry and later ones join
 * it wherever they are. The rail stops being a transcript of the document's
 * order and becomes an index of what is in it, which is the job it is doing.
 */
function railGroups(entries: { id: string; heading: string }[]): RailGroup[] {
  const groups: RailGroup[] = [];
  for (const entry of entries) {
    const previous = groups[groups.length - 1];
    const stem =
      STAGE.test(entry.heading) && previous ? previous.stem : titleStem(entry.heading);

    // TWO WAYS IN, and the difference between them is what keeps this honest.
    //
    // Anywhere in the rail: the SAME title exactly. "בקשה לצו עיכוב יציאה מן
    // הארץ" and its "- דוגמה" and "(במעמד צד אחד)" reduce to one identical stem,
    // so they find each other across the examples of another remedy sitting
    // between them.
    //
    // Only against the group just built: titles that merely OPEN the same way.
    // That is a weaker signal and it needs the document's own adjacency to back
    // it up — searched rail-wide it folded "בקשה לביטול פסק דין שניתן במעמד צד
    // אחד" into "בקשה לביטול פסק בוררות", which share three words and are
    // different remedies.
    const previousGroup = groups[groups.length - 1];
    const shared = previousGroup ? commonWordPrefix(previousGroup.stem, stem) : "";
    const home =
      groups.find((group) => group.stem === stem) ??
      (shared && shared.split(/\s+/).length >= MIN_SHARED_WORDS ? previousGroup : undefined);

    if (home) {
      // The title narrows to what is true of everything under it: a group of
      // "…המוגשת לערכאה הדיונית" and "…המוגשת לערכאת הערעור" is titled with the
      // five words they share, not with whichever arrived first.
      if (home.stem !== stem) home.stem = commonWordPrefix(home.stem, stem) || home.stem;
      home.items.push(entry);
    } else {
      groups.push({ stem, items: [entry] });
    }
  }
  return groups;
}

/**
 * The reading surface for a document that was NOT converted into a usage guide.
 *
 * WHY A SECOND READER. <StudyReader> draws a guide: groups of (avoid, use)
 * pairs in a four-column table, because those rows exist to be compared. A
 * booklet of worked examples has no pairs and nothing to compare — it is prose
 * under headings, read in order. Forcing it through the table reader would have
 * produced a document of empty cells; bending the table reader to do both would
 * have made one component that does neither well.
 *
 * Both are fed from `lawpass_text` through study_material_public, so neither
 * can put the stored source in front of a candidate — see lib/db/study-material.
 *
 * The contents rail and the search box are deliberately the same as the guide
 * reader's. A candidate moving between the two documents should not have to
 * learn a second set of controls just because the material underneath differs.
 */
export function DocumentReader({
  doc,
  name,
}: {
  doc: StudyDocument;
  /**
   * What to call the document. A verbatim one carries no authored title — it
   * was copied, not written — so the page supplies the name it is known by.
   */
  name: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  /**
   * Every section, with an id assigned HERE rather than read from the data.
   *
   * The extractor did not write one: 103 of this booklet's 118 sections carry
   * `id: undefined`, so every contents link pointed at `#undefined` and they
   * all landed in the same place — which is what made the rail look unrelated
   * to the document. The nine sections written back by replace-section.mjs
   * shared one id between them, which fails the same way.
   *
   * Position is the one thing guaranteed to be present and unique, so it is
   * what the anchor is built from. The document's own id is ignored even when
   * it looks usable: one rule with no exceptions cannot produce a collision,
   * and a rule that trusts the data "when it seems fine" is how this got here.
   */
  const numbered = useMemo(
    () => doc.sections.map((section, at) => ({ ...section, id: `sec-${at}` })),
    [doc.sections]
  );

  const sections = useMemo(() => {
    if (!q) return numbered;
    const needle = q.toLowerCase();
    return numbered.filter((s) =>
      [s.heading, ...s.paragraphs].join(" ").toLowerCase().includes(needle)
    );
  }, [numbered, q]);

  const title = doc.title || name;
  // Sections with a heading are the ones worth listing; an untitled run of
  // paragraphs is a continuation, not a destination.
  //
  // AND NOT THE SUB-NOTES. "דגשים" and "לסיכום" repeat under nearly every
  // worked example — nine and seven times here — so listing them puts sixteen
  // identical, unrankable entries in a contents rail whose job is to say what
  // the document contains. They are still headed in the body, where the
  // example above them says which one you are reading.
  //
  // AND NOT A SECTION WITH NOTHING UNDER IT. A chapter title arrives as a
  // heading with no paragraphs — "כתב ערעור" printed above the chapter it opens
  // — and an entry leading to a heading with nothing beneath it wastes a line
  // of the rail. The stem grouping below puts those titles back as group
  // headings, which is the job they were doing.
  const titled = useMemo(
    () =>
      numbered.filter(
        (s) =>
          s.heading &&
          // Chapters only. A converted law book carries one level-2 section per
          // statutory provision — 381 of them in מהותי 1 — and listing those
          // turned the rail into a transcript of the document instead of an
          // index of it. Documents without levels are all level 1, so nothing
          // that worked before changes.
          (s.level ?? 1) === 1 &&
          !RAIL_SKIP.has(s.heading.trim()) &&
          (s.paragraphs.length > 0 || s.tables.length > 0)
      ),
    [numbered]
  );

  const groups = useMemo(() => railGroups(titled), [titled]);

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
          {title}
        </h1>
        {doc.intro ? (
          <p
            className="font-heebo"
            style={{ fontSize: 15, color: "var(--color-ink-muted)", lineHeight: 1.7 }}
          >
            {doc.intro}
          </p>
        ) : null}
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ insetInlineStart: 14, color: "var(--color-ink-dim)" }}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש בתוך המסמך"
          aria-label="חיפוש בתוך המסמך"
          className="w-full rounded-xl border py-2.5 font-heebo outline-none transition-colors focus:border-[var(--color-gold-deep)]"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-card, #fff)",
            fontSize: 14,
            paddingInlineStart: 40,
            paddingInlineEnd: query ? 40 : 14,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="ניקוי החיפוש"
            className="absolute top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:bg-black/[0.06]"
            style={{ insetInlineEnd: 10, color: "var(--color-ink-dim)" }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {q ? (
        <p className="font-heebo" style={{ fontSize: 13, color: "var(--color-ink-dim)" }}>
          {sections.length} מתוך {doc.sections.length} פרקים
        </p>
      ) : titled.length > 1 ? (
        <nav
          aria-label="תוכן המסמך"
          // p-3.5 on a phone. At p-5 the rail lost 40px of a 360px screen to
          // padding, and these entries are long law names that then wrapped
          // after two or three words — a contents list that is mostly ragged
          // half-lines is harder to scan than the document it indexes.
          className="rounded-2xl border p-3.5 md:p-5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
        >
          {/* COLUMNS, NOT A GRID. A grid fills row by row, which cuts a group
              across two columns and puts the second half at the start of the
              next line. Multi-column flows top to bottom and `break-inside`
              keeps a group whole, so a document type and its parts stay
              together — which is the whole point of grouping them. */}
          <ul className="columns-1 gap-x-6 sm:columns-2 lg:columns-3 lg:gap-x-8">
            {groups.map((group) => (
              <li
                key={group.items[0].id}
                className="mb-3 break-inside-avoid"
                style={{ breakInside: "avoid" }}
              >
                {/* A single-chapter law still gets the parent/child shape, so
                    the rail reads the same way down its whole length: 12 of the
                    43 laws in the מהותי books have one chapter, and as plain
                    lines they sat visually outside the structure everything
                    else was in.

                    The exception is a heading that is ALL stem — "דברי הסבר" in
                    the open-questions booklets, where leafLabel has nothing to
                    strip. Those stay a plain link; giving them a parent would
                    mean a heading above its own duplicate. */}
                {group.items.length === 1 &&
                leafLabel(group.items[0].heading, group.stem) === group.items[0].heading ? (
                  <a
                    href={`#${group.items[0].id}`}
                    className="font-heebo transition-colors hover:underline"
                    style={{ fontSize: 13.5, color: "var(--color-gold-deep)" }}
                  >
                    <ChapterLabel text={group.items[0].heading} />
                  </a>
                ) : (
                  <>
                    {/* The stem in ink, not gold: it names the group and is not
                        itself somewhere to go. Only the parts are links.
                        Gold rule beneath it, so a law reads as the parent of
                        the chapters indented under it rather than as another
                        line in the same list. */}
                    <p
                      className="font-heebo font-bold"
                      style={{
                        fontSize: 13.5,
                        color: "var(--color-navy-ink)",
                        paddingBottom: 3,
                        borderBottom: "1px solid var(--color-gold, #C9A149)",
                      }}
                    >
                      {group.stem}
                    </p>
                    {/* Gold border on the indent, matching the rule above: the
                        two together draw the bracket that says these belong to
                        that. The grey border was invisible at this size. */}
                    <ul
                      className="mt-1.5 space-y-1 border-s ps-2 md:ps-3"
                      style={{ borderColor: "var(--color-gold, #C9A149)", borderInlineStartWidth: 2 }}
                    >
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="font-heebo transition-colors hover:underline"
                            style={{ fontSize: 13, color: "var(--color-gold-deep)" }}
                          >
                            <ChapterLabel text={leafLabel(item.heading, group.stem)} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="space-y-7">
        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
        {sections.length === 0 ? (
          <p
            className="rounded-xl border border-dashed p-10 text-center font-heebo"
            style={{ borderColor: "var(--color-border)", color: "var(--color-ink-dim)", fontSize: 14 }}
          >
            לא נמצאו תוצאות לחיפוש הזה.
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Which way one paragraph or table cell runs.
 *
 * NOT `dir="auto"`, which is what this used to be. `auto` decides from the
 * FIRST STRONG character and falls back to LTR when the text has none — and
 * digits, brackets, dots and whitespace are all neutral. So a placeholder line
 * inside a worked example, "2. [...]", has no strong character at all and was
 * being laid out left-to-right: flush left, in the middle of a right-aligned
 * Hebrew pleading, with its brackets mirrored. 25 paragraphs of this booklet
 * did that.
 *
 * The document's own direction is the default instead, and LTR is used only
 * when a line genuinely leads with Latin script — an English case name or a
 * citation still sets itself the right way round.
 */
function textDir(text: string): "rtl" | "ltr" {
  const strong = text.match(/[֐-׿؀-ۿ]|[A-Za-z]/);
  return strong && /[A-Za-z]/.test(strong[0]) ? "ltr" : "rtl";
}

function Section({ section }: { section: StudySection }) {
  return (
    <section id={section.id} className="scroll-mt-24 space-y-3">
      {section.heading && (section.level ?? 1) === 1 ? (
        // The rule under the heading is where a section STARTS. In a document
        // of 118 sections whose headings repeat — ten "הוראות הדין", nine
        // "דגשים" — the words alone do not tell a reader they have crossed into
        // the next one, and a scrolled page of Hebrew prose looks continuous.
        // Gold rather than the border grey: it is a divider that should be
        // found while scrolling past, not one that recedes.
        <h2
          className="font-heebo font-bold"
          style={{
            fontSize: 19,
            color: "var(--color-navy-ink)",
            lineHeight: 1.35,
            paddingBottom: 6,
            borderBottom: "2px solid var(--color-gold, #C9A149)",
          }}
        >
          {section.heading}
        </h2>
      ) : null}

      {section.heading && (section.level ?? 1) === 2 ? (
        // Inside a chapter. Still a heading a reader scans for — one statutory
        // provision — but it must not compete with the chapter rule above it,
        // so no gold divider and a smaller, quieter type.
        <h3
          className="font-heebo font-semibold"
          style={{ fontSize: 16, color: "var(--color-navy-ink)", lineHeight: 1.4, marginTop: 4 }}
        >
          {section.heading}
        </h3>
      ) : null}

      {section.paragraphs.map((text, at) => (
        <p
          key={at}
          dir={textDir(text)}
          className="whitespace-pre-wrap font-heebo"
          style={{ fontSize: 15.5, color: "var(--color-ink)", lineHeight: 1.85 }}
        >
          {text}
        </p>
      ))}

      {section.tables.map((table, at) => (
        <div
          key={at}
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "var(--color-border)" }}
        >
          <table className="w-full" style={{ fontSize: 14, borderCollapse: "collapse" }}>
            {table.columns ? (
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                  {table.columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-2.5 text-start font-heebo font-bold"
                      style={{ color: "var(--color-navy-ink)" }}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {table.rows.map((row, rowAt) => {
                // Two row shapes reach here: a named-column table stores an
                // object keyed by column, an unnamed one a plain array. Both
                // come out of the same extractor, so both are drawn.
                const cells = Array.isArray(row)
                  ? row
                  : (table.columns ?? Object.keys(row)).map((c) => row[c] ?? "");
                return (
                  <tr key={rowAt} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    {cells.map((cell, cellAt) => (
                      <td
                        key={cellAt}
                        dir={textDir(cell)}
                        className="whitespace-pre-wrap px-4 py-2.5 align-top font-heebo"
                        style={{ color: "var(--color-ink)", lineHeight: 1.7 }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
