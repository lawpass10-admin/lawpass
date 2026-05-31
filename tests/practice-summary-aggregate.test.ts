/**
 * Slice 21 — coverage for `getSummary`'s per-question review
 * enrichment (`byPosition`), mirroring the exam-side aggregate test
 * at `tests/exam-results-aggregate.test.ts`.
 *
 * Asserts:
 *   1. byPosition is assembled in `session.question_list` position
 *      order — NOT in attempted_at order, even when attempts are
 *      recorded out of order.
 *   2. Each row carries `selectedLetter` from the matching attempts
 *      row, plus the resolved choices, plus a `learning` payload with
 *      server-derived `correctChoice`.
 *   3. Archived RLS branch: items whose 360°/choice resolvers don't
 *      return a row land with `learning: null` (the UI then skips the
 *      360° toggle on that row).
 *   4. The widened SELECT actually requests `selected_letter` /
 *      `was_skipped` / `attempted_at` (the columns the new review
 *      logic depends on).
 *
 * Uses the same chainable thenable-supabase mock pattern as the
 * exam-side test — practice's `getSessionForUser` uses
 * `.eq().eq().maybeSingle()`, and `getSummary`'s attempts query
 * terminates by awaiting `.eq()` (thenable), which the mock supports.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSummary,
  type PracticeSessionRow,
} from "@/lib/db/practice";

// =============================================================================
// IDs
// =============================================================================

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ANGLE_Q1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const SOURCE_Q2_ARCHIVED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

const SRC1_CORRECT_CHOICE_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const SRC1_WRONG_CHOICE_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const ANG1_CORRECT_CHOICE_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";

// =============================================================================
// Chainable supabase mock — same pattern as the exam-side aggregate test
// =============================================================================

type QueryCapture = {
  table: string;
  selectCols: string;
  eqs: Array<[string, unknown]>;
  inCol: string | null;
  inIds: string[] | null;
  terminator: "in" | "maybeSingle" | "thenable" | null;
};

type Responder = (q: QueryCapture) => { data: unknown; error: unknown };

function makeChainableMock(responder: Responder) {
  const queries: QueryCapture[] = [];

  const client = {
    rpc: vi.fn(),
    from(table: string) {
      const capture: QueryCapture = {
        table,
        selectCols: "",
        eqs: [],
        inCol: null,
        inIds: null,
        terminator: null,
      };
      queries.push(capture);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};

      chain.select = (cols: string) => {
        capture.selectCols = cols;
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        capture.eqs.push([col, val]);
        return chain;
      };
      chain.in = (col: string, ids: string[]) => {
        capture.inCol = col;
        capture.inIds = ids;
        capture.terminator = "in";
        return Promise.resolve(responder(capture));
      };
      chain.maybeSingle = () => {
        capture.terminator = "maybeSingle";
        return Promise.resolve(responder(capture));
      };
      chain.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => {
        if (capture.terminator === null) capture.terminator = "thenable";
        return Promise.resolve(responder(capture)).then(
          onFulfilled,
          onRejected
        );
      };

      return chain;
    },
  };

  return { client, queries };
}

// =============================================================================
// Fixtures
// =============================================================================

const SESSION_ROW = {
  id: SESSION_ID,
  user_id: USER_ID,
  selected_chapters: ["chap-1"],
  selected_subtopics: [],
  source_count_target: 2,
  angles_per_source: 1,
  time_per_question_seconds: 150,
  question_list: [
    { type: "source", id: SOURCE_Q1, position: 0 },
    { type: "angle", id: ANGLE_Q1, position: 1 },
    { type: "source", id: SOURCE_Q2_ARCHIVED, position: 2 },
  ],
  status: "completed",
  questions_answered: 2,
  questions_correct: 1,
  started_at: new Date(Date.now() - 60_000).toISOString(),
  completed_at: new Date().toISOString(),
  last_activity_at: new Date().toISOString(),
};

// Attempts recorded OUT OF ORDER on purpose — angle attempted first
// (10 min ago), then source. byPosition must still come back in
// question_list position order, not attempted_at order.
const ATTEMPTS_ROWS = [
  {
    question_type: "angle",
    source_question_id: null,
    angle_question_id: ANGLE_Q1,
    is_correct: false,
    was_skipped: false,
    selected_letter: "ב",
    attempted_at: new Date(Date.now() - 600_000).toISOString(),
  },
  {
    question_type: "source",
    source_question_id: SOURCE_Q1,
    angle_question_id: null,
    is_correct: true,
    was_skipped: false,
    selected_letter: "א",
    attempted_at: new Date().toISOString(),
  },
];

function build360(seed: string) {
  return {
    legal_topic_analysis: `${seed} — ניתוח`,
    full_explanation: `${seed} — הסבר`,
    common_pitfall: `${seed} — מלכודת`,
    concepts_and_skills: [`${seed}-c1`],
    quick_thinking_360: `${seed} — חשיבה`,
    summary_for_memory: `${seed} — סיכום`,
    references_list: [`${seed}-r1`],
  };
}

/**
 * Responder handles every query shape getSummary fires:
 *   - practice_sessions.maybeSingle()   → session row
 *   - attempts.eq(...).eq(...) (thenable) → attempts rows
 *   - source_questions / angle_questions (multiple SELECT shapes)
 *   - source_choices / angle_choices
 *
 * SOURCE_Q2_ARCHIVED is intentionally omitted from the
 * SOURCE_SELECT_FULL response AND the source_choices response,
 * simulating RLS hiding it mid-flight — the aggregate must set
 * that row's `learning` field to null.
 */
