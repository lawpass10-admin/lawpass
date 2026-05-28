import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/admin-gate", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  adminSetQaReportStatusAction,
  adminSetQaTesterAction,
} from "@/app/(app)/admin/_actions";
import { requireAdmin } from "@/lib/auth/admin-gate";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";

function setupAdminMock(): void {
  vi.mocked(requireAdmin).mockResolvedValue({
    user: { id: ADMIN_ID } as never,
    profile: { is_admin: true, full_name: "Admin" },
  });
}

/**
 * Hand-rolled supabase fake covering the surfaces the two admin
 * actions use: a .from("qa_reports" | "profiles") with .select / .eq /
 * .maybeSingle for the prior-row read, and .update / .eq for the
 * mutation; plus .from("admin_actions_log").insert for the audit row.
 *
 * Records every UPDATE and audit-log INSERT so tests can assert
 * payload shape.
 */
type UpdateCall = { table: string; payload: Record<string, unknown> };
type AuditCall = Record<string, unknown>;

function buildFakeSupabase(opts: {
  qaReportPriorRow?: { status: string; user_id: string } | null;
  profilePriorRow?: { is_qa_tester: boolean } | null;
  updateError?: { message: string; code?: string } | null;
}) {
  const updates: UpdateCall[] = [];
  const auditInserts: AuditCall[] = [];

  function qaReportsBuilder() {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () =>
      Promise.resolve({
        data: opts.qaReportPriorRow ?? null,
        error: null,
      });
    builder.update = (payload: Record<string, unknown>) => {
      updates.push({ table: "qa_reports", payload });
      return {
        eq: () =>
          Promise.resolve({
            data: null,
            error: opts.updateError ?? null,
          }),
      };
    };
    return builder;
  }

  function profilesBuilder() {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () =>
      Promise.resolve({
        data: opts.profilePriorRow ?? null,
        error: null,
      });
    builder.update = (payload: Record<string, unknown>) => {
      updates.push({ table: "profiles", payload });
      return {
        eq: () =>
          Promise.resolve({
            data: null,
            error: opts.updateError ?? null,
          }),
      };
    };
    return builder;
  }

  function auditBuilder() {
    const builder: Record<string, unknown> = {};
    builder.insert = (payload: Record<string, unknown>) => {
      auditInserts.push(payload);
      return Promise.resolve({ data: null, error: null });
    };
    return builder;
  }

  return {
    updates,
    auditInserts,
    client: {
      from: (table: string) => {
        if (table === "qa_reports") return qaReportsBuilder();
        if (table === "profiles") return profilesBuilder();
        if (table === "admin_actions_log") return auditBuilder();
        throw new Error(`unexpected from(${table})`);
      },
    },
  };
}

describe("adminSetQaReportStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminMock();
  });

  it("rejects unknown statuses without UPDATE", async () => {
    const fake = buildFakeSupabase({});
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaReportStatusAction({
      reportId: REPORT_ID,
      status: "weird",
    });
    expect(result.ok).toBe(false);
    expect(fake.updates).toEqual([]);
    expect(fake.auditInserts).toEqual([]);
  });

  it("rejects a malformed reportId", async () => {
    const fake = buildFakeSupabase({});
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaReportStatusAction({
      reportId: "not-a-uuid",
      status: "in_progress",
    });
    expect(result.ok).toBe(false);
    expect(fake.updates).toEqual([]);
  });

  it("returns not-found when the prior row is missing", async () => {
    const fake = buildFakeSupabase({ qaReportPriorRow: null });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaReportStatusAction({
      reportId: REPORT_ID,
      status: "in_progress",
    });
    expect(result.ok).toBe(false);
    expect(fake.updates).toEqual([]);
  });

  it("runs the UPDATE and writes the qa.set_status audit row on valid input", async () => {
    const fake = buildFakeSupabase({
      qaReportPriorRow: { status: "open", user_id: TARGET_USER_ID },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaReportStatusAction({
      reportId: REPORT_ID,
      status: "in_progress",
    });
    expect(result.ok).toBe(true);
    expect(fake.updates).toEqual([
      { table: "qa_reports", payload: { status: "in_progress" } },
    ]);
    expect(fake.auditInserts.length).toBe(1);
    const audit = fake.auditInserts[0];
    expect(audit.admin_id).toBe(ADMIN_ID);
    expect(audit.action_type).toBe("qa.set_status");
    expect(audit.target_user_id).toBe(TARGET_USER_ID);
    expect(audit.details).toEqual({
      report_id: REPORT_ID,
      from: "open",
      to: "in_progress",
    });
  });

  it("surfaces a Hebrew error and skips the audit on UPDATE failure", async () => {
    const fake = buildFakeSupabase({
      qaReportPriorRow: { status: "open", user_id: TARGET_USER_ID },
      updateError: { message: "rls_denied", code: "42501" },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaReportStatusAction({
      reportId: REPORT_ID,
      status: "resolved",
    });
    expect(result.ok).toBe(false);
    expect(fake.auditInserts).toEqual([]);
  });
});

describe("adminSetQaTesterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminMock();
  });

  it("rejects malformed userId without UPDATE", async () => {
    const fake = buildFakeSupabase({});
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaTesterAction({
      userId: "not-a-uuid",
      isQaTester: true,
    });
    expect(result.ok).toBe(false);
    expect(fake.updates).toEqual([]);
  });

  it("runs the UPDATE and writes qa.grant_tester when promoting", async () => {
    const fake = buildFakeSupabase({
      profilePriorRow: { is_qa_tester: false },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaTesterAction({
      userId: TARGET_USER_ID,
      isQaTester: true,
    });
    expect(result.ok).toBe(true);
    expect(fake.updates).toEqual([
      { table: "profiles", payload: { is_qa_tester: true } },
    ]);
    expect(fake.auditInserts.length).toBe(1);
    const audit = fake.auditInserts[0];
    expect(audit.admin_id).toBe(ADMIN_ID);
    expect(audit.action_type).toBe("qa.grant_tester");
    expect(audit.target_user_id).toBe(TARGET_USER_ID);
    expect(audit.details).toEqual({ from: false, to: true });
  });

  it("writes qa.revoke_tester when demoting", async () => {
    const fake = buildFakeSupabase({
      profilePriorRow: { is_qa_tester: true },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await adminSetQaTesterAction({
      userId: TARGET_USER_ID,
      isQaTester: false,
    });
    expect(result.ok).toBe(true);
    expect(fake.auditInserts[0]?.action_type).toBe("qa.revoke_tester");
    expect(fake.auditInserts[0]?.details).toEqual({ from: true, to: false });
  });
});
