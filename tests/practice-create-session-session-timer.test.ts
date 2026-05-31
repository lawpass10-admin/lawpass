/**
 * Slice 24 — verify that `createPracticeSession` writes the new
 * `session_duration_seconds` column to the INSERT payload.
 *
 * The action is too big to unit-test end-to-end (it builds the
 * sampling pool, fetches angles, etc.), so this test mocks the
 * supabase client with a chainable thenable + thenable-builder
 * pattern (mirrors the chainable mock from
 * `tests/exam-results-aggregate.test.ts`) and asserts the captured
 * INSERT payload.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/subscription-gate", () => ({
  requireActiveSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createPracticeSession } from "@/app/(app)/practice/_actions";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHAPTER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ID = "33333333-3333-4333-8333-333333333333";

// =============================================================================
// Chainable supabase mock
// =============================================================================
//
// The action chains `.from(...).insert/update/select(...).eq(...).in(...)` /
// `.order(...)` then awaits or `.single()`s. We expose a builder that:
//   - records every insert/update payload it sees
//   - returns mocked rows from a pluggable `selectResponder` based on
//     the (table, last-called-method) pair
//   - is awaitable directly (terminator-on-then) for the `.eq().eq()`
//     terminator the active-session UPDATE uses
//
// One captures-collector instance per test run.

type InsertCapture = { table: string; payload: Record<string, unknown> };
type SelectCapture = {
  table: string;
  selectCols: string;
  eqs: Array<[string, unknown]>;
  ins: Array<[string, unknown[]]>;
};
type Responder = (q: SelectCapture) => { data: unknown; error: unknown };

function makeSupabaseMock(responder: Responder) {
  const inserts: InsertCapture[] = [];
  const updates: InsertCapture[] = [];

  const client = {
    from(table: string) {
      const captureSelect: SelectCapture = {
        table,
        selectCols: "",
        eqs: [],
        ins: [],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};

      chain.insert = (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        // After insert(): the action chains .select("id").single().
        // We pre-stub the inserted-row id so .single() can return it.
        const insertChain = {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: "session-inserted-id" },
                error: null,
              }),
          }),
        };
        return insertChain;
      };

      chain.update = (payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return chain;
      };

      chain.select = (cols: string) => {
        captureSelect.selectCols = cols;
        return chain;
      };

      chain.eq = (col: string, val: unknown) => {
        captureSelect.eqs.push([col, val]);
        return chain;
      };

      chain.in = (col: string, vals: unknown[]) => {
        captureSelect.ins.push([col, vals]);
        return chain;
      };

      chain.order = () => chain;

      chain.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => {
        return Promise.resolve(responder(captureSelect)).then(
          onFulfilled,
          onRejected
        );
      };

      return chain;
    },
  };

  return { client, inserts, updates };
}

// =============================================================================
// Default responder for the queries createPracticeSession fires
// =============================================================================

function defaultResponder(q: SelectCapture): {
  data: unknown;
  error: unknown;
} {
  if (q.table === "source_questions") {
    // The chapter-pool fetch. Return one source so the action can
    // build a 1-question session.
    return { data: [{ id: SOURCE_ID }], error: null };
  }
  if (q.table === "angle_questions") {
    // No angles in this fixture.
    return { data: [], error: null };
  }
  if (q.table === "practice_sessions") {
    // The defensive abandon-active-session UPDATE terminates by
    // awaiting the .eq().eq() chain. We just return an empty
    // success result.
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

// =============================================================================
// Lifecycle
// =============================================================================

beforeEach(() => {
  vi.mocked(requireActiveSubscription).mockResolvedValue({
    user: { id: USER_ID } as never,
    subscription: {
      id: "s1",
      plan_type: "plan_3m",
      ends_at: "2026-12-31T00:00:00.000Z",
    },
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe("createPracticeSession — Slice 24 session timer persistence", () => {
  it("writes session_duration_seconds from the input into the INSERT payload", async () => {
    const { client, inserts } = makeSupabaseMock(defaultResponder);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await createPracticeSession({
      selectedChapterIds: [CHAPTER_ID],
      selectedSubtopicId: null,
      sourceCountTarget: 1,
      anglesPerSource: 0,
      timePerQuestionSeconds: 150,
      sessionDurationSeconds: 1800, // 30 min
    });

    expect(result.ok).toBe(true);
    // The action does an initial UPDATE (abandon stale active) and
    // then one INSERT. The INSERT is the practice_sessions create.
    const sessionInsert = inserts.find(
      (i) => i.table === "practice_sessions"
    );
    expect(sessionInsert).toBeDefined();
    expect(sessionInsert!.payload).toMatchObject({
      session_duration_seconds: 1800,
      // The legacy time_per_question_seconds keeps being written so
      // the NOT NULL column on the DB stays satisfied.
      time_per_question_seconds: 150,
      source_count_target: 1,
      angles_per_source: 0,
    });
  });

  it("writes 0 when the builder picked 'ללא טיימר'", async () => {
    const { client, inserts } = makeSupabaseMock(defaultResponder);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await createPracticeSession({
      selectedChapterIds: [CHAPTER_ID],
      selectedSubtopicId: null,
      sourceCountTarget: 1,
      anglesPerSource: 0,
      timePerQuestionSeconds: 150,
      sessionDurationSeconds: 0,
    });

    expect(result.ok).toBe(true);
    const sessionInsert = inserts.find(
      (i) => i.table === "practice_sessions"
    );
    expect(sessionInsert).toBeDefined();
    expect(sessionInsert!.payload.session_duration_seconds).toBe(0);
  });

  it("rejects payloads that exceed the schema cap (max 14400)", async () => {
    const { client } = makeSupabaseMock(defaultResponder);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await createPracticeSession({
      selectedChapterIds: [CHAPTER_ID],
      selectedSubtopicId: null,
      sourceCountTarget: 1,
      anglesPerSource: 0,
      timePerQuestionSeconds: 150,
      // 5 hours — exceeds the 4-hour DB CHECK constraint, schema
      // should refuse.
      sessionDurationSeconds: 18000,
    });

    expect(result.ok).toBe(false);
  });
});
