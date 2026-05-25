import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dailyBuckets7IL,
  last12WeeksIL,
  last7DaysIL,
  nowIL,
  previousWeekIL,
  startOfDayIL,
} from "@/lib/dashboard/date-windows";
import { pickFocusChapter } from "@/lib/dashboard/focus-chapter";
import {
  MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL,
  MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK,
  evaluateStatus,
} from "@/lib/dashboard/on-track";

describe("evaluateStatus", () => {
  it("returns 'starting' below the lifetime threshold", () => {
    expect(evaluateStatus(0, 0)).toBe("starting");
    expect(evaluateStatus(4, 100)).toBe("starting");
  });

  it("returns 'on_track' when both lifetime and weekly thresholds are met", () => {
    expect(
      evaluateStatus(
        MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL,
        MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK
      )
    ).toBe("on_track");
    expect(evaluateStatus(184, 35)).toBe("on_track");
  });

  it("returns 'speed_up' when lifetime is met but weekly cadence is short", () => {
    expect(
      evaluateStatus(
        MIN_LIFETIME_ATTEMPTS_FOR_TRACK_EVAL,
        MIN_WEEKLY_ATTEMPTS_FOR_ON_TRACK - 1
      )
    ).toBe("speed_up");
    expect(evaluateStatus(50, 0)).toBe("speed_up");
  });

  it("treats the lifetime boundary correctly (4 → starting, 5 → evaluated)", () => {
    expect(evaluateStatus(4, 30)).toBe("starting");
    expect(evaluateStatus(5, 30)).toBe("on_track");
  });

  it("treats the weekly boundary correctly (19 → speed_up, 20 → on_track)", () => {
    expect(evaluateStatus(10, 19)).toBe("speed_up");
    expect(evaluateStatus(10, 20)).toBe("on_track");
  });
});

describe("pickFocusChapter", () => {
  function stat(
    code: string,
    correct: number,
    total: number,
    skipped = 0
  ): {
    chapterId: string;
    chapterCode: string;
    chapterTitle: string;
    correct: number;
    total: number;
    skipped: number;
  } {
    return {
      chapterId: `id-${code}`,
      chapterCode: code,
      chapterTitle: `כותרת-${code}`,
      correct,
      total,
      skipped,
    };
  }

  it("returns null when the user has zero lifetime non-skipped attempts", () => {
    expect(pickFocusChapter([])).toBeNull();
    expect(
      pickFocusChapter([
        stat("civil_proc", 0, 3, 3),
        stat("evidence", 0, 0),
      ])
    ).toBeNull();
  });

  it("ignores chapters below the 5-attempt threshold", () => {
    const result = pickFocusChapter([
      stat("civil_proc", 4, 4),
      stat("evidence", 3, 10, 0),
      stat("execution", 0, 6),
    ]);
    expect(result?.chapterCode).toBe("execution");
  });

  it("picks the eligible chapter with minimum accuracy", () => {
    const result = pickFocusChapter([
      stat("civil_proc", 8, 10),
      stat("evidence", 3, 10),
      stat("criminal_proc", 6, 10),
      stat("execution", 5, 10),
    ]);
    expect(result?.chapterCode).toBe("evidence");
  });

  it("falls back to the named code when no chapter has ≥5 non-skipped attempts", () => {
    const result = pickFocusChapter(
      [
        stat("civil_proc", 2, 4),
        stat("evidence", 1, 3),
        stat("execution", 0, 0),
      ],
      "civil_proc"
    );
    expect(result?.chapterCode).toBe("civil_proc");
  });
});

describe("date-windows", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("last7DaysIL / previousWeekIL produce adjacent rolling windows at an IL-walltime boundary", () => {
    // 2026-02-15T12:00Z = 2026-02-15 14:00 IL (standard time, no DST).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    const now = nowIL();
    // IL-walltime convention: UTC fields hold IL parts.
    expect(now.getUTCFullYear()).toBe(2026);
    expect(now.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(now.getUTCDate()).toBe(15);
    expect(now.getUTCHours()).toBe(14);

    const last7 = last7DaysIL(now);
    expect(last7.end.toISOString()).toBe(now.toISOString());
    expect(last7.start.toISOString()).toBe("2026-02-08T14:00:00.000Z");

    const prev = previousWeekIL(now);
    expect(prev.end.toISOString()).toBe(last7.start.toISOString());
    expect(prev.start.toISOString()).toBe("2026-02-01T14:00:00.000Z");
  });

  it("startOfDayIL / last12WeeksIL / dailyBuckets7IL produce stable boundaries", () => {
    // Same fixed instant: 2026-02-15T12:00Z = Sun 2026-02-15 14:00 IL.
    // The IL Sunday-of-week containing this moment IS 2026-02-15 itself
    // (Sunday), so the current week's bucket start is 2026-02-15.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T12:00:00.000Z"));

    const now = nowIL();

    // startOfDayIL zeroes hh:mm:ss on the IL-walltime Date.
    const sod = startOfDayIL(now);
    expect(sod.getUTCFullYear()).toBe(2026);
    expect(sod.getUTCMonth()).toBe(1);
    expect(sod.getUTCDate()).toBe(15);
    expect(sod.getUTCHours()).toBe(0);
    expect(sod.getUTCMinutes()).toBe(0);
    expect(sod.getUTCSeconds()).toBe(0);

    // last12WeeksIL returns 13 boundaries (12 buckets + half-open
    // sentinel). Current week's Sunday is 2026-02-15; the oldest
    // bucket starts 11 weeks earlier on 2025-11-30.
    const weeks = last12WeeksIL(now);
    expect(weeks.weekBoundaries).toHaveLength(13);
    expect(weeks.weekBoundaries[0].toISOString()).toBe(
      "2025-11-30T00:00:00.000Z"
    );
    expect(weeks.weekBoundaries[11].toISOString()).toBe(
      "2026-02-15T00:00:00.000Z"
    );
    expect(weeks.weekBoundaries[12].toISOString()).toBe(
      "2026-02-22T00:00:00.000Z"
    );
    expect(weeks.start.toISOString()).toBe(
      weeks.weekBoundaries[0].toISOString()
    );
    expect(weeks.end.toISOString()).toBe(
      weeks.weekBoundaries[12].toISOString()
    );

    // dailyBuckets7IL returns 7 day-boundary Dates ending YESTERDAY
    // (today excluded — sparkline window per plan §2.7).
    const days = dailyBuckets7IL(now);
    expect(days).toHaveLength(7);
    expect(days[6].toISOString()).toBe("2026-02-14T00:00:00.000Z"); // yesterday
    expect(days[0].toISOString()).toBe("2026-02-08T00:00:00.000Z"); // yesterday-6
  });
});
