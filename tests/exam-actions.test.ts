import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/subscription-gate", () => ({
  requireActiveSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/db/exam", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/db/exam")>("@/lib/db/exam");
  return {
    ...actual,
    getExamSessionById: vi.fn(),
    getQuestionForExamPosition: vi.fn(),
  };
});

import {
  abandonAndExitExam,
  claimExamWindow,
  pauseExam,
  resumeExam,
  skipExamQuestion,
  submitExamAttempt,
  submitFinalExam,
  toggleExamBookmark,
} from "@/app/(app)/exam/_actions";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getExamSessionById,
  getQuestionForExamPosition,
  type ExamSessionRow,
} from "@/lib/db/exam";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Test helpers
// =============================================================================

/**
 * Hand-rolled supabase-js mock for actions that only use `.rpc()`.
 * Records every RPC call so tests can assert name + args. Returns the
 * supplied `rpcResponse` as the data payload.
 */
function makeRpcMock(rpcResponse: unknown) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: rpcResponse, error: null });
    },
  };
  return { client, rpcCalls };
}

/**
 * Mock for `claimExamWindow`, which uses the supabase-js fluent
 * `.from(...).update(...).eq(...).eq(...).in(...).select(...).single()`
 * chain instead of `.rpc()`. Captures the update payload.
 */
function makeUpdateMock(updateResponse: { data: unknown; error: unknown }) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn(),
    from: (table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.update = (payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return chain;
      };
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.select = () => chain;
      chain.single = () => Promise.resolve(updateResponse);
      return chain;
    },
  };
  return { client, updates };
}

// Proper v4-shaped UUIDs so they pass z.string().uuid().
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const WINDOW_TOKEN = "22222222-2222-4222-8222-222222222222";
const QUESTION_ID = "33333333-3333-4333-8333-333333333333";
const CHOICE_CORRECT_ID = "44444444-4444-4444-8444-444444444444";
const CHOICE_WRONG_ID = "55555555-5555-4555-8555-555555555555";

function buildSession(overrides: Partial<ExamSessionRow> = {}): ExamSessionRow {
  return {
    id: SESSION_ID,
    user_id: "u1",
    question_list: [
      { question_type: "source", question_id: QUESTION_ID, display_order: 1 },
    ],
    total_duration_seconds: 6000,
    time_used_seconds: 10,
    status: "active",
    questions_answered: 0,
    questions_correct: 0,
    final_score: null,
    passed: null,
    active_window_token: WINDOW_TOKEN,
    started_at: new Date(Date.now() - 60_000).toISOString(),
    paused_at: null,
    completed_at: null,
    last_activity_at: new Date(Date.now() - 5443).toISOString(),
    ...overrides,
  };
}

function setupAuthMock(): void {
  vi.mocked(requireActiveSubscription).mockResolvedValue({
    user: { id: "u1" } as never,
    subscription: {
      id: "s1",
      plan_type: "plan_3m",
      ends_at: "2026-12-31T00:00:00.000Z",
    },
  });
}

