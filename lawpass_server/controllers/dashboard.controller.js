"use strict";

// Ported from the dashboard read helpers (lib/db/dashboard.ts, consumed
// by the (app)/dashboard Server Components). All read-only + subscription
// gated. The React `cache()` wrappers in the source dedupe per request;
// here each HTTP request is independent, so the header-strip endpoint
// fetches mastery then derives status in the same handler (mirroring
// header-strip-async.tsx, which called getMasteryByChapter then
// getStatusContext(userId, mastery)).

const db = require("../db/dashboard");

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

module.exports = { kpi, mastery, status, trend, hero };
