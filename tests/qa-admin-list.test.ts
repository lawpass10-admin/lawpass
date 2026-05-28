import { describe, expect, it } from "vitest";

import { listQaReports } from "@/lib/db/qa-reports";

/**
 * Builder-style fake of supabase-js. Captures every `.eq()` call on
 * the qa_reports query so tests can assert the right filters were
 * applied. Also satisfies the profiles second-pass IN-fetch with an
 * empty data set (we don't need the names for the filter assertions).
 */
type Filter = { column: string; value: unknown };

function buildFakeSupabase(qaRows: Array<Record<string, unknown>>) {
  const qaFilters: Filter[] = [];
  let qaOrderCalls = 0;
  const profilesFilters: Filter[] = [];

  function qaBuilder() {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.order = () => {
      qaOrderCalls++;
      return builder;
    };
    builder.eq = (column: string, value: unknown) => {
      qaFilters.push({ column, value });
      return builder;
    };
    builder.then = (
      resolve: (v: { data: unknown; error: null }) => unknown
    ) => Promise.resolve({ data: qaRows, error: null }).then(resolve);
    return builder;
  }

  function profilesBuilder() {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.in = (column: string, value: unknown) => {
      profilesFilters.push({ column, value });
      return Promise.resolve({ data: [], error: null });
    };
    return builder;
  }

  return {
    qaFilters,
    profilesFilters,
    get qaOrderCalls() {
      return qaOrderCalls;
    },
    client: {
      from: (table: string) => {
        if (table === "qa_reports") return qaBuilder();
        if (table === "profiles") return profilesBuilder();
        throw new Error(`unexpected from(${table})`);
      },
    },
  };
}

const SAMPLE_ROWS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    report_type: "bug",
    page_path: "/practice/play/0",
    status: "open",
    created_at: "2026-05-28T10:00:00.000Z",
    screenshot_path: null,
  },
];

describe("listQaReports", () => {
  it("orders newest-first and applies no .eq when no filters are given", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    const rows = await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      {}
    );
    expect(rows.length).toBe(1);
    expect(fake.qaOrderCalls).toBe(1);
    expect(fake.qaFilters).toEqual([]);
  });

  it("applies a status filter when provided", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      { status: "open" }
    );
    expect(fake.qaFilters).toEqual([{ column: "status", value: "open" }]);
  });

  it("applies a report_type filter when provided", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      { reportType: "content" }
    );
    expect(fake.qaFilters).toEqual([
      { column: "report_type", value: "content" },
    ]);
  });

  it("applies a reporter user_id filter when provided", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      { reporterId: "33333333-3333-4333-8333-333333333333" }
    );
    expect(fake.qaFilters).toEqual([
      {
        column: "user_id",
        value: "33333333-3333-4333-8333-333333333333",
      },
    ]);
  });

  it("composes all three filters in a single query", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      {
        status: "in_progress",
        reportType: "design",
        reporterId: "44444444-4444-4444-8444-444444444444",
      }
    );
    expect(fake.qaFilters).toEqual([
      { column: "status", value: "in_progress" },
      { column: "report_type", value: "design" },
      {
        column: "user_id",
        value: "44444444-4444-4444-8444-444444444444",
      },
    ]);
  });

  it("maps the row shape from snake_case to camelCase", async () => {
    const fake = buildFakeSupabase(SAMPLE_ROWS);
    const rows = await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0]
    );
    expect(rows[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      reportType: "bug",
      pagePath: "/practice/play/0",
      status: "open",
      reporterUserId: "22222222-2222-4222-8222-222222222222",
      screenshotPath: null,
    });
  });
});
