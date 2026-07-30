"use strict";

// Ported from lib/db/dashboard.ts. Read-only analytics aggregates for the
// user dashboard. Every helper takes the RLS-scoped client + userId; RLS
// is defense-in-depth (the routes are auth + subscription gated).
//
// Read failures return empty/zero/null values rather than throwing — a
// transient failure should render empty state, not crash the dashboard.

const {
  nowIL,
  startOfDayIL,
  last12WeeksIL,
  dailyBuckets7IL,
} = require("../lib/dashboard/date-windows");
const { pickFocusChapter } = require("../lib/dashboard/focus-chapter");
const { evaluateStatus } = require("../lib/dashboard/on-track");

// =============================================================================
// Internal helpers
// =============================================================================

const IL_TZ = "Asia/Jerusalem";

const IL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: IL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for the IL calendar day containing `instant`. */
function ilDateStringOf(instant) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return IL_DATE_FORMATTER.format(d);
}

/** YYYY-MM-DD for an IL-walltime Date (UTC fields hold IL parts). */
function bucketDateString(bucket) {
  const y = bucket.getUTCFullYear();
  const m = String(bucket.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bucket.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Same as bucketDateString — kept under the source's name for parity. */
function ilWalltimeDateString(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function accuracy(correct, nonSkipped) {
  if (nonSkipped <= 0) return null;
  return Math.round((correct / nonSkipped) * 100);
}

function accuracyInWindow(attempts, from, to) {
  let correct = 0;
  let nonSkipped = 0;
  for (const a of attempts) {
    const t = Date.parse(a.attempted_at);
    if (Number.isNaN(t)) continue;
    if (t < from || t >= to) continue;
    if (a.was_skipped) continue;
    nonSkipped++;
    if (a.is_correct === true) correct++;
  }
  return accuracy(correct, nonSkipped);
}

function buildDailySparkline(attempts) {
  const buckets = dailyBuckets7IL();
  const out = [];

  const byDay = new Map();
  for (const a of attempts) {
    const key = ilDateStringOf(a.attempted_at);
    const t = byDay.get(key) || { correct: 0, nonSkipped: 0, total: 0 };
    t.total++;
    if (!a.was_skipped) {
      t.nonSkipped++;
      if (a.is_correct === true) t.correct++;
    }
    byDay.set(key, t);
  }

  for (const bucket of buckets) {
    const key = bucketDateString(bucket);
    const tally = byDay.get(key);
    out.push({
      date: key,
      accuracy: tally ? accuracy(tally.correct, tally.nonSkipped) : null,
      attempts: tally ? tally.total : 0,
    });
  }
  return out;
}

// =============================================================================
// KPIs
// =============================================================================

async function getKpiData(supabase, userId) {
  const [attemptsRes, examsRes, bookmarksRes, mistakesRes] = await Promise.all([
    supabase
      .from("attempts")
      .select(
        "question_type, is_correct, was_skipped, duration_seconds, mode, attempted_at"
      )
      .eq("user_id", userId),
    supabase
      .from("exam_sessions")
      .select("final_score")
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("mistakes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("manually_removed", false),
  ]);

  const rawAttempts = attemptsRes.data || [];
  const attempts = [];
  for (const r of rawAttempts) {
    if (r.question_type !== "source" && r.question_type !== "angle") continue;
    if (r.mode !== "practice" && r.mode !== "exam") continue;
    attempts.push({
      question_type: r.question_type,
      is_correct: r.is_correct,
      was_skipped: r.was_skipped,
      duration_seconds: r.duration_seconds,
      mode: r.mode,
      attempted_at: r.attempted_at,
    });
  }

  // KPI 1 — counts
  let sourceAttempts = 0;
  let angleAttempts = 0;
  let lifetimeCorrect = 0;
  let lifetimeNonSkipped = 0;
  let practiceDurationSum = 0;
  let practiceDurationCount = 0;
  for (const a of attempts) {
    if (a.question_type === "source") sourceAttempts++;
    else angleAttempts++;
    if (!a.was_skipped) {
      lifetimeNonSkipped++;
      if (a.is_correct === true) lifetimeCorrect++;
    }
    if (
      a.mode === "practice" &&
      !a.was_skipped &&
      a.duration_seconds !== null &&
      a.duration_seconds !== undefined
    ) {
      practiceDurationSum += a.duration_seconds;
      practiceDurationCount++;
    }
  }
  const totalAttempts = sourceAttempts + angleAttempts;
  const accuracyLifetime = accuracy(lifetimeCorrect, lifetimeNonSkipped);

  // KPI 2 — rolling 7d / previous 7d
  const nowMs = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const accuracyLast7Days = accuracyInWindow(attempts, nowMs - sevenDays, nowMs);

  let prevWindowAttempts = 0;
  for (const a of attempts) {
    const t = Date.parse(a.attempted_at);
    if (Number.isNaN(t)) continue;
    if (t >= nowMs - 2 * sevenDays && t < nowMs - sevenDays) {
      prevWindowAttempts++;
    }
  }
  const accuracyPrevious7Days =
    prevWindowAttempts === 0
      ? null
      : accuracyInWindow(attempts, nowMs - 2 * sevenDays, nowMs - sevenDays);

  const dailyAccuracy = buildDailySparkline(attempts);

  // Weekly bucketed attempts (all-mode + exam-only) for the stat-card
  // sparklines. Reuses the 12-week IL boundaries used by getTrendData.
  const { weekBoundaries: kpiWeekBoundaries } = last12WeeksIL();
  const weekStartStr = kpiWeekBoundaries.map(ilWalltimeDateString);
  const weeklyAttempts = new Array(12).fill(0);
  const weeklyExamAttempts = new Array(12).fill(0);
  let mistakesAddedLast7Days = 0;
  for (const a of attempts) {
    const t = Date.parse(a.attempted_at);
    if (Number.isNaN(t)) continue;
    if (
      a.mode === "practice" &&
      !a.was_skipped &&
      a.is_correct === false &&
      t >= nowMs - sevenDays
    ) {
      mistakesAddedLast7Days++;
    }
    const ilDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(a.attempted_at));
    for (let i = 0; i < 12; i++) {
      if (ilDate >= weekStartStr[i] && ilDate < weekStartStr[i + 1]) {
        weeklyAttempts[i]++;
        if (a.mode === "exam") weeklyExamAttempts[i]++;
        break;
      }
    }
  }

  // KPI 3 — avg practice duration
  const avgPracticeDurationSec =
    practiceDurationCount > 0
      ? Math.round((practiceDurationSum / practiceDurationCount) * 10) / 10
      : null;

  // KPI 4 — completed exams + avg score
  const examRows = examsRes.data || [];
  const examSessionsCompleted = examRows.length;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const r of examRows) {
    if (typeof r.final_score === "number") {
      scoreSum += r.final_score;
      scoreCount++;
    }
  }
  const examAvgFinalScore =
    scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null;

  // KPI 5 / 6 — counts
  const bookmarksCount = bookmarksRes.count || 0;
  const mistakesActiveCount = mistakesRes.count || 0;

  return {
    totalAttempts,
    sourceAttempts,
    angleAttempts,
    accuracyLifetime,
    accuracyLast7Days,
    accuracyPrevious7Days,
    dailyAccuracy,
    avgPracticeDurationSec,
    examSessionsCompleted,
    examAvgFinalScore,
    bookmarksCount,
    mistakesActiveCount,
    weeklyAttempts,
    weeklyExamAttempts,
    mistakesAddedLast7Days,
  };
}

// =============================================================================
// Mastery by chapter
// =============================================================================

async function getMasteryByChapter(supabase, userId) {
  const [chaptersRes, attemptsRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, display_order, track")
      .order("display_order", { ascending: true }),
    supabase
      .from("attempts")
      .select(
        "question_type, is_correct, was_skipped, source_question_id, angle_question_id"
      )
      .eq("user_id", userId),
  ]);

  const chapters = chaptersRes.data || [];
  const rawAttempts = attemptsRes.data || [];

  const sourceIds = new Set();
  const angleIds = new Set();
  for (const a of rawAttempts) {
    if (a.question_type === "source" && a.source_question_id) {
      sourceIds.add(a.source_question_id);
    } else if (a.question_type === "angle" && a.angle_question_id) {
      angleIds.add(a.angle_question_id);
    }
  }

  const srcToChapter = new Map();
  const angleToChapter = new Map();

  const lookups = [];
  if (sourceIds.size > 0) {
    lookups.push(
      (async () => {
        const { data } = await supabase
          .from("source_questions")
          .select("id, chapter_id")
          .in("id", Array.from(sourceIds));
        for (const row of data || []) {
          srcToChapter.set(row.id, row.chapter_id);
        }
      })()
    );
  }
  if (angleIds.size > 0) {
    lookups.push(
      (async () => {
        const { data } = await supabase
          .from("angle_questions")
          .select(
            "id, source_question:source_questions!angle_questions_source_question_id_fkey(chapter_id)"
          )
          .in("id", Array.from(angleIds));
        for (const row of data || []) {
          const parent = Array.isArray(row.source_question)
            ? row.source_question[0]
            : row.source_question;
          if (parent && parent.chapter_id) {
            angleToChapter.set(row.id, parent.chapter_id);
          }
        }
      })()
    );
  }
  await Promise.all(lookups);

  const tallies = new Map();
  for (const c of chapters) {
    tallies.set(c.id, { total: 0, skipped: 0, correct: 0 });
  }

  for (const a of rawAttempts) {
    let chapterId = null;
    if (a.question_type === "source" && a.source_question_id) {
      chapterId = srcToChapter.get(a.source_question_id) || null;
    } else if (a.question_type === "angle" && a.angle_question_id) {
      chapterId = angleToChapter.get(a.angle_question_id) || null;
    }
    if (!chapterId) continue;
    const tally = tallies.get(chapterId);
    if (!tally) continue;
    tally.total++;
    if (a.was_skipped) tally.skipped++;
    else if (a.is_correct === true) tally.correct++;
  }

  return chapters.map((c) => {
    const tally = tallies.get(c.id) || { total: 0, skipped: 0, correct: 0 };
    const nonSkipped = tally.total - tally.skipped;
    const acc =
      nonSkipped > 0 ? Math.round((tally.correct / nonSkipped) * 100) : null;
    return {
      chapterId: c.id,
      chapterCode: c.code,
      chapterTitle: c.title,
      track: c.track,
      total: tally.total,
      skipped: tally.skipped,
      correct: tally.correct,
      accuracy: acc,
    };
  });
}

// =============================================================================
// Status context (header strip)
// =============================================================================

async function getStatusContext(supabase, userId, mastery) {
  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [lifetimeRes, last7Res] = await Promise.all([
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("attempted_at", sevenDaysAgoIso),
  ]);

  const lifetimeAttempts = lifetimeRes.count || 0;
  const attemptsLast7Days = last7Res.count || 0;

  return {
    lifetimeAttempts,
    attemptsLast7Days,
    pill: evaluateStatus(lifetimeAttempts, attemptsLast7Days),
    focus: pickFocusChapter(mastery, "civil_proc"),
  };
}

// =============================================================================
// Trend + streak
// =============================================================================

const TREND_MIN_ATTEMPTS_PER_WEEK = 3;
const STREAK_WALKBACK_MAX_DAYS = 30;

async function getTrendData(supabase, userId) {
  const now = nowIL();
  const { weekBoundaries } = last12WeeksIL(now);

  // Widen the query window by 1 day each side to cover the IL-walltime
  // span regardless of IL↔UTC offset, then re-filter in JS by IL date.
  const lowerIso = new Date(
    weekBoundaries[0].getTime() - 24 * 60 * 60 * 1000
  ).toISOString();
  const upperIso = new Date(
    weekBoundaries[12].getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const attemptsRes = await supabase
    .from("attempts")
    .select("attempted_at, is_correct, was_skipped")
    .eq("user_id", userId)
    .gte("attempted_at", lowerIso)
    .lt("attempted_at", upperIso);

  const attempts = attemptsRes.data || [];

  const bucketStartStr = weekBoundaries.map(ilWalltimeDateString);

  const tallies = Array.from({ length: 12 }, () => ({
    correct: 0,
    nonSkipped: 0,
    total: 0,
  }));

  const ilDaysActive = new Set();

  for (const a of attempts) {
    const ilDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(a.attempted_at));
    ilDaysActive.add(ilDate);
    let bucketIdx = -1;
    for (let i = 0; i < 12; i++) {
      if (ilDate >= bucketStartStr[i] && ilDate < bucketStartStr[i + 1]) {
        bucketIdx = i;
        break;
      }
    }
    if (bucketIdx < 0) continue;
    const t = tallies[bucketIdx];
    t.total++;
    if (!a.was_skipped) {
      t.nonSkipped++;
      if (a.is_correct === true) t.correct++;
    }
  }

  const weeklyPoints = tallies.map((t, i) => ({
    weekStartISO: bucketStartStr[i],
    accuracy:
      t.nonSkipped >= TREND_MIN_ATTEMPTS_PER_WEEK
        ? Math.round((t.correct / t.nonSkipped) * 1000) / 10
        : null,
    attempts: t.total,
  }));

  let personalHigh = null;
  for (const p of weeklyPoints) {
    if (p.accuracy === null) continue;
    if (personalHigh === null || p.accuracy > personalHigh) {
      personalHigh = p.accuracy;
    }
  }

  // Streak: walk back from yesterday IL. Today doesn't count.
  const todayStart = startOfDayIL(now);
  const cursor = new Date(todayStart);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streakDays = 0;
  for (let i = 0; i < STREAK_WALKBACK_MAX_DAYS; i++) {
    const cursorStr = ilWalltimeDateString(cursor);
    if (!ilDaysActive.has(cursorStr)) break;
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { weeklyPoints, personalHigh, streakDays };
}

// =============================================================================
// Hero — resume from last session
// =============================================================================

const HERO_STALE_SESSION_MS = 24 * 60 * 60 * 1000;

async function getHeroLastSession(supabase, userId) {
  const { data } = await supabase
    .from("practice_sessions")
    .select(
      "id, last_activity_at, questions_answered, question_list, selected_chapters"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const lastActivityMs = new Date(data.last_activity_at).getTime();
  if (Date.now() - lastActivityMs > HERO_STALE_SESSION_MS) return null;

  const totalQuestions = Array.isArray(data.question_list)
    ? data.question_list.length
    : 0;
  const answered =
    typeof data.questions_answered === "number" ? data.questions_answered : 0;
  const nextQuestionPosition = Math.min(
    answered + 1,
    Math.max(totalQuestions, 1)
  );

  let chapterTitle = null;
  const selected = Array.isArray(data.selected_chapters)
    ? data.selected_chapters
    : [];
  if (selected.length > 0) {
    const { data: chapterRow } = await supabase
      .from("chapters")
      .select("title")
      .eq("id", selected[0])
      .maybeSingle();
    chapterTitle = (chapterRow && chapterRow.title) || null;
  }

  return {
    sessionId: data.id,
    nextQuestionPosition,
    totalQuestions,
    lastActivityISO: data.last_activity_at,
    chapterTitle,
  };
}

module.exports = {
  getKpiData,
  getMasteryByChapter,
  getStatusContext,
  getTrendData,
  getHeroLastSession,
};