function defaultResponder(q: QueryCapture): {
  data: unknown;
  error: unknown;
} {
  if (q.table === "practice_sessions") {
    return { data: SESSION_ROW, error: null };
  }

  if (q.table === "attempts") {
    return { data: ATTEMPTS_ROWS, error: null };
  }

  if (q.table === "source_questions") {
    if (q.selectCols.includes("legal_topic_analysis")) {
      // 360° payload SELECT — omits the archived row.
      return {
        data: [{ id: SOURCE_Q1, ...build360("src1") }],
        error: null,
      };
    }
    if (q.selectCols.includes("chapter:chapters")) {
      // Subtopic/chapter lookup (existing pre-Slice-21 logic).
      return {
        data: [
          {
            id: SOURCE_Q1,
            chapter: { title: "סדר דין אזרחי" },
            subtopic: { title: "סדר דין" },
          },
          // Archived omitted.
        ],
        error: null,
      };
    }
    // question_text-only path
    return {
      data: [
        { id: SOURCE_Q1, question_text: "src1 question?" },
        // Archived omitted.
      ],
      error: null,
    };
  }

  if (q.table === "angle_questions") {
    if (q.selectCols.includes("legal_topic_analysis")) {
      return {
        data: [{ id: ANGLE_Q1, ...build360("ang1") }],
        error: null,
      };
    }
    // angle → source mapping
    if (q.selectCols.includes("source_question_id")) {
      return {
        data: [{ id: ANGLE_Q1, source_question_id: SOURCE_Q1 }],
        error: null,
      };
    }
    // question_text-only path
    return {
      data: [{ id: ANGLE_Q1, question_text: "ang1 question?" }],
      error: null,
    };
  }

  if (q.table === "source_choices") {
    return {
      data: [
        {
          id: SRC1_CORRECT_CHOICE_ID,
          source_question_id: SOURCE_Q1,
          letter: "א",
          choice_text: "right",
          is_correct: true,
          distractor_analysis: null,
          display_order: 1,
        },
        {
          id: SRC1_WRONG_CHOICE_ID,
          source_question_id: SOURCE_Q1,
          letter: "ב",
          choice_text: "wrong",
          is_correct: false,
          distractor_analysis: "why",
          display_order: 2,
        },
      ],
      error: null,
    };
  }

  if (q.table === "angle_choices") {
    return {
      data: [
        {
          id: ANG1_CORRECT_CHOICE_ID,
          angle_question_id: ANGLE_Q1,
          letter: "ג",
          choice_text: "ang right",
          is_correct: true,
          distractor_analysis: null,
          display_order: 1,
        },
      ],
      error: null,
    };
  }

  return { data: [], error: null };
}

// =============================================================================
// Lifecycle
// =============================================================================

afterEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe("getSummary — Slice 21 per-question review", () => {
  it("assembles byPosition in question_list position order, not attempted_at order", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const result = await getSummary(client as never, USER_ID, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.byPosition).toHaveLength(3);

    // The attempts fixture deliberately recorded the ANGLE attempt
    // (~10 min ago) BEFORE the SOURCE attempt (now). If byPosition
    // were ordered by attempted_at, position 0 would be the angle.
    // It must instead follow question_list order.
    expect(result!.byPosition[0].position).toBe(0);
    expect(result!.byPosition[0].questionType).toBe("source");
    expect(result!.byPosition[0].questionId).toBe(SOURCE_Q1);

    expect(result!.byPosition[1].position).toBe(1);
    expect(result!.byPosition[1].questionType).toBe("angle");
    expect(result!.byPosition[1].questionId).toBe(ANGLE_Q1);

    expect(result!.byPosition[2].position).toBe(2);
    expect(result!.byPosition[2].questionId).toBe(SOURCE_Q2_ARCHIVED);
  });

  it("wires selectedLetter, isCorrect, and choices from attempts + resolvers", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const result = await getSummary(client as never, USER_ID, SESSION_ID);

    expect(result).not.toBeNull();

    const row0 = result!.byPosition[0]; // source, picked correct
    expect(row0.selectedLetter).toBe("א");
    expect(row0.isCorrect).toBe(true);
    expect(row0.wasSkipped).toBe(false);
    expect(row0.choices).toHaveLength(2);
    expect(row0.choices[0].id).toBe(SRC1_CORRECT_CHOICE_ID);
    expect(row0.choices[0].choice_text).toBe("right");
    expect(row0.choices[1].distractor_analysis).toBe("why");
    // Server-derived correctChoice — never re-scanned client-side.
    expect(row0.learning).not.toBeNull();
    expect(row0.learning!.correctChoice).not.toBeNull();
    expect(row0.learning!.correctChoice!.id).toBe(SRC1_CORRECT_CHOICE_ID);

    const row1 = result!.byPosition[1]; // angle, picked wrong
    expect(row1.selectedLetter).toBe("ב");
    expect(row1.isCorrect).toBe(false);
    expect(row1.learning!.correctChoice!.id).toBe(ANG1_CORRECT_CHOICE_ID);
    expect(row1.learning!.correctChoice!.letter).toBe("ג");
  });

  it("yields learning: null on archived rows (RLS hid mid-flight)", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const result = await getSummary(client as never, USER_ID, SESSION_ID);

    expect(result).not.toBeNull();
    const row2 = result!.byPosition[2]; // SOURCE_Q2_ARCHIVED
    expect(row2.learning).toBeNull();
    // No attempt was recorded for the archived question, so the row
    // lands as "unanswered" via the attemptByKey join — selectedLetter
    // null, isCorrect null, wasSkipped false.
    expect(row2.selectedLetter).toBeNull();
    expect(row2.isCorrect).toBeNull();
    expect(row2.wasSkipped).toBe(false);
    expect(row2.choices).toEqual([]);
  });

  it("widens the attempts SELECT to include the new review columns", async () => {
    const { client, queries } = makeChainableMock(defaultResponder);

    await getSummary(client as never, USER_ID, SESSION_ID);

    const attemptsQuery = queries.find((q) => q.table === "attempts");
    expect(attemptsQuery).toBeDefined();
    // Columns the Slice 21 review logic depends on.
    expect(attemptsQuery!.selectCols).toContain("selected_letter");
    expect(attemptsQuery!.selectCols).toContain("was_skipped");
    expect(attemptsQuery!.selectCols).toContain("attempted_at");
    // Pre-existing columns must still be requested.
    expect(attemptsQuery!.selectCols).toContain("question_type");
    expect(attemptsQuery!.selectCols).toContain("is_correct");
  });
});

// Tiny compile-time guard — referenced solely so vitest emits a
// failure if `PracticeSessionRow` is removed from `@/lib/db/practice`.
type _PracticeSessionRow = PracticeSessionRow;
const _typeGuard: undefined | _PracticeSessionRow = undefined;
void _typeGuard;
