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

/**
 * Slice 14 — mixed-status fixture for the triage-sort assertion. The
 * sequence intentionally has RESOLVED rows at the newest timestamps
 * and IN_PROGRESS rows at the oldest, so a pure created_at-DESC sort
 * would put resolved first; the triage rank must override that.
 *
 * Expected output after listQaReports:
 *   1. in_progress (created 09:00)  — newer of the two in_progress
 *   2. in_progress (created 08:00)
 *   3. open        (created 11:00)  — newer of the two open
 *   4. open        (created 10:00)
 *   5. resolved    (created 13:00)  — newer of the two resolved
 *   6. resolved    (created 12:00)
 *
 * The SQL `.order("created_at", { ascending: false })` returns rows
 * in created_at-DESC order; the in-memory STATUS_RANK sort is stable
 * so each status bucket keeps newest-first internally.
 */
const TRIAGE_FIXTURE_ROWS = [
  // resolved — newest timestamps
  {
    id: "a1111111-1111-4111-8111-111111111111",
    user_id: "u1111111-1111-4111-8111-111111111111",
    report_type: "bug",
    page_path: "/x",
    status: "resolved",
    created_at: "2026-05-28T13:00:00.000Z",
    screenshot_path: null,
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    user_id: "u2222222-2222-4222-8222-222222222222",
    report_type: "content",
    page_path: "/x",
    status: "resolved",
    created_at: "2026-05-28T12:00:00.000Z",
    screenshot_path: null,
  },
  // open — middle timestamps
  {
    id: "b1111111-1111-4111-8111-111111111111",
    user_id: "u3333333-3333-4333-8333-333333333333",
    report_type: "design",
    page_path: "/x",
    status: "open",
    created_at: "2026-05-28T11:00:00.000Z",
    screenshot_path: null,
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    user_id: "u4444444-4444-4444-8444-444444444444",
    report_type: "bug",
    page_path: "/x",
    status: "open",
    created_at: "2026-05-28T10:00:00.000Z",
    screenshot_path: null,
  },
  // in_progress — oldest timestamps (so we can prove rank beats recency)
  {
    id: "c1111111-1111-4111-8111-111111111111",
    user_id: "u5555555-5555-4555-8555-555555555555",
    report_type: "content",
    page_path: "/x",
    status: "in_progress",
    created_at: "2026-05-28T09:00:00.000Z",
    screenshot_path: null,
  },
  {
    id: "c2222222-2222-4222-8222-222222222222",
    user_id: "u6666666-6666-4666-8666-666666666666",
    report_type: "design",
    page_path: "/x",
    status: "in_progress",
    created_at: "2026-05-28T08:00:00.000Z",
    screenshot_path: null,
  },
];

describe("listQaReports", () => {
  it("orders by status-rank (in_progress → open → resolved), newest-first within each", async () => {
    const fake = buildFakeSupabase(TRIAGE_FIXTURE_ROWS);
    const rows = await listQaReports(
      fake.client as unknown as Parameters<typeof listQaReports>[0],
      {}
    );
    // Six rows in, six rows out.
    expect(rows.length).toBe(6);
    // No server-side filter applied when filters is empty.
    expect(fake.qaFilters).toEqual([]);
    // Exactly one SQL .order() call — the in-memory sort is JS-side.
    expect(fake.qaOrderCalls).toBe(1);

    // Triage rank: in_progress (1) → open (2) → resolved (3).
    expect(rows.map((r) => r.status)).toEqual([
      "in_progress",
      "in_progress",
      "open",
      "open",
      "resolved",
      "resolved",
    ]);

    // Within each status bucket, newest-first is preserved (stable
    // sort + SQL pre-order).
    expect(rows[0].id).toBe("c1111111-1111-4111-8111-111111111111"); // 09:00
    expect(rows[1].id).toBe("c2222222-2222-4222-8222-222222222222"); // 08:00
    expect(rows[2].id).toBe("b1111111-1111-4111-8111-111111111111"); // 11:00
    expect(rows[3].id).toBe("b2222222-2222-4222-8222-222222222222"); // 10:00
    expect(rows[4].id).toBe("a1111111-1111-4111-8111-111111111111"); // 13:00
    expect(rows[5].id).toBe("a2222222-2222-4222-8222-222222222222"); // 12:00
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
