import { afterEach, describe, expect, it, vi } from "vitest";

import type { MasteryRow } from "@/lib/dashboard/types";
import {
  getKpiData,
  getMasteryByChapter,
  getStatusContext,
  getTrendData,
} from "@/lib/db/dashboard";

// =============================================================================
// Supabase mock — hand-rolled per `tests/exam-actions.test.ts` convention.
//
// Keys on table name; per-table payload becomes the awaited result. Chain
// methods (.select / .eq / .in / .order) are pass-throughs.
// =============================================================================

type AttemptRow = {
  question_type: "source" | "angle";
  is_correct: boolean | null;
  was_skipped: boolean;
  duration_seconds: number | null;
  mode: "practice" | "exam";
  attempted_at: string;
};

type MasteryAttemptRow = {
  question_type: "source" | "angle";
  is_correct: boolean | null;
  was_skipped: boolean;
  source_question_id: string | null;
  angle_question_id: string | null;
};

type ChapterRow = {
  id: string;
  code: string;
  title: string;
  display_order: number;
};

type SourceQuestionRow = { id: string; chapter_id: string };

type AngleQuestionRow = {
  id: string;
  source_question:
    | { chapter_id: string }
    | { chapter_id: string }[]
    | null;
};

type MockResponses = {
  // KPI side
  attempts?: AttemptRow[];
  exam_sessions?: Array<{ final_score: number | null }>;
  bookmarks?: { count: number };
  mistakes?: { count: number };
  // Mastery side — same `attempts` key reused; tests choose row shape.
  attemptsMastery?: MasteryAttemptRow[];
  chapters?: ChapterRow[];
  source_questions?: SourceQuestionRow[];
  angle_questions?: AngleQuestionRow[];
  // Status side — sequence of attempt-count head-query responses. Index
  // 0 = lifetime, index 1 = last-7-days (per `getStatusContext` call
  // order via Promise.all).
  attemptsCounts?: number[];
  // Trend side — attempts row shape for getTrendData (3 cols: attempted_at,
  // is_correct, was_skipped).
  attemptsTrend?: Array<{
    attempted_at: string;
    is_correct: boolean | null;
    was_skipped: boolean;
  }>;
};

