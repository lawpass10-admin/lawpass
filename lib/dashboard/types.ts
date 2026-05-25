/**
 * Slice 4 — Dashboard analytics shared types. Pure, server/client-agnostic.
 *
 * Empty-state convention (plan §2.2 + §3 Phase 1):
 *   - Count-like fields (`*Count`, `*Attempts`, `examSessionsCompleted`) use
 *     `number` with `0` as the zero value. The card renders "—" when 0 —
 *     null is not needed for these.
 *   - Derived-ratio fields (accuracy %, avg duration, avg score) use
 *     `number | null`. `null` means "not enough data to compute"; the UI
 *     renders "—" and hides the visual.
 */

/**
 * One day of the 7-day accuracy sparkline (KPI 2 — אחוז הצלחה).
 * `date` is an ISO date string in Israel-local time (`YYYY-MM-DD`).
 * `accuracy` is null when the day had zero non-skipped attempts (the
 * sparkline skips that point and connects neighbors).
 */
export type SparklinePoint = {
  date: string;
  accuracy: number | null;
  attempts: number;
};

/**
 * One weekly bucket of the 12-week trend chart (Phase 4).
 * `weekStartISO` is the IL-local Sunday that starts the bucket.
 * `accuracy` is null when the bucket has <3 attempts (plan §2.4 — line
 * connects remaining points; chart skips the dot).
 */
export type TrendPoint = {
  weekStartISO: string;
  accuracy: number | null;
  attempts: number;
};

export type TrendData = {
  weeklyPoints: TrendPoint[];
  personalHigh: number | null;
  streakDays: number;
};

/**
 * Per-chapter mastery row (Phase 2). `accuracy` is null on 0 non-skipped
 * attempts — the row then renders "—" + "תרגל" CTA without a bar.
 */
export type MasteryRow = {
  chapterId: string;
  chapterCode: string;
  chapterTitle: string;
  correct: number;
  total: number;
  skipped: number;
  accuracy: number | null;
};

/**
 * KPI card payload (Phase 1). One field per card in plan §2.7, plus
 * the source/angle subcounts that drive KPI 1's stacked bar and the
 * WoW pair + sparkline that drive KPI 2's delta + sparkline.
 *
 * Accuracy fields are percentages (0..100), not ratios.
 */
export type KpiData = {
  // KPI 1 — שאלות שתורגלו
  totalAttempts: number;
  sourceAttempts: number;
  angleAttempts: number;
  // KPI 2 — אחוז הצלחה
  accuracyLifetime: number | null;
  accuracyLast7Days: number | null;
  accuracyPrevious7Days: number | null;
  dailyAccuracy: SparklinePoint[];
  // KPI 3 — זמן ממוצע לשאלה (practice only)
  avgPracticeDurationSec: number | null;
  // KPI 4 — סימולציות
  examSessionsCompleted: number;
  examAvgFinalScore: number | null;
  // KPI 5 / 6 — counts (zero is real, not null)
  bookmarksCount: number;
  mistakesActiveCount: number;
  // Phase 12 — sparkline + trend-pill inputs.
  // `weeklyAttempts` / `weeklyExamAttempts` are 12 weekly bucket counts
  // (oldest → newest, IL-week aligned) — the renderer picks the
  // trailing 8 for the 80×28 sparkline path.
  // `mistakesAddedLast7Days` counts non-skipped, incorrect practice
  // attempts in the last rolling 7 days — feeds the "+ N השבוע" pill.
  weeklyAttempts: number[];
  weeklyExamAttempts: number[];
  mistakesAddedLast7Days: number;
};

export type StatusPillState = "starting" | "on_track" | "speed_up";

/**
 * Focus chapter recommendation (Phase 3). `null` means "hide the
 * focus line entirely" (user has 0 lifetime attempts, or the fallback
 * chapter is also missing).
 */
export type FocusChapter = {
  chapterId: string;
  chapterCode: string;
  chapterTitle: string;
} | null;

export type StatusContext = {
  lifetimeAttempts: number;
  attemptsLast7Days: number;
  pill: StatusPillState;
  focus: FocusChapter;
};

/**
 * Hero card "resume from last session" payload (Slice 4.X Phase 11).
 * `null` when the user has no active (non-stale) practice session — the
 * hero card then renders without the resume CTA + meta line.
 *
 * `nextQuestionPosition` is the 1-based index of the next unanswered
 * question (so "המשך מהשאלה ה-N" reads correctly in Hebrew). The
 * resume URL itself uses zero-based `questions_answered`.
 */
export type HeroLastSession = {
  sessionId: string;
  nextQuestionPosition: number;
  totalQuestions: number;
  lastActivityISO: string;
  chapterTitle: string | null;
} | null;
