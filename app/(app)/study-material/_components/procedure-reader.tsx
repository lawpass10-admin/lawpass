"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { StudyDoc, StudyStage } from "@/lib/db/study-material";

/** The procedure half of the union — stages of work, not pairs or pages. */
type StudyProcedure = Extract<StudyDoc, { kind: "procedure" }>;

/**
 * The reading surface for a procedure guide.
 *
 * THE THIRD SHAPE, and each of the three exists because its material has a
 * different unit. A usage guide's unit is a PAIR, compared across columns. A
 * verbatim booklet's unit is a PASSAGE, read in order. A procedure guide's unit
 * is a RULE: a requirement the exam imposes, what to do about it, and what going
 * wrong looks like. Those three lines belong together and stacked, not in a
 * four-column table where `do` and `pitfall` would be squeezed into cells.
 *
 * The stages are numbered and ordered, because that is the whole point of the
 * reorganisation the contract asks for: this is the order the work is done in,
 * not the order the source happened to explain it.
 *
 * Everything here comes from `lawpass_text` through study_material_public, so
 * the stored source cannot reach the screen.
 */
export function ProcedureReader({ doc }: { doc: StudyProcedure }) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  const stages = useMemo(() => {
    if (!q) return doc.stages;
    const needle = q.toLowerCase();
    return doc.stages
      .map((s) => ({
        ...s,
        rules: s.rules.filter((r) =>
          [r.requirement, r.do, r.pitfall].join(" ").toLowerCase().includes(needle)
        ),
      }))
      .filter((s) => s.rules.length > 0);
  }, [doc.stages, q]);

  const total = doc.stages.reduce((n, s) => n + s.rules.length, 0);
  const shown = stages.reduce((n, s) => n + s.rules.length, 0);

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
          placeholder="חיפוש בכללים — למשל: נספח"
          aria-label="חיפוש בכללים"
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
          {shown} מתוך {total} כללים
        </p>
      ) : (
        <nav
          aria-label="שלבי העבודה"
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
        >
          <ol className="space-y-1.5">
            {doc.stages.map((stage, i) => (
              <li key={stage.id}>
                <a
                  href={`#${stage.id}`}
                  className="font-heebo transition-colors hover:underline"
                  style={{ fontSize: 13.5, color: "var(--color-gold-deep)" }}
                >
                  {i + 1}. {stage.heading}
                </a>
                <span
                  className="font-heebo"
                  style={{ fontSize: 12.5, color: "var(--color-ink-dim)" }}
                >
                  {" "}
                  · {stage.rules.length} כללים
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="space-y-10">
        {stages.map((stage, i) => (
          <Stage key={stage.id} stage={stage} index={i} />
        ))}
        {stages.length === 0 ? (
          <p
            className="rounded-xl border border-dashed p-10 text-center font-heebo"
            style={{ borderColor: "var(--color-border)", color: "var(--color-ink-dim)", fontSize: 14 }}
          >
            לא נמצאו כללים לחיפוש הזה.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Stage({ stage, index }: { stage: StudyStage; index: number }) {
  return (
    <section id={stage.id} className="scroll-mt-24 space-y-4">
      <header className="space-y-1">
        <h2
          className="font-heebo font-bold"
          style={{ fontSize: 20, color: "var(--color-navy-ink)", lineHeight: 1.3 }}
        >
          <span style={{ color: "var(--color-gold-deep)" }}>{index + 1}.</span> {stage.heading}
        </h2>
        {stage.why_this_stage ? (
          <p
            className="font-heebo"
            style={{ fontSize: 14, color: "var(--color-ink-muted)", lineHeight: 1.6 }}
          >
            {stage.why_this_stage}
          </p>
        ) : null}
      </header>

      <ol className="space-y-3">
        {stage.rules.map((rule) => (
          <li
            key={rule.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card, #fff)" }}
          >
            {/* The requirement leads, because it is the thing that is binding.
                `do` and `pitfall` are advice about it and read as such. */}
            <p
              dir="auto"
              className="font-heebo font-bold"
              style={{ fontSize: 15.5, color: "var(--color-navy-ink)", lineHeight: 1.6 }}
            >
              {rule.requirement}
            </p>
            {rule.do ? (
              <p
                dir="auto"
                className="mt-2 font-heebo"
                style={{ fontSize: 15, color: "var(--color-ink)", lineHeight: 1.75 }}
              >
                {rule.do}
              </p>
            ) : null}
            {rule.pitfall ? (
              <p
                dir="auto"
                className="mt-2 font-heebo"
                style={{
                  fontSize: 14,
                  color: "var(--color-ink-muted)",
                  lineHeight: 1.7,
                  borderInlineStart: "3px solid var(--color-border)",
                  paddingInlineStart: 10,
                }}
              >
                <span style={{ fontWeight: 700 }}>איך זה נכשל: </span>
                {rule.pitfall}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
