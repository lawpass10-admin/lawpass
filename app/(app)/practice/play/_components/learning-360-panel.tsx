"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Gavel,
  Layers,
  Scale,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useState } from "react";

import type {
  AngleQuestionRow,
  Choice,
  SourceQuestionRow,
} from "@/lib/db/practice";
import { cn } from "@/lib/utils";

type Learning360PanelProps = {
  question: SourceQuestionRow | AngleQuestionRow;
  correctChoice: Choice;
};

type SectionProps = {
  icon: React.ReactNode;
  title: string;
  accent?: "default" | "danger" | "gold";
  children: React.ReactNode;
};

/**
 * One labelled section inside the 360° panel. Icon tile on the right
 * (RTL = visual-end), heading next to it, content indented below.
 *
 * `accent` shifts the icon tile colour for sections that warrant a
 * stronger visual cue:
 *   - default → primary tint
 *   - danger  → destructive (for "מלכודת נפוצה")
 *   - gold    → amber (for "חשיבה 360°")
 */
function Section({ icon, title, accent = "default", children }: SectionProps) {
  return (
    <section className="mb-6 last:mb-0">
      <header className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            accent === "default" && "bg-primary/10 text-primary",
            accent === "danger" && "bg-destructive/15 text-destructive",
            accent === "gold" && "bg-amber-100 text-amber-700"
          )}
          aria-hidden
        >
          {icon}
        </span>
        <h4 className="text-base font-semibold">{title}</h4>
      </header>
      <div className="ps-[38px] text-[15px] leading-relaxed text-foreground/85">
        {children}
      </div>
    </section>
  );
}

/**
 * The full inline 360° panel — 9 ordered sections per the plan + the
 * prototype. No collapse/expand state; the parent decides whether to
 * mount this component. Drawer layout was rejected by PM (plan §2).
 *
 * Field-to-section mapping (DB column → section). Slice 12 reordered
 * concepts_and_skills to sit immediately above references_list, and
 * renamed the quick_thinking_360 heading from "חשיבה מהירה 360°" to
 * "חשיבה 360°":
 *   1. correctChoice (passed in) → green correct-answer banner
 *   2. legal_topic_analysis      → "ניתוח הנושא המשפטי"
 *   3. full_explanation          → "הסבר משפטי מלא"
 *   4. choices × distractor_analysis → "ניתוח מסיחים" (table)
 *   5. common_pitfall            → "מלכודת נפוצה" (danger accent
 *                                   + red alert content card, Slice 12)
 *   6. quick_thinking_360        → "חשיבה 360°" (gold accent,
 *                                   per-variation card stack)
 *   7. summary_for_memory        → "מבט מסכם לזכירה"
 *   8. concepts_and_skills jsonb → "מושגים ומיומנויות" (tag chips)
 *   9. references_list jsonb     → "רפרנסים" (ul/li, dir="auto")
 */