function setupResolvedQuestion(): void {
  vi.mocked(getQuestionForExamPosition).mockResolvedValue({
    kind: "source",
    question: {
      id: QUESTION_ID,
      question_group_id: "qg1",
      external_id: "ext1",
      question_text: "test question",
      chapter_id: "ch1",
      subtopic_id: "st1",
      chapter_title: "ch",
      subtopic_title: "st",
      legal_topic_analysis: "",
      full_explanation: "",
      common_pitfall: "",
      concepts_and_skills: [],
      quick_thinking_360: "",
      summary_for_memory: "",
      references_list: [],
      choices: [
        {
          id: CHOICE_CORRECT_ID,
          letter: "א",
          choice_text: "right",
          is_correct: true,
          distractor_analysis: null,
          display_order: 1,
        },
        {
          id: CHOICE_WRONG_ID,
          letter: "ב",
          choice_text: "wrong",
          is_correct: false,
          distractor_analysis: null,
          display_order: 2,
        },
      ],
    },
  } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-14T18:00:00.000Z"));
  setupAuthMock();
  setupResolvedQuestion();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

// =============================================================================
// submitExamAttempt
// =============================================================================

describe("submitExamAttempt — Phase 5 RPC contract", () => {
  it("calls submit_exam_answer RPC with the correct payload and surfaces remaining_seconds", async () => {
    vi.mocked(getExamSessionById).mockResolvedValue(buildSession());

    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      remaining_seconds: 5985,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await submitExamAttempt({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
      position: 0,
      selectedLetter: "א",
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("submit_exam_answer");
    expect(rpcCalls[0].args).toMatchObject({
      p_session_id: SESSION_ID,
      p_window_token: WINDOW_TOKEN,
      p_question_type: "source",
      p_source_question_id: QUESTION_ID,
      p_angle_question_id: null,
      p_selected_choice_id: CHOICE_CORRECT_ID,
      p_selected_letter: "א",
      p_is_correct: true,
      p_was_skipped: false,
    });
    if (result.ok) {
      expect(result.remaining_seconds).toBe(5985);
      expect(result.is_correct).toBe(true);
    }
  });

  it("maps RPC error_code into the action's typed failure", async () => {
    vi.mocked(getExamSessionById).mockResolvedValue(buildSession());

    const { client } = makeRpcMock({
      ok: false,
      error_code: "window_conflict",
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await submitExamAttempt({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
      position: 0,
      selectedLetter: "א",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("window_conflict");
    }
  });
});

// =============================================================================
// skipExamQuestion
// =============================================================================

describe("skipExamQuestion", () => {
  it("calls submit_exam_answer with was_skipped=true and null choice fields", async () => {
    vi.mocked(getExamSessionById).mockResolvedValue(buildSession());

    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      remaining_seconds: 5900,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await skipExamQuestion({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
      position: 0,
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls[0]).toMatchObject({
      name: "submit_exam_answer",
      args: {
        p_session_id: SESSION_ID,
        p_window_token: WINDOW_TOKEN,
        p_question_type: "source",
        p_source_question_id: QUESTION_ID,
        p_angle_question_id: null,
        p_selected_choice_id: null,
        p_selected_letter: null,
        p_is_correct: null,
        p_was_skipped: true,
      },
    });
  });
});

// =============================================================================
// pauseExam
// =============================================================================

describe("pauseExam", () => {
  it("calls bump_exam_session_time with p_new_status='paused'", async () => {
    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      remaining_seconds: 5800,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await pauseExam({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls[0]).toMatchObject({
      name: "bump_exam_session_time",
      args: {
        p_session_id: SESSION_ID,
        p_window_token: WINDOW_TOKEN,
        p_new_status: "paused",
      },
    });
  });
});

// =============================================================================
// resumeExam — critical invariant test
// =============================================================================

describe("resumeExam — pause-interval-excluded invariant", () => {
  it("calls resume_exam_session (NOT bump_exam_session_time) so the pause interval stays excluded from time_used_seconds", async () => {
    // The whole point of a dedicated resume_exam_session RPC is that it
    // does NOT bump time_used_seconds (the user wasn't spending exam
    // time while paused). If anyone ever swaps in bump_exam_session_time
    // here as a "cleanup," time would accumulate across the pause
    // interval and silently mis-score every paused exam. This test is
    // the regression guard.
    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      remaining_seconds: 5800,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await resumeExam({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(rpcCalls[0].name).toBe("resume_exam_session");
    expect(rpcCalls[0].name).not.toBe("bump_exam_session_time");
    // Args carry only session + token — no status flip, no time hint.
    expect(rpcCalls[0].args).toEqual({
      p_session_id: SESSION_ID,
      p_window_token: WINDOW_TOKEN,
    });
  });
});

// =============================================================================
// submitFinalExam
// =============================================================================

describe("submitFinalExam", () => {
  it("calls submit_final_exam and returns the results URL", async () => {
    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      final_score: 25,
      passed: true,
      already_completed: false,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await submitFinalExam({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe(`/exam/results/${SESSION_ID}`);
    }
    expect(rpcCalls[0].name).toBe("submit_final_exam");
    expect(rpcCalls[0].args).toEqual({
      p_session_id: SESSION_ID,
      p_window_token: WINDOW_TOKEN,
    });
  });
});

// =============================================================================
// toggleExamBookmark — time-exempt regression guard
// =============================================================================

describe("toggleExamBookmark", () => {
  it("calls record_bookmark_toggle and does NOT fire any time-bump RPCs", async () => {
    vi.mocked(getExamSessionById).mockResolvedValue(buildSession());

    // record_bookmark_toggle returns the new boolean state directly.
    const { client, rpcCalls } = makeRpcMock(true);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await toggleExamBookmark({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
      position: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bookmarked).toBe(true);
    expect(rpcCalls[0].name).toBe("record_bookmark_toggle");
    // Bookmark is time-exempt per spec — no time-bump RPC should fire.
    expect(rpcCalls.find((c) => c.name === "bump_exam_session_time")).toBeUndefined();
    expect(rpcCalls.find((c) => c.name === "submit_exam_answer")).toBeUndefined();
  });
});

// =============================================================================
// abandonAndExitExam
// =============================================================================

describe("abandonAndExitExam", () => {
  it("calls bump_exam_session_time with paused and returns /dashboard", async () => {
    const { client, rpcCalls } = makeRpcMock({
      ok: true,
      remaining_seconds: 5800,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await abandonAndExitExam({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("/dashboard");
    expect(rpcCalls[0]).toMatchObject({
      name: "bump_exam_session_time",
      args: {
        p_session_id: SESSION_ID,
        p_window_token: WINDOW_TOKEN,
        p_new_status: "paused",
      },
    });
  });
});

// =============================================================================
// claimExamWindow
// =============================================================================

describe("claimExamWindow", () => {
  it("mints a fresh token and returns the play URL at questions_answered", async () => {
    const { client, updates } = makeUpdateMock({
      data: { id: SESSION_ID, questions_answered: 7 },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await claimExamWindow({ sessionId: SESSION_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // randomUUID() shape: 8-4-4-4-12 hex chars.
      expect(result.windowToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(result.url).toBe(`/exam/play/7?session=${SESSION_ID}`);
    }
    // A FRESH token must be written — not the in-memory WINDOW_TOKEN
    // (which would be a no-op claim).
    expect(updates[0].payload.active_window_token).toBeDefined();
    expect(updates[0].payload.active_window_token).not.toBe(WINDOW_TOKEN);
  });
});
