import { Clock } from "lucide-react";

import type { ExamMode } from "@/lib/exam/clusters";

/**
 * Presentational shell for the exam intro screen. Renders the hero,
 * stat grid, and "before you start" info card — everything EXCEPT the
 * action footer (CTAs / dialog) and the mode picker. Shared by
 * <ExamIntro> and the background of <ResumePrompt> so the two flows
 * never diverge visually.
 *
 * Slice 9 follow-up — the "חלוקה לפי אשכולות" breakdown card was
 * removed. Real bar exams don't expose cluster labels to candidates;
 * the per-cluster question allocation (14/11/13 procedural,
 * 20-procedural-+-20-substantive combined, etc.) is now an internal
 * sampling-only construct surfaced nowhere in the UI. The mode picker
 * itself stays in <ExamIntro> — it's the Slice 9 feature, not a
 * cluster surface.
 *
 * Slice 33 — `<IntroContent>` was split into `<IntroHero>` +
 * `<IntroStatsAndBox>` so `<ExamIntro>` can slot the ModePicker BETWEEN
 * the two halves (hero → picker → stats+box). `<IntroContent>` stays
 * exported as a thin wrapper that composes both halves in sequence,
 * so `<ResumePrompt>` keeps using the same single-element API.
 *
 * No client interaction lives here, so the components are server-safe.
 * The matching client components ("use client") import them and append
 * their own footer.
 *
 * Visual mapping from the PM-supplied prototype:
 *   - `--gold`        → amber-* utilities (matches Slice 2 conventions)
 *   - `--ink`         → bg-primary (already a near-black token in
 *                       light mode: oklch(0.205 0 0))
 *   - `--bg-warm`     → bg-amber-50 + border-amber-200/60
 *   - `--gold-soft`   → border-amber-300/60
 */

/**
 * Hero block — gold-clock icon, eyebrow, h1, subline. Sized
 * `max-w-3xl` and centered to match the original IntroContent
 * envelope. Slice 33 split.
 */
export function IntroHero({ mode = "procedural" }: { mode?: ExamMode } = {}) {
  const heroEyebrow = HERO_EYEBROW_BY_MODE[mode];
  const heroSubline = HERO_SUBLINE_BY_MODE[mode];

  return (
    <div className="mx-auto w-full max-w-3xl pt-6">
      <header className="space-y-3 text-center">
        {/* Hero square: dark/ink background, gold clock icon */}
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl bg-primary text-amber-400">
          <Clock className="size-8" aria-hidden />
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {heroEyebrow}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          40 שאלות. 100 דקות.
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          {heroSubline}
        </p>
      </header>
    </div>
  );
}

/**
 * Stats + info-box block — 4-card KPI grid + the amber
 * "לפני שמתחילים" card. Slice 33 split. Stays mode-agnostic
 * (the numbers are mode-invariant).
 */
export function IntroStatsAndBox() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-6">
      {/* 4 stat cards — 2x2 on mobile, 1x4 on desktop. Same numbers
          across all modes — the duration/total/threshold contract is
          mode-invariant. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="שאלות" value="40" sub="ארבע אפשרויות" />
        <StatCard label="זמן" value="100" sub="דקות סה״כ" />
        <StatCard label="סף מעבר" value="60%" sub="24 שאלות" />
        <StatCard label="ניקוד שלילי" value="אין" sub="כמו בבחינה" />
      </div>

      {/* "לפני שמתחילים" warm-tinted card */}
      <section className="rounded-xl border border-amber-300/60 bg-amber-50 p-5 dark:bg-amber-950/20">
        <h3 className="text-sm font-semibold">לפני שמתחילים</h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground/85 ps-5">
          <li className="list-disc">
            מותר לדלג ולחזור לשאלות, להשהות ולסיים מוקדם.
          </li>
          <li className="list-disc">
            אין הצגת תשובות נכונות במהלך הבחינה. סקירה מלאה תוצג בסיום.
          </li>
          <li className="list-disc">
            הסימולציה נשמרת אוטומטית — סגירת חלון לא תאבד את ההתקדמות.
          </li>
        </ul>
      </section>
    </div>
  );
}

/**
 * Back-compat wrapper. `<ResumePrompt>` (the frozen-background usage)
 * keeps consuming this single element. `<ExamIntro>` no longer uses
 * this — it imports the two halves directly so it can place the
 * ModePicker between them.
 */
export function IntroContent({ mode = "procedural" }: { mode?: ExamMode } = {}) {
  return (
    <>
      <IntroHero mode={mode} />
      <IntroStatsAndBox />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mode-keyed copy
// ---------------------------------------------------------------------------

const HERO_EYEBROW_BY_MODE: Record<ExamMode, string> = {
  procedural: "סימולציית בחינה",
  substantive: "סימולציית בחינה — דין מהותי",
  combined: "סימולציה משולבת",
};

const HERO_SUBLINE_BY_MODE: Record<ExamMode, string> = {
  procedural:
    "סימולציה נאמנה למבנה בחינת הלשכה. ללא הסברים במהלך הבחינה. ניקוד מעבר: 24/40 (60%).",
  substantive:
    "סימולציה בדיני מהות (חוזים, קניין, חברות ועוד). ללא הסברים במהלך הבחינה. ניקוד מעבר: 24/40 (60%).",
  combined:
    "סימולציה משולבת: 20 שאלות דין דיוני ועוד 20 שאלות דין מהותי. ללא הסברים במהלך הבחינה. ניקוד מעבר: 24/40 (60%).",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
