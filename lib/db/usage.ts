/**
 * Reads the usage counters for the admin screen.
 *
 * Reads through the caller's own client, not the service role: `usage_daily`
 * has an admin-only SELECT policy, so a non-admin session gets nothing back
 * rather than relying on the page to have gated itself. The page gates itself
 * too — but the database is the one that has to be right.
 */

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Device = "mobile" | "desktop" | "bot";
export type Surface = "web" | "api";

export type UsageRow = {
  surface: Surface;
  device: Device;
  path: string;
  hits: number;
};

export type UsageSummary = {
  days: number;
  /** Hits per device across everything, for the share-of-traffic line. */
  byDevice: Record<Device, number>;
  /**
   * Per surface, the busiest paths, split by device.
   *
   * One entry per path PREFIX, two segments deep — see `rollUp`. `/api/auth`
   * here is signup, sign-in and the OTP added together, not an endpoint by
   * that name.
   */
  endpoints: {
    surface: Surface;
    path: string;
    mobile: number;
    desktop: number;
    bot: number;
    total: number;
  }[];
  total: number;
};

/**
 * A recorded path cut back to its first two segments.
 *
 *   /api/dashboard/mastery   → /api/dashboard
 *   /api/auth/signin         → /api/auth
 *   /api/open-questions/:id  → /api/open-questions
 *   /study-material/:id      → /study-material
 *   /api, /, /favicon.ico    → unchanged (nothing to cut)
 *
 * Done when READING, not when recording: `usage_daily` keeps the full path, so
 * this is a display choice that can be widened again — or dropped for one
 * domain — without having lost the detail. Rolling up at the middleware would
 * have thrown it away for good.
 *
 * Two segments is the depth at which a row means a feature rather than a call:
 * five dashboard endpoints fire on one screen load, and listing them
 * separately said more about the router than about what anyone did.
 */
function rollUp(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 2) return path;
  return `/${segments.slice(0, 2).join("/")}`;
}

/**
 * The last `days` days, aggregated.
 *
 * Paths are grouped by `rollUp`, so one row here can stand for several
 * endpoints. Hit counts still add up to the same total — the grouping moves
 * hits between rows, it never drops any.
 *
 * Summed in JS rather than in SQL because the input is at most a few thousand
 * rows — one per endpoint per device per day — and a view would be a second
 * place to keep the shape in step with the screen. If this ever stops being
 * small, the fix is a materialised view, not a cleverer query here.
 */
export async function getUsageSummary(
  supabase: Client,
  days = 30
): Promise<UsageSummary> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceDay = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("usage_daily")
    .select("surface, device, path, hits")
    .gte("day", sinceDay)
    .returns<UsageRow[]>();

  const empty: UsageSummary = {
    days,
    byDevice: { mobile: 0, desktop: 0, bot: 0 },
    endpoints: [],
    total: 0,
  };
  // A read failure shows an empty screen with its own message rather than
  // throwing: this is a reporting page, and it being unavailable must not look
  // like the admin area is broken.
  if (error || !data) return empty;

  const byDevice: Record<Device, number> = { mobile: 0, desktop: 0, bot: 0 };
  const byPath = new Map<string, UsageSummary["endpoints"][number]>();

  for (const row of data) {
    const hits = Number(row.hits) || 0;
    byDevice[row.device] = (byDevice[row.device] ?? 0) + hits;

    const path = rollUp(row.path);
    const key = `${row.surface}\u0000${path}`;
    const entry =
      byPath.get(key) ??
      { surface: row.surface, path, mobile: 0, desktop: 0, bot: 0, total: 0 };
    entry[row.device] += hits;
    entry.total += hits;
    byPath.set(key, entry);
  }

  return {
    days,
    byDevice,
    endpoints: [...byPath.values()].sort((a, b) => b.total - a.total),
    total: byDevice.mobile + byDevice.desktop + byDevice.bot,
  };
}

// ---------------------------------------------------------------------------
// Content consumption — what people actually completed
// ---------------------------------------------------------------------------

/**
 * How much work was submitted, per window.
 *
 * SUBMISSIONS, NOT PAGE VIEWS. `usage_daily` above answers "which endpoints get
 * hit"; this answers "how much did anyone finish", which is a different
 * question and cannot be derived from the first — opening /mahoti ten times
 * while deciding is ten hits and nought papers sat.
 *
 * Each row in these tables is one completed piece of work, which is why the
 * counts are plain row counts:
 *
 * - `mahoti_answers` / `diuni_answers`: one row per sitting of a WHOLE paper,
 *   not per question. `question_id` points at a `mahoti_questions` /
 *   `diuni_questions` row, and each of those holds the entire notebook;
 *   `answer_score` is that paper's percentage. A re-sit is a second row, so
 *   re-sits count — which is what "how much are they getting through" means.
 * - `open_question_answers`: one row per submitted writing task. Counted on
 *   submission rather than on `grading_status`, so a task submitted minutes
 *   ago and still in the marking queue is not missing from today's figure.
 *
 * Nothing is written until the candidate submits, so there is no abandoned
 * half-sitting to filter out.
 */
export type ContentMetric = {
  label: string;
  /** Submissions in the window. */
  day1: number;
  day7: number;
  /** DISTINCT candidates in the window — the count alone cannot tell one
   *  person sitting six papers from six people sitting one each, and those are
   *  very different days. */
  users1: number;
  users7: number;
};

export type ContentConsumption = {
  metrics: ContentMetric[];
  since1: string;
  since7: string;
};

const SOURCES = [
  { table: "mahoti_answers", label: "מבחני דין מהותי" },
  { table: "diuni_answers", label: "מבחני דין דיוני" },
  { table: "open_question_answers", label: "מטלות כתיבה" },
] as const;

export async function getContentConsumption(
  supabase: Client
): Promise<ContentConsumption> {
  const now = Date.now();
  const since1 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const metrics = await Promise.all(
    SOURCES.map(async ({ table, label }) => {
      // One read per table over the 7-day window, then the 1-day figure is
      // taken from the same rows. Three queries rather than six, and at these
      // volumes the window is a handful of rows either way.
      const { data, error } = await supabase
        .from(table)
        .select("user_id, created_at")
        .gte("created_at", since7)
        .returns<{ user_id: string; created_at: string }[]>();

      // A failed read shows zero for that row rather than failing the page: one
      // unavailable table must not hide the other two.
      if (error || !data) {
        return { label, day1: 0, day7: 0, users1: 0, users7: 0 };
      }

      const recent = data.filter((row) => row.created_at >= since1);
      return {
        label,
        day1: recent.length,
        day7: data.length,
        users1: new Set(recent.map((row) => row.user_id)).size,
        users7: new Set(data.map((row) => row.user_id)).size,
      };
    })
  );

  return { metrics, since1, since7 };
}