function makeKpiMock(responses: MockResponses) {
  let attemptsCallIdx = 0;
  function chain(table: string) {
    // Capture the per-table call index NOW (synchronously), so each
    // chain remembers its own position regardless of when `await`
    // actually triggers `.then`.
    const callIdx = table === "attempts" ? attemptsCallIdx++ : 0;
    const ch: {
      select: () => typeof ch;
      eq: () => typeof ch;
      in: () => typeof ch;
      order: () => typeof ch;
      gte: () => typeof ch;
      lt: () => typeof ch;
      then: (resolve: (value: unknown) => void) => void;
    } = {
      select: () => ch,
      eq: () => ch,
      in: () => ch,
      order: () => ch,
      gte: () => ch,
      lt: () => ch,
      then: (resolve) => {
        if (table === "attempts") {
          // Four flavours of attempts response, in priority order:
          //   1. `attemptsCounts` — head-count sequence for getStatusContext
          //   2. `attemptsTrend` — trend-shaped rows for getTrendData
          //   3. `attemptsMastery` — mastery-shaped rows for getMasteryByChapter
          //   4. `attempts` — KPI-shaped rows for getKpiData
          if (responses.attemptsCounts !== undefined) {
            resolve({
              data: null,
              count: responses.attemptsCounts[callIdx] ?? 0,
              error: null,
            });
          } else if (responses.attemptsTrend !== undefined) {
            resolve({ data: responses.attemptsTrend, error: null });
          } else if (responses.attemptsMastery !== undefined) {
            resolve({ data: responses.attemptsMastery, error: null });
          } else {
            resolve({ data: responses.attempts ?? [], error: null });
          }
        } else if (table === "exam_sessions") {
          resolve({ data: responses.exam_sessions ?? [], error: null });
        } else if (table === "bookmarks") {
          resolve({
            data: null,
            count: responses.bookmarks?.count ?? 0,
            error: null,
          });
        } else if (table === "mistakes") {
          resolve({
            data: null,
            count: responses.mistakes?.count ?? 0,
            error: null,
          });
        } else if (table === "chapters") {
          resolve({ data: responses.chapters ?? [], error: null });
        } else if (table === "source_questions") {
          resolve({ data: responses.source_questions ?? [], error: null });
        } else if (table === "angle_questions") {
          resolve({ data: responses.angle_questions ?? [], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      },
    };
    return ch;
  }
  return {
    from: (table: string) => chain(table),
  };
}

// `getKpiData` accepts the SSR client type from `lib/supabase/server`; cast
// our mock through `unknown` since we only exercise the surface it actually
// uses (`.from(t).select().eq()` with `await`).
function asClient(mock: ReturnType<typeof makeKpiMock>) {
  return mock as unknown as Parameters<typeof getKpiData>[0];
}

// =============================================================================
// Tests
// =============================================================================

describe("getKpiData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates KPI values for a user with mixed practice/exam attempts", async () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const earlier = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const supabase = makeKpiMock({
      attempts: [
        // 3 practice source attempts: 2 correct, 1 wrong (durations 100, 120, 200)
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 100,
          mode: "practice",
          attempted_at: earlier.toISOString(),
        },
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 120,
          mode: "practice",
          attempted_at: earlier.toISOString(),
        },
        {
          question_type: "source",
          is_correct: false,
          was_skipped: false,
          duration_seconds: 200,
          mode: "practice",
          attempted_at: earlier.toISOString(),
        },
        // 1 practice angle skipped — counted in totals, excluded from accuracy + avg duration
        {
          question_type: "angle",
          is_correct: null,
          was_skipped: true,
          duration_seconds: null,
          mode: "practice",
          attempted_at: earlier.toISOString(),
        },
        // 2 exam angle attempts — counted in totals, excluded from avg practice duration
        {
          question_type: "angle",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 60,
          mode: "exam",
          attempted_at: earlier.toISOString(),
        },
        {
          question_type: "angle",
          is_correct: false,
          was_skipped: false,
          duration_seconds: 80,
          mode: "exam",
          attempted_at: earlier.toISOString(),
        },
      ],
      exam_sessions: [
        { final_score: 24 },
        { final_score: 30 },
      ],
      bookmarks: { count: 4 },
      mistakes: { count: 7 },
    });

    vi.useFakeTimers();
    vi.setSystemTime(now);
    const data = await getKpiData(asClient(supabase), "user-1");

    expect(data.totalAttempts).toBe(6);
    expect(data.sourceAttempts).toBe(3);
    expect(data.angleAttempts).toBe(3);
    // 3 correct (2 source + 1 exam-angle) out of 5 non-skipped attempts → 60%
    expect(data.accuracyLifetime).toBe(60);
    // Avg practice duration: (100+120+200) / 3 = 140 (excludes the skipped + the exam-mode attempts)
    expect(data.avgPracticeDurationSec).toBe(140);
    expect(data.examSessionsCompleted).toBe(2);
    expect(data.examAvgFinalScore).toBe(27);
    expect(data.bookmarksCount).toBe(4);
    expect(data.mistakesActiveCount).toBe(7);
    expect(data.dailyAccuracy).toHaveLength(7);
  });

  it("returns null for accuracyLifetime when all attempts are skipped", async () => {
    const supabase = makeKpiMock({
      attempts: [
        {
          question_type: "source",
          is_correct: null,
          was_skipped: true,
          duration_seconds: null,
          mode: "practice",
          attempted_at: new Date().toISOString(),
        },
        {
          question_type: "angle",
          is_correct: null,
          was_skipped: true,
          duration_seconds: null,
          mode: "practice",
          attempted_at: new Date().toISOString(),
        },
      ],
    });
    const data = await getKpiData(asClient(supabase), "user-1");
    expect(data.totalAttempts).toBe(2);
    expect(data.accuracyLifetime).toBeNull();
    expect(data.avgPracticeDurationSec).toBeNull();
  });

  it("returns 7-entry dailyAccuracy with nulls for days with 0 non-skipped attempts", async () => {
    // 2026-05-19T12:00Z = 2026-05-19 15:00 IDT (IL summer). Yesterday IL = 2026-05-18.
    // Buckets: 2026-05-12 .. 2026-05-18 (indices 0..6).
    const now = new Date("2026-05-19T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const supabase = makeKpiMock({
      attempts: [
        // 2 attempts on 2026-05-18 IL (bucket 6): 1 correct, 1 wrong → 50%
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 90,
          mode: "practice",
          attempted_at: "2026-05-18T10:00:00.000Z",
        },
        {
          question_type: "source",
          is_correct: false,
          was_skipped: false,
          duration_seconds: 90,
          mode: "practice",
          attempted_at: "2026-05-18T20:00:00.000Z",
        },
        // 1 attempt on 2026-05-15 IL (bucket 3): correct → 100%
        {
          question_type: "angle",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 60,
          mode: "practice",
          attempted_at: "2026-05-15T08:00:00.000Z",
        },
        // 1 attempt today (2026-05-19 IL) — outside the sparkline window, dropped silently
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 60,
          mode: "practice",
          attempted_at: "2026-05-19T11:30:00.000Z",
        },
      ],
    });
    const data = await getKpiData(asClient(supabase), "user-1");

    expect(data.dailyAccuracy).toHaveLength(7);
    expect(data.dailyAccuracy[0].date).toBe("2026-05-12");
    expect(data.dailyAccuracy[6].date).toBe("2026-05-18");

    expect(data.dailyAccuracy[6].accuracy).toBe(50);
    expect(data.dailyAccuracy[6].attempts).toBe(2);

    expect(data.dailyAccuracy[3].accuracy).toBe(100);
    expect(data.dailyAccuracy[3].attempts).toBe(1);

    for (const idx of [0, 1, 2, 4, 5]) {
      expect(data.dailyAccuracy[idx].accuracy).toBeNull();
      expect(data.dailyAccuracy[idx].attempts).toBe(0);
    }
  });

  it("returns examAvgFinalScore null when no completed sessions exist", async () => {
    const supabase = makeKpiMock({
      attempts: [
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          duration_seconds: 100,
          mode: "practice",
          attempted_at: new Date().toISOString(),
        },
      ],
      exam_sessions: [],
      bookmarks: { count: 0 },
      mistakes: { count: 0 },
    });
    const data = await getKpiData(asClient(supabase), "user-1");
    expect(data.examSessionsCompleted).toBe(0);
    expect(data.examAvgFinalScore).toBeNull();
    expect(data.bookmarksCount).toBe(0);
    expect(data.mistakesActiveCount).toBe(0);
  });
});

