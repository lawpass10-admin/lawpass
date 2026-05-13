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

import { submitExamAttempt } from "@/app/(app)/exam/_actions";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getExamSessionById,
  getQuestionForExamPosition,
  type ExamSessionRow,
} from "@/lib/db/exam";
import { createClient } from "@/lib/supabase/server";

/**
 * Hand-rolled supabase-js mock: returns chainable thenables for the
 * specific call shapes used by submitExamAttempt + recomputeExamCounters.
 * Captures every `exam_sessions.update(...)` payload so tests can assert
 * what would have been written. Loose typing — supabase-js's builder
 * shapes are deeply generic and not worth re-deriving inside a test mock.
 */
function makeSupabaseMock() {
  const sessionUpdates: Array<{ payload: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  function attemptsCountBuilder() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.not = () => builder;
    builder.then = (resolve: (v: { count: number }) => unknown) =>
      Promise.resolve({ count: 0 }).then(resolve);
    return builder;
  }

  function examSessionsBuilder() {
    return {
      update: (payload: Record<string, unknown>) => {
        sessionUpdates.push({ payload });
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    };
  }

  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ error: null });
    },
    from: (table: string) => {
      if (table === "attempts") return attemptsCountBuilder();
      if (table === "exam_sessions") return examSessionsBuilder();
      throw new Error(`unexpected table in test: ${table}`);
    },
  };

  return { client, sessionUpdates, rpcCalls };
}

// Proper v4-shaped UUIDs (third group starts with 4, fourth with 8-b)
// so they pass z.string().uuid() in the input validators.
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
      {
        question_type: "source",
        question_id: QUESTION_ID,
        display_order: 1,
      },
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

describe("submitExamAttempt — time bump invariants", () => {
  beforeEach(() => {
    // Freeze the clock so the elapsed-since-last_activity_at math is
    // deterministic. 2026-05-13T18:00:00Z is arbitrary.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T18:00:00.000Z"));

    vi.mocked(requireActiveSubscription).mockResolvedValue({
      user: { id: "u1" } as never,
      subscription: {
        id: "s1",
        plan_type: "plan_3m",
        ends_at: "2026-12-31T00:00:00.000Z",
      },
    });

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("writes an integer time_used_seconds and rounds the elapsed float", async () => {
    // last_activity_at was set 5443ms ago via buildSession() — read at
    // freeze time. computeServerElapsedSeconds returns 5.443; nextTimeUsed
    // computes Math.round(10 + 5.443) = 15. Pre-hotfix this would have
    // sent the float 15.443 and Postgres would have silently rejected.
    const session = buildSession();
    vi.mocked(getExamSessionById).mockResolvedValue(session);

    const { client, sessionUpdates } = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await submitExamAttempt({
      sessionId: SESSION_ID,
      windowToken: WINDOW_TOKEN,
      position: 0,
      selectedLetter: "א",
      clientElapsedSeconds: 0,
    });

    expect(result.ok).toBe(true);

    // recomputeExamCounters fires its own UPDATE first
    // (questions_answered / questions_correct); the time UPDATE is the
    // one carrying time_used_seconds.
    const timeUpdate = sessionUpdates.find(
      (u) => "time_used_seconds" in u.payload
    );
    expect(timeUpdate).toBeDefined();
    const written = timeUpdate!.payload.time_used_seconds;
    expect(Number.isInteger(written)).toBe(true);
    expect(written).toBe(15);
  });
});
