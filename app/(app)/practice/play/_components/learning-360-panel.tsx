"use client";

import {
  BookOpen,
  Compass,
  Eye,
  Gavel,
  Layers,
  Scale,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";

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
 *   - gold    → amber (for "חשיבה מהירה 360°")
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
 * Field-to-section mapping (DB column → section):
 *   1. correctChoice (passed in) → green correct-answer banner
 *   2. legal_topic_analysis      → "ניתוח הנושא המשפטי"
 *   3. full_explanation          → "הסבר משפטי מלא"
 *   4. choices × distractor_analysis → "ניתוח מסיחים" (table)
 *   5. common_pitfall            → "מלכודת נפוצה" (danger accent)
 *   6. concepts_and_skills jsonb → "מושגים ומיומנויות" (tag chips)
 *   7. quick_thinking_360        → "חשיבה מהירה 360°" (gold accent,
 *                                   whitespace-pre-wrap container)
 *   8. summary_for_memory        → "מבט מסכם לזכירה"
 *   9. references_list jsonb     → "רפרנסים" (ul/li, dir="auto")
 */
export function Learning360Panel({
  question,
  correctChoice,
}: Learning360PanelProps) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-background p-6 shadow-sm">
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

      {/* 5. Common pitfall */}
      <Section
        icon={<TriangleAlert className="size-3.5" />}
        title="מלכודת נפוצה"
        accent="danger"
      >
        <p dir="auto" className="whitespace-pre-wrap">
          {question.common_pitfall}
        </p>
      </Section>

      {/* 6. Concepts & skills (tag chips) */}
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

      {/* 7. Quick thinking 360° — gold accent, pre-wrap content */}
      <Section
        icon={<Zap className="size-3.5" />}
        title="חשיבה מהירה 360°"
        accent="gold"
      >
        <div
          dir="rtl"
          className="rounded-md border-s-[3px] border-amber-500 bg-amber-50 p-4 text-[15px] leading-relaxed whitespace-pre-wrap dark:bg-amber-950/30"
        >
          {question.quick_thinking_360}
        </div>
      </Section>

      {/* 8. Summary */}
      <Section icon={<Eye className="size-3.5" />} title="מבט מסכם לזכירה">
        <p dir="auto" className="whitespace-pre-wrap">
          {question.summary_for_memory}
        </p>
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