describe("getMasteryByChapter", () => {
  const chapters: ChapterRow[] = [
    { id: "ch-civil", code: "civil_proc", title: "סדר דין אזרחי", display_order: 1 },
    { id: "ch-crim", code: "criminal_proc", title: "סדר דין פלילי", display_order: 2 },
    { id: "ch-evid", code: "evidence", title: "דיני ראיות", display_order: 3 },
  ];

  it("returns one row per chapter in display_order, including chapters with zero attempts", async () => {
    const supabase = makeKpiMock({
      chapters,
      attemptsMastery: [
        // 4 attempts on civil_proc — 2 correct, 1 wrong, 1 skipped
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          source_question_id: "sq-1",
          angle_question_id: null,
        },
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          source_question_id: "sq-1",
          angle_question_id: null,
        },
        {
          question_type: "source",
          is_correct: false,
          was_skipped: false,
          source_question_id: "sq-2",
          angle_question_id: null,
        },
        {
          question_type: "source",
          is_correct: null,
          was_skipped: true,
          source_question_id: "sq-2",
          angle_question_id: null,
        },
        // 2 attempts on criminal_proc — 1 correct, 1 wrong
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          source_question_id: "sq-3",
          angle_question_id: null,
        },
        {
          question_type: "source",
          is_correct: false,
          was_skipped: false,
          source_question_id: "sq-3",
          angle_question_id: null,
        },
        // 0 attempts on evidence
      ],
      source_questions: [
        { id: "sq-1", chapter_id: "ch-civil" },
        { id: "sq-2", chapter_id: "ch-civil" },
        { id: "sq-3", chapter_id: "ch-crim" },
      ],
    });

    const rows = await getMasteryByChapter(asClient(supabase), "user-1");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.chapterCode)).toEqual([
      "civil_proc",
      "criminal_proc",
      "evidence",
    ]);

    expect(rows[0]).toMatchObject({
      chapterCode: "civil_proc",
      total: 4,
      skipped: 1,
      correct: 2,
      accuracy: 67, // 2/3 = 66.67 → 67
    });
    expect(rows[1]).toMatchObject({
      chapterCode: "criminal_proc",
      total: 2,
      skipped: 0,
      correct: 1,
      accuracy: 50,
    });
    expect(rows[2]).toMatchObject({
      chapterCode: "evidence",
      total: 0,
      skipped: 0,
      correct: 0,
      accuracy: null,
    });
  });

  it("resolves chapter through both source and angle question paths", async () => {
    const supabase = makeKpiMock({
      chapters,
      attemptsMastery: [
        // 1 source attempt on civil_proc
        {
          question_type: "source",
          is_correct: true,
          was_skipped: false,
          source_question_id: "sq-1",
          angle_question_id: null,
        },
        // 1 angle attempt whose parent source is in civil_proc
        {
          question_type: "angle",
          is_correct: false,
          was_skipped: false,
          source_question_id: null,
          angle_question_id: "aq-1",
        },
        // 1 angle attempt whose parent source is in criminal_proc
        {
          question_type: "angle",
          is_correct: true,
          was_skipped: false,
          source_question_id: null,
          angle_question_id: "aq-2",
        },
      ],
      source_questions: [{ id: "sq-1", chapter_id: "ch-civil" }],
      angle_questions: [
        { id: "aq-1", source_question: { chapter_id: "ch-civil" } },
        { id: "aq-2", source_question: { chapter_id: "ch-crim" } },
      ],
    });

    const rows = await getMasteryByChapter(asClient(supabase), "user-1");
    const byCode = Object.fromEntries(rows.map((r) => [r.chapterCode, r]));

    expect(byCode.civil_proc.total).toBe(2); // 1 source + 1 angle
    expect(byCode.civil_proc.correct).toBe(1);
    expect(byCode.civil_proc.accuracy).toBe(50);

    expect(byCode.criminal_proc.total).toBe(1);
    expect(byCode.criminal_proc.correct).toBe(1);
    expect(byCode.criminal_proc.accuracy).toBe(100);
  });

  it("returns accuracy: null when all chapter attempts are skipped", async () => {
    const supabase = makeKpiMock({
      chapters,
      attemptsMastery: [
        {
          question_type: "source",
          is_correct: null,
          was_skipped: true,
          source_question_id: "sq-1",
          angle_question_id: null,
        },
        {
          question_type: "source",
          is_correct: null,
          was_skipped: true,
          source_question_id: "sq-1",
          angle_question_id: null,
        },
      ],
      source_questions: [{ id: "sq-1", chapter_id: "ch-civil" }],
    });

    const rows = await getMasteryByChapter(asClient(supabase), "user-1");
    const civil = rows.find((r) => r.chapterCode === "civil_proc");
    expect(civil?.total).toBe(2);
    expect(civil?.skipped).toBe(2);
    expect(civil?.correct).toBe(0);
    expect(civil?.accuracy).toBeNull();
  });
});

