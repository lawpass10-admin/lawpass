"use strict";

// Ported from the dashboard read helpers (lib/db/dashboard.ts, consumed
// by the (app)/dashboard Server Components). All read-only + subscription
// gated. The React `cache()` wrappers in the source dedupe per request;
// here each HTTP request is independent, so the header-strip endpoint
// fetches mastery then derives status in the same handler (mirroring
// header-strip-async.tsx, which called getMasteryByChapter then
// getStatusContext(userId, mastery)).

const db = require("../db/dashboard");
const subjectStatsDb = require("../db/subject-stats");
const { adminClient } = require("../config/supabase");

async function kpi(req, res) {
  const data = await db.getKpiData(req.supabase, req.user.id);
  return res.json({ ok: true, kpi: data });
}

async function mastery(req, res) {
  const data = await db.getMasteryByChapter(req.supabase, req.user.id);
  return res.json({ ok: true, mastery: data });
}

async function status(req, res) {
  const masteryRows = await db.getMasteryByChapter(req.supabase, req.user.id);
  const data = await db.getStatusContext(req.supabase, req.user.id, masteryRows);
  return res.json({ ok: true, status: data });
}

async function trend(req, res) {
  const data = await db.getTrendData(req.supabase, req.user.id);
  return res.json({ ok: true, trend: data });
}

async function hero(req, res) {
  const data = await db.getHeroLastSession(req.supabase, req.user.id);
  return res.json({ ok: true, hero: data });
}

/**
 * The three subject squares at the top of the personal dashboard.
 *
 * Read with req.supabase — the caller's own RLS-scoped client — so the rows
 * are restricted to their owner by the database rather than by this handler.
 */
async function subjectStats(req, res) {
  const subjects = await subjectStatsDb.getSubjectStats(req.supabase, req.user.id);
  return res.json({ ok: true, subjects });
}

/**
 * Per-law aggregates behind the two charts under each dashboard tab.
 * Same RLS-scoped client as the cards above it.
 */
async function topicStats(req, res) {
  const topics = await subjectStatsDb.getTopicStats(req.supabase, adminClient(), req.user.id);
  return res.json({ ok: true, topics });
}

/**
 * Everything the dashboard's four analytic surfaces need, in ONE request.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * The page used to fetch /mastery, /status, /subject-stats and /topic-stats
 * separately. Usage shows them with identical hit counts, because they are
 * always called together — one dashboard render was four HTTP round trips and
 * four JWT verifications for one screen.
 *
 * Worse, two of them overlapped: /status computes the mastery aggregate for
 * itself, so every dashboard load ran that query TWICE. Here it runs once and
 * is handed to getStatusContext, which is the single biggest saving in this
 * file and the thing the split endpoints could not express.
 *
 * ── The shape of the work ──────────────────────────────────────────────────
 * Mastery, subject-stats and topic-stats touch unrelated tables and start
 * together. Status is the only one that cannot: it is a function OF mastery,
 * so it waits for that one and then adds two cheap count queries of its own.
 *
 * ── What the caller keeps ──────────────────────────────────────────────────
 * The payload is nested exactly as the four endpoints returned it
 * (`mastery`, `status`, `subjects`, `topics`), so the frontend reads the same
 * fields it always did and only the number of requests changes. The four
 * single-surface endpoints stay mounted and unchanged — they are the fallback
 * if this one ever needs backing out, and nothing is saved by deleting them.
 */
async function overview(req, res) {
  const supabase = req.supabase;
  const userId = req.user.id;

  const [masteryRows, subjects, topics] = await Promise.all([
    db.getMasteryByChapter(supabase, userId),
    subjectStatsDb.getSubjectStats(supabase, userId),
    subjectStatsDb.getTopicStats(supabase, adminClient(), userId),
  ]);

  // Not in the Promise.all above: it needs `masteryRows` as an argument, and
  // starting it earlier would mean computing mastery a second time to feed it
  // — which is the exact waste this endpoint exists to remove.
  const status = await db.getStatusContext(supabase, userId, masteryRows);

  return res.json({
    ok: true,
    mastery: masteryRows,
    status,
    subjects,
    topics,
  });
}

module.exports = {
  kpi,
  mastery,
  status,
  trend,
  hero,
  subjectStats,
  topicStats,
  overview,
};