export function Learning360Panel({
  question,
  correctChoice,
}: Learning360PanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-6 flex items-center gap-2.5 border-b border-border pb-4">
        <Compass className="size-5 text-primary" aria-hidden />
        <h3 className="text-lg font-semibold">פירוט מלא — שיטת ה־360°</h3>
      </header>

      {/* 1. Correct answer banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-500/50 bg-emerald-50 p-4 dark:bg-emerald-950/30">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
          aria-hidden
        >
          ✓
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            תשובה נכונה — אפשרות {correctChoice.letter}
          </p>
          <p
            dir="auto"
            className="text-sm leading-relaxed text-foreground/85"
          >
            {correctChoice.choice_text}
          </p>
        </div>
      </div>

      {/* 2. Topic */}
      <Section icon={<BookOpen className="size-3.5" />} title="ניתוח הנושא המשפטי">
        <p dir="auto" className="whitespace-pre-wrap">
          {question.legal_topic_analysis}
        </p>
      </Section>

      {/* 3. Explanation */}
      <Section icon={<Scale className="size-3.5" />} title="הסבר משפטי מלא">
        <p dir="auto" className="whitespace-pre-wrap">
          {question.full_explanation}
        </p>
      </Section>

      {/* 4. Distractor analysis table */}
      <Section icon={<Layers className="size-3.5" />} title="ניתוח מסיחים">
        <div className="space-y-2.5">
          {question.choices.map((c) => (
            <div
              key={c.letter}
              className="grid grid-cols-[auto_auto_1fr] items-start gap-3 rounded-md bg-muted/40 p-3 text-sm leading-relaxed"
            >
              <span
                className={cn(
                  "font-semibold",
                  c.is_correct ? "text-emerald-700" : "text-muted-foreground"
                )}
              >
                {c.letter}
              </span>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-semibold text-white",
                  c.is_correct ? "bg-emerald-500" : "bg-destructive"
                )}
              >
                {c.is_correct ? "נכון" : "שגוי"}
              </span>
              {c.distractor_analysis ? (
                <span dir="auto" className="text-foreground/80">
                  {c.distractor_analysis}
                </span>
              ) : (
                <span dir="ltr" className="text-muted-foreground">
                  —
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Common pitfall — Slice 12 wraps the body in a soft red
          alert card. The accent="danger" icon tile alone wasn't
          enough of a signal; the content body now reads visually as
          a warning (rounded border + destructive-tinted background)
          while staying readable for long whitespace-pre-wrap copy. */}
      <Section
        icon={<TriangleAlert className="size-3.5" />}
        title="מלכודת נפוצה"
        accent="danger"
      >
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 dark:bg-destructive/10">
          <p dir="auto" className="whitespace-pre-wrap">
            {question.common_pitfall}
          </p>
        </div>
      </Section>

      {/* 6. Quick thinking 360° — gold accent, parsed into per-variation
          cards (Slice 7.6). Falls back to whitespace-pre-wrap when the
          text doesn't carry the **וריאציה N — title:** ← answer pattern.
          Slice 12 dropped the word "מהירה" from the heading. */}
      <Section
        icon={<Zap className="size-3.5" />}
        title="חשיבה 360°"
        accent="gold"
      >
        <QuickThinking360 text={question.quick_thinking_360} />
      </Section>

      {/* 7. Summary */}
      <Section icon={<Eye className="size-3.5" />} title="מבט מסכם לזכירה">
        <p dir="auto" className="whitespace-pre-wrap">
          {question.summary_for_memory}
        </p>
      </Section>

      {/* 8. Concepts & skills (tag chips). Slice 12 relocated this
          section to sit immediately above "רפרנסים" so the reader
          ends with the lookup-style tail (concepts + sources) after
          the narrative-style body (analysis, explanation, pitfall,
          variations, summary). */}
      <Section
        icon={<Sparkles className="size-3.5" />}
        title="מושגים ומיומנויות"
      >
        {question.concepts_and_skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {question.concepts_and_skills.map((concept, i) => (
              <li
                key={`${i}-${concept}`}
                dir="auto"
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {concept}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Section>

      {/* 9. References */}
      <Section icon={<Gavel className="size-3.5" />} title="רפרנסים">
        {question.references_list.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5 text-foreground/80 marker:text-muted-foreground">
            {question.references_list.map((ref, i) => (
              <li key={`${i}-${ref}`} dir="auto">
                {ref}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Section>
    </div>
  );
}

// =============================================================================
// quick_thinking_360 — parser + per-variation card stack (Slice 7.6)
// =============================================================================

type ParsedVariation = {
  /** The visible question. May include trailing punctuation. */
  question: string;
  /** The hidden answer, revealed on click. Null when the variation
   *  has no " ← " separator (rare seed-data edge case). */
  answer: string | null;
};

type Parsed360 =
  | { kind: "parsed"; variations: ParsedVariation[] }
  | { kind: "fallback"; text: string };

/**
 * Splits a `quick_thinking_360` string into variations.
 *
 * Canonical input shape (per Sharon's content, 730+ rows verified):
 *   "[asterisks]וריאציה 1 — title:[asterisks] question? ← answer.
 *    [asterisks]וריאציה 2 — title:[asterisks] question? ← answer."
 *   ...where [asterisks] is the literal two-star bold delimiter.
 *
 * Strategy — see VARIATION_HEADER_RE below:
 *   1. Split on the marker regex — a lazy match from the opening
 *      bold-asterisks וריאציה N through to the next bold-asterisks
 *      that closes the title. Each segment after the first split is
 *      a variation body (the marker-and-title preface is consumed by
 *      the regex itself).
 *   2. If we found < 1 variation body (e.g. legacy free-form text
 *      with no markers), return kind: "fallback" so the renderer
 *      keeps the prior whitespace-pre-wrap behaviour.
 *   3. Per body: split on " ← " (space + LTR arrow + space). When
 *      the arrow is absent (~13% of source / ~13% of angle rows have
 *      glued question+answer due to a seed-data import quirk), the
 *      whole body becomes the question and answer is null — the card
 *      renders without a reveal button.
 */
const VARIATION_HEADER_RE = /\*\*וריאציה\s*\d+[\s\S]*?\*\*/;
function parseQuickThinking360(raw: string): Parsed360 {
  if (!raw) return { kind: "fallback", text: "" };

  // Lazy match the whole header (opening bold asterisks through the
  // title's closing bold asterisks). The split discards the header
  // text and yields the bodies.
  const segments = raw.split(VARIATION_HEADER_RE);

  // segments[0] is the preamble (almost always empty/whitespace).
  // segments[1+] are the variation bodies.
  const bodies = segments.slice(1);
  if (bodies.length === 0) {
    return { kind: "fallback", text: raw };
  }

  const variations: ParsedVariation[] = [];
  for (const raw_body of bodies) {
    const body = raw_body.trim();
    if (!body) continue;
    const arrowIdx = body.indexOf(" ← ");
    if (arrowIdx === -1) {
      variations.push({ question: body, answer: null });
    } else {
      const question = body.slice(0, arrowIdx).trim();
      const answer = body.slice(arrowIdx + 3).trim();
      variations.push({
        question,
        answer: answer.length > 0 ? answer : null,
      });
    }
  }

  if (variations.length === 0) {
    return { kind: "fallback", text: raw };
  }
  return { kind: "parsed", variations };
}

/**
 * Renders the parsed `quick_thinking_360` body inside the existing
 * gold-accent container. Each variation is its own card with the
 * question always visible and the answer behind a click-to-reveal
 * button. Local state tracks which indices are revealed.
 *
 * Fallback branch (parser found no markers): renders the raw string
 * in the prior `<div whitespace-pre-wrap>` so existing layouts for
 * legacy rows aren't disturbed.
 */
function QuickThinking360({ text }: { text: string }) {
  const parsed = parseQuickThinking360(text);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  if (parsed.kind === "fallback") {
    return (
      <div
        dir="rtl"
        className="rounded-md border-s-[3px] border-amber-500 bg-amber-50 p-4 text-[15px] leading-relaxed whitespace-pre-wrap dark:bg-amber-950/30"
      >
        {parsed.text}
      </div>
    );
  }

  function toggle(index: number): void {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {parsed.variations.map((v, i) => {
        const isOpen = revealed.has(i);
        return (
          <article
            key={i}
            dir="rtl"
            className="rounded-md border-s-[3px] border-amber-500 bg-amber-50 p-4 text-[15px] leading-relaxed dark:bg-amber-950/30"
          >
            <p
              dir="auto"
              className="whitespace-pre-wrap font-medium text-foreground/90"
            >
              {v.question}
            </p>
            {v.answer !== null ? (
              <>
                {isOpen ? (
                  <p
                    dir="auto"
                    className="mt-3 whitespace-pre-wrap border-t border-amber-200 pt-3 text-foreground/85 dark:border-amber-900/50"
                  >
                    {v.answer}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  className={cn(
                    "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    "text-amber-800 hover:bg-amber-100/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                    "dark:text-amber-200 dark:hover:bg-amber-900/40"
                  )}
                >
                  {isOpen ? (
                    <>
                      <span>הסתר תשובה</span>
                      <ChevronUp className="size-3.5" aria-hidden />
                    </>
                  ) : (
                    <>
                      <span>הראה תשובה</span>
                      <ChevronDown className="size-3.5" aria-hidden />
                    </>
                  )}
                </button>
              </>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