describe("getStatusContext", () => {
  function masteryRow(
    code: string,
    title: string,
    correct: number,
    total: number,
    skipped = 0
  ): MasteryRow {
    const nonSkipped = total - skipped;
    return {
      chapterId: `id-${code}`,
      chapterCode: code,
      chapterTitle: title,
      correct,
      total,
      skipped,
      accuracy: nonSkipped > 0 ? Math.round((correct / nonSkipped) * 100) : null,
    };
  }

  it("returns on_track pill when lifetime >= 5 and last-7d >= 20", async () => {
    const mastery: MasteryRow[] = [
      masteryRow("civil_proc", "סדר דין אזרחי", 12, 58, 1),
      masteryRow("criminal_proc", "סדר דין פלילי", 13, 58, 3),
      masteryRow("execution", "הוצאה לפועל", 10, 51, 1), // 20% — lowest, focus pick
    ];
    const supabase = makeKpiMock({
      attemptsCounts: [188, 156],
    });
    const ctx = await getStatusContext(asClient(supabase), "user-1", mastery);
    expect(ctx.lifetimeAttempts).toBe(188);
    expect(ctx.attemptsLast7Days).toBe(156);
    expect(ctx.pill).toBe("on_track");
    expect(ctx.focus?.chapterCode).toBe("execution");
  });

  it("returns starting pill and focus=null for a user with 0 lifetime attempts", async () => {
    const mastery: MasteryRow[] = [
      masteryRow("civil_proc", "סדר דין אזרחי", 0, 0),
      masteryRow("criminal_proc", "סדר דין פלילי", 0, 0),
    ];
    const supabase = makeKpiMock({
      attemptsCounts: [0, 0],
    });
    const ctx = await getStatusContext(asClient(supabase), "user-1", mastery);
    expect(ctx.lifetimeAttempts).toBe(0);
    expect(ctx.attemptsLast7Days).toBe(0);
    expect(ctx.pill).toBe("starting");
    expect(ctx.focus).toBeNull();
  });
});

