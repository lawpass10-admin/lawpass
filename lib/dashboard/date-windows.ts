/**
 * Slice 4 — Israel-aware date windows for the dashboard.
 *
 * Server runs in Frankfurt time (Vercel region). The existing
 * `lib/greetings.ts` accepts that drift; analytics aggregates can't —
 * week boundaries and "last 7 days" cutoffs are visible to the user
 * and the off-by-one is jarring around DST transitions.
 *
 * Convention used in this module:
 *
 *   A "Date" returned here is an Israel-walltime instant — its UTC
 *   fields hold IL year/month/day/hour/minute/second. Always read parts
 *   via the `getUTC*` accessors so the server's local timezone (Frankfurt)
 *   doesn't bleed in. DST is sidestepped: we operate on IL walltime
 *   throughout, never on the underlying clock offset.
 *
 *   This is identical to how the rest of the codebase will treat these
 *   helpers' return values — see `Phase 4 / lib/db/dashboard.ts`.
 *
 * All functions accept an optional `now` parameter (an IL-walltime Date,
 * usually `nowIL()`) so they're deterministic + unit-testable. Defaulting
 * to `nowIL()` keeps callers concise in production.
 *
 * Out of scope for Slice 4: unifying `lib/greetings.ts` to use the same
 * convention. That's a separate cleanup.
 */

const IL_TZ = "Asia/Jerusalem";

type ILParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

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

function ilPartsOf(instant: Date): ILParts {
  const parts: Record<string, string> = {};
  for (const p of il24hFormatter.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  // `en-CA` + hour12:false renders midnight as "24" in some runtimes; normalize.
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

function ilDate(parts: ILParts): Date {
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

/**
 * Current moment as an IL-walltime Date. The returned Date's UTC fields
 * hold the current Asia/Jerusalem year/month/day/hour/minute/second.
 */
export function nowIL(): Date {
  return ilDate(ilPartsOf(new Date()));
}

/**
 * Zero the hour/minute/second of an IL-walltime Date. The result is the
 * start of that calendar day in Israel.
 */
export function startOfDayIL(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

/**
 * The Sunday that starts the week containing `d`. Israel convention:
 * weeks run Sunday through Saturday, so Sunday is weekday 0 from
 * JS's `getUTCDay()` on an IL-walltime Date.
 */
function startOfWeekSunIL(d: Date): Date {
  const start = startOfDayIL(d);
  const dow = start.getUTCDay(); // 0 = Sunday
  start.setUTCDate(start.getUTCDate() - dow);
  return start;
}

/**
 * Rolling 7-day window: `[now-7d, now]`. End is `now`; start is
 * 7 calendar days earlier (same hh:mm:ss as `now`).
 */
export function last7DaysIL(now: Date = nowIL()): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

/**
 * Previous-week rolling window: `[now-14d, now-7d]`. Used for the
 * WoW accuracy delta in plan §2.2.
 */
export function previousWeekIL(now: Date = nowIL()): {
  start: Date;
  end: Date;
} {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 14);
  return { start, end };
}

/**
 * 12 Sunday-to-Saturday week buckets ending the current calendar week
 * (the one containing `now`). Returns:
 *   - `start` = start of the oldest bucket (Sunday, 12 weeks before
 *     the current week's Sunday)
 *   - `end` = start of the bucket AFTER the current week (the next
 *     Sunday) — useful as a half-open upper bound for queries
 *   - `weekBoundaries` = 13 entries: `weekBoundaries[i]` is the start
 *     of bucket `i`; `weekBoundaries[12]` is `end`. Iterate as
 *     `[weekBoundaries[i], weekBoundaries[i+1])`.
 */
export function last12WeeksIL(now: Date = nowIL()): {
  start: Date;
  end: Date;
  weekBoundaries: Date[];
} {
  const currentWeekStart = startOfWeekSunIL(now);
  const boundaries: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    const b = new Date(currentWeekStart);
    b.setUTCDate(b.getUTCDate() - i * 7);
    boundaries.push(b);
  }
  const endExclusive = new Date(currentWeekStart);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
  boundaries.push(endExclusive);
  return {
    start: boundaries[0],
    end: endExclusive,
    weekBoundaries: boundaries,
  };
}

/**
 * 7 IL-day-boundary Dates ending YESTERDAY (today doesn't count yet
 * for the sparkline — plan §2.7 sparkline tracks "yesterday-6 ..
 * yesterday-0"). Index 0 is the oldest day; index 6 is yesterday.
 */
export function dailyBuckets7IL(now: Date = nowIL()): Date[] {
  const yesterday = startOfDayIL(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const out: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(yesterday);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d);
  }
  return out;
}
