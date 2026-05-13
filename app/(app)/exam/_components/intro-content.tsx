import { Clock } from "lucide-react";

/**
 * Presentational shell for the exam intro screen. Renders the hero,
 * stat grid, cluster breakdown, and "before you start" info card —
 * everything EXCEPT the action footer (CTAs / dialog). Shared by
 * <ExamIntro> and the background of <ResumePrompt> so the two flows
 * never diverge visually.
 *
 * No client interaction lives here, so the component is server-safe.
 * The matching client components ("use client") import it and append
 * their own footer.
 *
 * Visual mapping from the PM-supplied prototype:
 *   - `--gold`        → amber-* utilities (matches Slice 2 conventions)
 *   - `--ink`         → bg-primary (already a near-black token in
 *                       light mode: oklch(0.205 0 0))
 *   - `--bg-warm`     → bg-amber-50 + border-amber-200/60
 *   - `--gold-soft`   → border-amber-300/60
 *
 * Final design tokens land in the post-Slice-2 Design Alignment pass;
 * for now the amber palette stays consistent with the practice setup
 * form's `border-amber-500/40 bg-amber-500/5` warm card.
 */
export function IntroContent() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      <header className="space-y-3 text-center">
        {/* Hero square: dark/ink background, gold clock icon */}
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl bg-primary text-amber-400">
          <Clock className="size-8" aria-hidden />
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          סימולציית בחינה
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          40 שאלות. 100 דקות.
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          סימולציה נאמנה למבנה בחינת הלשכה. ללא הסברים במהלך הבחינה. ניקוד מעבר:
          {" "}
          24/40 (60%).
        </p>
      </header>

      {/* 4 stat cards — 2x2 on mobile, 1x4 on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="שאלות" value="40" sub="ארבע אפשרויות" />
        <StatCard label="זמן" value="100" sub="דקות סה״כ" />
        <StatCard label="סף מעבר" value="60%" sub="24 שאלות" />
        <StatCard label="ניקוד שלילי" value="אין" sub="כמו בבחינה" />
      </div>

      {/* Cluster breakdown */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">חלוקה לפי אשכולות</h2>
        <ul className="space-y-3">
          {CLUSTER_ROWS.map((row) => (
            <li
              key={row.code}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-foreground/85">{row.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {row.questions} שאלות · {row.percent}%
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-44"
                aria-hidden
              >
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

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

// ---------------------------------------------------------------------------
// Small bits
// ---------------------------------------------------------------------------

const CLUSTER_ROWS = [
  {
    code: "א",
    name: "אשכול א׳ — סדר דין אזרחי, אתיקה, עבודה",
    questions: 14,
    percent: 35,
  },
  {
    code: "ב",
    name: "אשכול ב׳ — סדר דין פלילי, ראיות, חוקתי",
    questions: 11,
    percent: 27.5,
  },
  {
    code: "ג",
    name: "אשכול ג׳ — דין מהותי",
    questions: 13,
    percent: 32.5,
  },
] as const;

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
