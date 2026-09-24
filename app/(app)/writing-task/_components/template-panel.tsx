"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { OpenQuestionTemplate } from "@/lib/db/open-question-templates";

/**
 * The skeleton pane — the template a candidate writes into, beside the paper.
 *
 * A writing task is marked on structure as much as on law, and the templates
 * are the structure: כותרת · עיקר הטענות · טיעון עובדתי, with ]blanks[ where the
 * facts go. Showing one next to the question is the difference between a
 * candidate remembering the shape of a כתב תביעה and having it in front of them.
 *
 * ONE SKELETON IS SHOWN, not the whole legal area. A civil task is eligible for
 * eighteen of them, and a row of eighteen chips is not an answer to "which one
 * do I write" — it is the question restated. lib/db/open-question-templates.ts
 * ranks them against what the task says it wants (`deliverable`) and this shows
 * the winner, labelled by how sure that ranking is: a clear lead reads as
 * השלד המתאים, anything closer as השלד הקרוב ביותר.
 *
 * The others stay one click behind "שלדים אחרים". The ranking is a reading of
 * the task, and a candidate who disagrees with it should not have to leave the
 * page to act on that.
 *
 * The body is rendered as pre-wrapped text, not parsed into structure. It is a
 * skeleton with its own numbering and indentation, and re-typesetting it would
 * only be a chance to lose a line.
 */
/**
 * The two blocks the list is shown in: the skeletons for this kind of case, and
 * then the all-purpose ones together at the end. The second block is labelled
 * because "תבנית כללית ל…" repeated five times reads as five documents rather
 * than as one set of fallbacks.
 */
const GROUPS: { heading: string | null; pick: (t: OpenQuestionTemplate) => boolean }[] = [
  { heading: null, pick: (t) => !t.isGeneric },
  { heading: "תבניות למכתבים כללים", pick: (t) => t.isGeneric },
];

export function TemplatePanel({ templates }: { templates: OpenQuestionTemplate[] }) {
  // The pane opens on the skeleton the ranking chose, which is not necessarily
  // the first in the list — the general ones are listed last as a group but are
  // often the right answer.
  const chosenIndex = Math.max(0, templates.findIndex((t) => t.isChosen));
  const [selected, setSelected] = useState(chosenIndex);
  const [showAll, setShowAll] = useState(false);

  // Dev-only trace of what actually crossed the server/client boundary. The
  // server logs what it READ; this logs what the pane RECEIVED, and the two
  // together say which side dropped it — a prop that never arrived looks
  // identical to a query that found nothing once it reaches the empty state.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.info("[templates] pane received", templates?.length ?? 0, "template(s)", templates);
  }, [templates]);

  if (templates.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="px-4 py-6 md:px-6">
          <h2
            className="font-heebo font-bold"
            style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
          >
            שלד כתיבה
          </h2>
          <p
            className="mt-2 font-heebo"
            style={{ fontSize: 14, color: "var(--color-ink-dim)" }}
          >
            אין שלד כתיבה משויך לשאלה זו.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = templates[Math.min(selected, templates.length - 1)];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            className="font-heebo font-bold"
            style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
          >
            שלד כתיבה
          </h2>
          <span className="font-heebo" style={{ fontSize: 12, color: "var(--color-ink-dim)" }}>
            {/* What the pick is worth. A confident match says so; anything else
                says it is the closest one, which is the honest word for a task
                that did not name its document clearly. */}
            {selected !== chosenIndex
              ? "נבחר על ידך"
              : active.isBestMatch
                ? "השלד המתאים למטלה"
                : "השלד הקרוב ביותר"}
          </span>
        </div>

        {/* ONE skeleton, not eighteen. The question names the document it wants
            and the ranking has already chosen it, so showing the whole area as
            a row of chips buries that answer in its own alternatives. The rest
            stay one click away, because the ranking is a reading of the task
            and the candidate may disagree with it. */}
        {templates.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="self-start font-heebo underline underline-offset-2"
              style={{ fontSize: 12, color: "var(--color-gold-deep)" }}
            >
              {showAll ? "הסתר" : `שלדים אחרים (${templates.length - 1})`}
            </button>
            {showAll ? (
              <div className="space-y-2" role="tablist" aria-label="בחירת שלד כתיבה">
                {GROUPS.map(({ heading, pick }) => {
                  const items = templates
                    .map((t, i) => ({ t, i }))
                    .filter(({ t }) => pick(t));
                  if (items.length === 0) return null;
                  return (
                    <div key={heading ?? "area"} className="space-y-1.5">
                      {heading ? (
                        <p
                          className="font-heebo font-semibold"
                          style={{ fontSize: 11.5, color: "var(--color-ink-dim)" }}
                        >
                          {heading}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(({ t, i }) => {
                          const isActive = t.number === active.number;
                          return (
                            <button
                              key={t.number}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setSelected(i)}
                              className="rounded-full border px-3 py-1 font-heebo transition-colors"
                              style={{
                                fontSize: 12,
                                borderColor: isActive ? "var(--color-gold-deep)" : "var(--color-border)",
                                background: isActive ? "var(--color-gold-deep)" : "transparent",
                                color: isActive ? "#fff" : "var(--color-ink-muted)",
                                fontWeight: isActive ? 700 : 500,
                              }}
                            >
                              {t.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="space-y-1">
          <p className="font-heebo font-bold" style={{ fontSize: 15, color: "var(--color-navy-ink)" }}>
            {active.title}
          </p>
          <p className="font-heebo" style={{ fontSize: 12, color: "var(--color-ink-dim)" }}>
            {active.part}
          </p>
          {active.summary ? (
            <p
              className="font-heebo leading-[1.7]"
              style={{ fontSize: 12.5, color: "var(--color-ink-muted)" }}
            >
              {active.summary}
            </p>
          ) : null}
        </div>

        {/* Scrolls on its own so a long skeleton cannot push the answer sheet
            off the screen — the two panes above the sheet stay the same height
            whichever template is chosen. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border px-3 py-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-parchment, #fcfbf7)" }}
        >
          <pre
            dir="rtl"
            className="whitespace-pre-wrap font-heebo leading-[1.85]"
            style={{ fontSize: 13.5, color: "var(--color-ink)", fontFamily: "inherit", margin: 0 }}
          >
            {active.body}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
