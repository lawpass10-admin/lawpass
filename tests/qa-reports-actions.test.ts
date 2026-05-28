import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { submitQaReport } from "@/app/(app)/qa/_actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TESTER_USER_ID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID = "22222222-2222-4222-8222-222222222222";

// Minimal supabase-js fluent-chain fake. The action uses two surfaces:
//   1. .auth.getUser()
//   2. .from("profiles").select("is_qa_tester").eq("id", x).maybeSingle()
//   3. .from("qa_reports").insert({...}).select("id").single()
//   4. .storage.from("qa-screenshots").upload(...)   (only if screenshot)
//
// We don't test the screenshot upload path here — that's exercised in
// integration. Phase B-1's load-bearing assertions are the tester-gate
// and the insert path.
type ProfileLookupResult = { is_qa_tester: boolean } | null;
type InsertResult = { ok: true; id: string } | { ok: false };

function makeFakeSupabase(opts: {
  user: { id: string } | null;
  profile: ProfileLookupResult;
  insertResult: InsertResult;
}) {
  const insertCalls: Array<Record<string, unknown>> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function thenableSingle(data: any, error: any = null) {
    return {
      select: () => ({
        single: () => Promise.resolve({ data, error }),
      }),
    };
  }
  function profileBuilder() {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: opts.profile, error: null }),
        }),
      }),
    };
  }
  function qaReportsBuilder() {
    return {
      insert: (payload: Record<string, unknown>) => {
        insertCalls.push(payload);
        if (!opts.insertResult.ok) {
          return thenableSingle(null, { message: "rls_denied", code: "42501" });
        }
        return thenableSingle({ id: opts.insertResult.id });
      },
    };
  }
  return {
    insertCalls,
    client: {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: opts.user },
            error: null,
          }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (table: string): any => {
        if (table === "profiles") return profileBuilder();
        if (table === "qa_reports") return qaReportsBuilder();
        throw new Error(`unexpected from(${table})`);
      },
    },
  };
}

function validInput() {
  return {
    reportType: "bug" as const,
    problemText: "השאלה לא נטענה",
    expectedText: "השאלה אמורה להופיע",
    pagePath: "/practice/play/3",
    questionId: null,
    questionType: null,
    userAgent: "ua",
    viewport: "1440x900",
  };
}

describe("submitQaReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid_input-shape error for malformed input", async () => {
    const fake = makeFakeSupabase({
      user: { id: TESTER_USER_ID },
      profile: { is_qa_tester: true },
      insertResult: { ok: true, id: VALID_UUID },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await submitQaReport({ reportType: "typo" }, null);
    expect(result.ok).toBe(false);
    // Should not have reached the insert.
    expect(fake.insertCalls.length).toBe(0);
  });

  it("refuses unauthenticated callers", async () => {
    const fake = makeFakeSupabase({
      user: null,
      profile: null,
      insertResult: { ok: true, id: VALID_UUID },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await submitQaReport(validInput(), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("לא מחובר");
    expect(fake.insertCalls.length).toBe(0);
  });

  it("refuses non-testers with a typed error and no INSERT", async () => {
    const fake = makeFakeSupabase({
      user: { id: TESTER_USER_ID },
      profile: { is_qa_tester: false },
      insertResult: { ok: true, id: VALID_UUID },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await submitQaReport(validInput(), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/הרשאת/);
    expect(fake.insertCalls.length).toBe(0);
  });

  it("inserts the row for a valid tester input and returns reportId", async () => {
    const fake = makeFakeSupabase({
      user: { id: TESTER_USER_ID },
      profile: { is_qa_tester: true },
      insertResult: { ok: true, id: VALID_UUID },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await submitQaReport(validInput(), null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reportId).toBe(VALID_UUID);
    expect(fake.insertCalls.length).toBe(1);
    const payload = fake.insertCalls[0];
    expect(payload.user_id).toBe(TESTER_USER_ID);
    expect(payload.report_type).toBe("bug");
    expect(payload.problem_text).toBe("השאלה לא נטענה");
    expect(payload.screenshot_path).toBeNull();
    expect(payload.question_id).toBeNull();
    expect(payload.question_type).toBeNull();
  });

  it("surfaces a generic Hebrew error when the INSERT fails (e.g. RLS)", async () => {
    const fake = makeFakeSupabase({
      user: { id: TESTER_USER_ID },
      profile: { is_qa_tester: true },
      insertResult: { ok: false },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    // createAdminClient must never be called when insert fails.
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("admin client should not be reached after insert failure");
    });
    const result = await submitQaReport(validInput(), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/נכשלה/);
  });
});
