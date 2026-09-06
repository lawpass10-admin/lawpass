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

module.exports = { kpi, mastery, status, trend, hero, subjectStats, topicStats };