describe("getTrendData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 12 weekly buckets with accuracy nulled for weeks with <3 attempts", async () => {
    // 2026-05-19T12:00Z = 2026-05-19 15:00 IDT (Tuesday). Current week
    // (bucket 11) starts Sun 2026-05-17 IL; previous week (bucket 10)
    // starts Sun 2026-05-10 IL.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));

    const supabase = makeKpiMock({
      attemptsTrend: [
        // 4 attempts in current week (bucket 11), 2 correct → 50%
        {
          attempted_at: "2026-05-18T08:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
        {
          attempted_at: "2026-05-18T09:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
        {
          attempted_at: "2026-05-18T10:00:00.000Z",
          is_correct: false,
          was_skipped: false,
        },
        {
          attempted_at: "2026-05-18T11:00:00.000Z",
          is_correct: false,
          was_skipped: false,
        },
        // 2 attempts in previous week (bucket 10) — below the 3-attempt
        // threshold, accuracy must be null even though both are correct.
        {
          attempted_at: "2026-05-11T08:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
        {
          attempted_at: "2026-05-11T09:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
      ],
    });

    const data = await getTrendData(asClient(supabase), "user-1");
    expect(data.weeklyPoints).toHaveLength(12);

    expect(data.weeklyPoints[11].accuracy).toBe(50);
    expect(data.weeklyPoints[11].attempts).toBe(4);

    expect(data.weeklyPoints[10].accuracy).toBeNull();
    expect(data.weeklyPoints[10].attempts).toBe(2);

    for (let i = 0; i < 10; i++) {
      expect(data.weeklyPoints[i].accuracy).toBeNull();
      expect(data.weeklyPoints[i].attempts).toBe(0);
    }

    expect(data.personalHigh).toBe(50);
  });

  it("computes streakDays=0 when yesterday has no attempts but earlier days did", async () => {
    // 2026-05-19T12:00Z = Tue 2026-05-19 IL. Yesterday = Mon 2026-05-18.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));

    const supabase = makeKpiMock({
      attemptsTrend: [
        // Today (2026-05-19) — has attempts but doesn't extend the streak.
        {
          attempted_at: "2026-05-19T07:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
        // Yesterday is intentionally empty.
        // Sun 2026-05-17 + Sat 2026-05-16 — old chain, broken by empty
        // yesterday so streakDays must be 0.
        {
          attempted_at: "2026-05-17T09:00:00.000Z",
          is_correct: true,
          was_skipped: false,
        },
        {
          attempted_at: "2026-05-16T09:00:00.000Z",
          is_correct: false,
          was_skipped: false,
        },
      ],
    });

    const data = await getTrendData(asClient(supabase), "user-1");
    expect(data.streakDays).toBe(0);
  });
});
