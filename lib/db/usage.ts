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
  /** Per surface, the busiest paths, split by device. One entry per path. */
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
 * The last `days` days, aggregated.
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

    const key = `${row.surface}\u0000${row.path}`;
    const entry =
      byPath.get(key) ??
      { surface: row.surface, path: row.path, mobile: 0, desktop: 0, bot: 0, total: 0 };
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
