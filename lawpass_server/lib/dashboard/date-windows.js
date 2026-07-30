"use strict";

// Ported from lib/dashboard/date-windows.ts. Israel-aware date windows
// for the dashboard aggregates.
//
// Convention: a "Date" returned here is an Israel-walltime instant — its
// UTC fields hold IL year/month/day/hour/minute/second. Always read parts
// via the getUTC* accessors so the server's local timezone doesn't bleed
// in. DST is sidestepped: we operate on IL walltime throughout.
//
// Only the helpers used by db/dashboard.js are ported (nowIL,
// startOfDayIL, last12WeeksIL, dailyBuckets7IL, + the internal
// startOfWeekSunIL). last7DaysIL/previousWeekIL from the source weren't
// used server-side — the aggregates compute those windows inline.

const IL_TZ = "Asia/Jerusalem";

const il24hFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function ilPartsOf(instant) {
  const parts = {};
  for (const p of il24hFormatter.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  // en-CA + hour12:false renders midnight as "24" in some runtimes.
  const hourStr = parts.hour === "24" ? "00" : parts.hour;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(hourStr),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function ilDate(parts) {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    )
  );
}

/** Current moment as an IL-walltime Date (UTC fields = IL parts). */
function nowIL() {
  return ilDate(ilPartsOf(new Date()));
}

/** Zero the h/m/s of an IL-walltime Date → start of that IL calendar day. */
function startOfDayIL(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}

/**
 * The Sunday that starts the week containing `d`. Israel weeks run
 * Sunday–Saturday, so Sunday is weekday 0 from getUTCDay() on an
 * IL-walltime Date.
 */
function startOfWeekSunIL(d) {
  const start = startOfDayIL(d);
  const dow = start.getUTCDay(); // 0 = Sunday
  start.setUTCDate(start.getUTCDate() - dow);
  return start;
}

/**
 * 12 Sunday–Saturday week buckets ending the current calendar week.
 * Returns { start, end, weekBoundaries }: weekBoundaries has 13 entries;
 * bucket i spans [weekBoundaries[i], weekBoundaries[i+1]).
 */
function last12WeeksIL(now = nowIL()) {
  const currentWeekStart = startOfWeekSunIL(now);
  const boundaries = [];
  for (let i = 11; i >= 0; i--) {
    const b = new Date(currentWeekStart);
    b.setUTCDate(b.getUTCDate() - i * 7);
    boundaries.push(b);
  }
  const endExclusive = new Date(currentWeekStart);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
  boundaries.push(endExclusive);
  return { start: boundaries[0], end: endExclusive, weekBoundaries: boundaries };
}

/**
 * 7 IL-day-boundary Dates ending YESTERDAY (today doesn't count yet for
 * the sparkline). Index 0 is the oldest day; index 6 is yesterday.
 */
function dailyBuckets7IL(now = nowIL()) {
  const yesterday = startOfDayIL(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(yesterday);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d);
  }
  return out;
}

module.exports = {
  nowIL,
  startOfDayIL,
  last12WeeksIL,
  dailyBuckets7IL,
};
