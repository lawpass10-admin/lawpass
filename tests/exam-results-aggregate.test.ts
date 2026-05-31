/**
 * Slice 17 B-2 — coverage for `resolveLearning360ForList` (new
 * resolver that batches the 7 × 360° fields for the exam-results
 * page's inline `<Learning360Panel>`) plus the
 * `getExamResultsAggregate` enrichment path.
 *
 * Mirrors the makeRpcMock / thenable-fake-supabase pattern from
 * `tests/exam-actions.test.ts`. No live DB; the chainable mock
 * captures every `.from(...).select(...).eq?(...).in?(...)` call
 * so the tests can assert table names, SELECT column lists, ID
 * filters, and parallel-vs-serial ordering.
 *
 * vi.mock cannot intercept the in-module calls to `getExamSessionById`
 * / `getExamPositionStatuses` that `getExamResultsAggregate` makes —
 * those resolve at module load time to the local bindings, not the
 * mocked exports. So the chainable mock handles `exam_sessions` and
 * `attempts` too: the chain is thenable so `.eq(...)` can be awaited
 * directly (the shape `getExamPositionStatuses` uses), and exposes a
 * `.maybeSingle()` terminator (the shape `getExamSessionById` uses).
 *
 * Out of scope (per Slice 17 B-2): /practice/summary, DB schema /
 * RLS / grants, render tests on the page component itself.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ANGLE_SELECT_FULL,
  SOURCE_SELECT_FULL,
  getExamResultsAggregate,
  resolveLearning360ForList,
  type ExamQuestionListItem,
} from "@/lib/db/exam";

// =============================================================================
// IDs (v4-shape so any future z.string().uuid() doesn't trip)
// =============================================================================

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SOURCE_Q2_ARCHIVED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const ANGLE_Q1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const SRC1_CORRECT_CHOICE_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const SRC1_WRONG_CHOICE_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const ANG1_CORRECT_CHOICE_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";

// =============================================================================
// Chainable supabase mock
// =============================================================================

type QueryCapture = {
  table: string;
  selectCols: string;
  eqs: Array<[string, unknown]>;
  inCol: string | null;
  inIds: string[] | null;
  /** Which terminator awoke the chain: explicit `.in()`, explicit
   *  `.maybeSingle()`, or the chain being awaited directly. */
  terminator: "in" | "maybeSingle" | "thenable" | null;
};

type EventLog = Array<
  | {
      kind: "in-start";
      index: number;
      table: string;
      selectCols: string;
    }
  | { kind: "in-settle"; index: number; table: string }
>;

type Responder = (q: QueryCapture) => { data: unknown; error: unknown };

function makeChainableMock(responder: Responder) {
  const queries: QueryCapture[] = [];
  const events: EventLog = [];
  let nextIndex = 0;

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

      // The chain is `any`-typed because supabase-js exposes a
      // ridiculously wide builder type and our tests only exercise
      // the slice we use in production code.
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
        const index = nextIndex++;
        events.push({
          kind: "in-start",
          index,
          table,
          selectCols: capture.selectCols,
        });
        return new Promise((resolve) => {
          // Resolve on a microtask so all sibling `.in()` calls inside
          // the same `Promise.all` have a chance to fire first. If the
          // resolvers were serialised, only one in-start would precede
          // its in-settle.
          queueMicrotask(() => {
            events.push({ kind: "in-settle", index, table });
            resolve(responder(capture));
          });
        });
      };
      chain.maybeSingle = () => {
        capture.terminator = "maybeSingle";
        return new Promise((resolve) => {
          queueMicrotask(() => resolve(responder(capture)));
        });
      };
      // Thenable — `await chain` (the shape getExamPositionStatuses uses
      // when it terminates on `.eq(...)`). Only fires when the chain has
      // NOT already been resolved via .in() / .maybeSingle().
      chain.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => {
        if (capture.terminator === null) capture.terminator = "thenable";
        return new Promise<unknown>((resolve) => {
          queueMicrotask(() => resolve(responder(capture)));
        }).then(onFulfilled, onRejected);
      };

      return chain;
    },
  };

  return { client, queries, events };
}

// =============================================================================
// Fixtures
// =============================================================================

const SESSION_ROW = {
  id: SESSION_ID,
  user_id: USER_ID,
  question_list: [
    { question_type: "source", question_id: SOURCE_Q1, display_order: 1 },
    { question_type: "angle", question_id: ANGLE_Q1, display_order: 2 },
    {
      question_type: "source",
      question_id: SOURCE_Q2_ARCHIVED,
      display_order: 3,
    },
  ],
  total_duration_seconds: 6000,
  time_used_seconds: 1234,
  status: "completed",
  questions_answered: 3,
  questions_correct: 2,
  final_score: 2,
  passed: false,
  active_window_token: "00000000-0000-4000-8000-000000000000",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  paused_at: null,
  completed_at: new Date().toISOString(),
  last_activity_at: new Date().toISOString(),
  mode: "procedural",
};

// Attempts: user picked correctly on Q1, wrong on Q2 (angle), unanswered
// on Q3 (archived).
const ATTEMPTS_ROWS = [
  {
    question_type: "source",
    source_question_id: SOURCE_Q1,
    angle_question_id: null,
    is_correct: true,
    was_skipped: false,
    selected_letter: "א",
  },
  {
    question_type: "angle",
    source_question_id: null,
    angle_question_id: ANGLE_Q1,
    is_correct: false,
    was_skipped: false,
    selected_letter: "ב",
  },
];

// Stable 360° payload — same Source360 shape used by both the row
// and the panel.
function build360(seed: string) {
  return {
    legal_topic_analysis: `${seed} — ניתוח הנושא`,
    full_explanation: `${seed} — הסבר מלא`,
    common_pitfall: `${seed} — מלכודת`,
    concepts_and_skills: [`${seed}-c1`, `${seed}-c2`],
    quick_thinking_360: `${seed} — חשיבה 360`,
    summary_for_memory: `${seed} — סיכום`,
    references_list: [`${seed}-r1`],
  };
}

/**
 * Default responder that returns plausible rows for every
 * (table, SELECT) combination our resolvers issue. Tests can wrap
 * this to override specific branches (none currently need to —
 * the "archived" branch is built into the data fixture itself).
 */
function defaultResponder(q: QueryCapture): {
  data: unknown;
  error: unknown;
} {
  if (q.table === "exam_sessions") {
    // getExamSessionById — single-row .maybeSingle().
    return { data: SESSION_ROW, error: null };
  }

  if (q.table === "attempts") {
    // getExamPositionStatuses — thenable terminator on the .eq() chain.
    return { data: ATTEMPTS_ROWS, error: null };
  }

  if (q.table === "source_questions") {
    // Three different SELECT shapes hit source_questions: chapter join,
    // question_text only, and SOURCE_SELECT_FULL (the 360° payload).
    if (q.selectCols.includes("legal_topic_analysis")) {
      // SOURCE_SELECT_FULL — the 360° resolver path.
      return {
        data: [
          {
            id: SOURCE_Q1,
            ...build360("src1"),
          },
          // SOURCE_Q2_ARCHIVED intentionally NOT in this list — it's
          // the "RLS hid mid-flight" branch. Both the 360° resolver
          // and the choices resolver omit it.
        ],
        error: null,
      };
    }
    if (q.selectCols.includes("chapter:chapters")) {
      return {
        data: [
          {
            id: SOURCE_Q1,
            chapter: {
              code: "civil-proc",
              title: "סדר דין אזרחי",
              track: "procedural",
              display_order: 1,
            },
          },
          {
            id: SOURCE_Q2_ARCHIVED,
            chapter: {
              code: "civil-proc",
              title: "סדר דין אזרחי",
              track: "procedural",
              display_order: 1,
            },
          },
        ],
        error: null,
      };
    }
    // question_text-only path
    return {
      data: [
        { id: SOURCE_Q1, question_text: "src1 question?" },
        // ARCHIVED row absent here too — its excerpt collapses to "—".
      ],
      error: null,
    };
  }

  if (q.table === "angle_questions") {
    if (q.selectCols.includes("legal_topic_analysis")) {
      return {
        data: [
          {
            id: ANGLE_Q1,
            ...build360("ang1"),
          },
        ],
        error: null,
      };
    }
    if (q.selectCols.includes("source_question:source_questions")) {
      return {
        data: [
          {
            id: ANGLE_Q1,
            source_question: {
              chapter: {
                code: "civil-proc",
                title: "סדר דין אזרחי",
                track: "procedural",
                display_order: 1,
              },
            },
          },
        ],
        error: null,
      };
    }
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
          choice_text: "the right one",
          is_correct: true,
          distractor_analysis: null,
          display_order: 1,
        },
        {
          id: SRC1_WRONG_CHOICE_ID,
          source_question_id: SOURCE_Q1,
          letter: "ב",
          choice_text: "the wrong one",
          is_correct: false,
          distractor_analysis: "why this is wrong",
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
          choice_text: "angle right",
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

beforeEach(() => {
  // No vi.useFakeTimers — our microtask-based resolution needs real
  // microtask scheduling.
});

afterEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// resolveLearning360ForList — direct unit tests
// =============================================================================

describe("resolveLearning360ForList — Slice 17 B-2", () => {
  it("issues exactly two batched .in() queries using SOURCE_SELECT_FULL and ANGLE_SELECT_FULL", async () => {
    const { client, queries } = makeChainableMock(defaultResponder);

    const list: ExamQuestionListItem[] = [
      { question_type: "source", question_id: SOURCE_Q1, display_order: 1 },
      { question_type: "angle", question_id: ANGLE_Q1, display_order: 2 },
      {
        question_type: "source",
        question_id: SOURCE_Q2_ARCHIVED,
        display_order: 3,
      },
    ];

    await resolveLearning360ForList(client as never, list);

    // Exactly two .from() invocations issued by this resolver — one
    // per question type. (Choices, chapters, texts come from sibling
    // resolvers not exercised here.)
    expect(queries).toHaveLength(2);

    const sourceQ = queries.find((q) => q.table === "source_questions");
    const angleQ = queries.find((q) => q.table === "angle_questions");
    expect(sourceQ).toBeDefined();
    expect(angleQ).toBeDefined();

    // SELECT column lists must be the exported SOURCE_SELECT_FULL /
    // ANGLE_SELECT_FULL constants verbatim (the brief explicitly
    // calls these out — they enumerate the 7 × 360° fields plus the
    // chapter/subtopic joins).
    expect(sourceQ!.selectCols).toBe(SOURCE_SELECT_FULL);
    expect(angleQ!.selectCols).toBe(ANGLE_SELECT_FULL);

    // ID filters: only source IDs go to source_questions, only angle
    // IDs go to angle_questions — the resolver partitions correctly.
    expect(sourceQ!.inCol).toBe("id");
    expect(sourceQ!.inIds).toEqual([SOURCE_Q1, SOURCE_Q2_ARCHIVED]);
    expect(angleQ!.inCol).toBe("id");
    expect(angleQ!.inIds).toEqual([ANGLE_Q1]);
  });

  it("returns a Map keyed by `${question_type}:${id}` carrying the 7 × 360° fields", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const list: ExamQuestionListItem[] = [
      { question_type: "source", question_id: SOURCE_Q1, display_order: 1 },
      { question_type: "angle", question_id: ANGLE_Q1, display_order: 2 },
    ];

    const map = await resolveLearning360ForList(client as never, list);

    expect(map.size).toBe(2);
    expect(map.has(`source:${SOURCE_Q1}`)).toBe(true);
    expect(map.has(`angle:${ANGLE_Q1}`)).toBe(true);

    const src = map.get(`source:${SOURCE_Q1}`)!;
    expect(src.legal_topic_analysis).toBe("src1 — ניתוח הנושא");
    expect(src.full_explanation).toBe("src1 — הסבר מלא");
    expect(src.common_pitfall).toBe("src1 — מלכודת");
    expect(src.quick_thinking_360).toBe("src1 — חשיבה 360");
    expect(src.summary_for_memory).toBe("src1 — סיכום");
    expect(src.concepts_and_skills).toEqual(["src1-c1", "src1-c2"]);
    expect(src.references_list).toEqual(["src1-r1"]);

    const ang = map.get(`angle:${ANGLE_Q1}`)!;
    expect(ang.legal_topic_analysis).toBe("ang1 — ניתוח הנושא");
    expect(ang.concepts_and_skills).toEqual(["ang1-c1", "ang1-c2"]);
  });

  it("omits archived items (RLS hid mid-flight) from the Map", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const list: ExamQuestionListItem[] = [
      { question_type: "source", question_id: SOURCE_Q1, display_order: 1 },
      {
        question_type: "source",
        question_id: SOURCE_Q2_ARCHIVED,
        display_order: 2,
      },
    ];

    const map = await resolveLearning360ForList(client as never, list);

    // defaultResponder intentionally omits SOURCE_Q2_ARCHIVED from the
    // SOURCE_SELECT_FULL response, simulating RLS hiding it mid-
    // flight. The Map should NOT contain a key for it; the aggregate
    // then maps that row's `learning` field to null.
    expect(map.has(`source:${SOURCE_Q1}`)).toBe(true);
    expect(map.has(`source:${SOURCE_Q2_ARCHIVED}`)).toBe(false);
  });

  it("skips the source_questions query entirely when there are no source items", async () => {
    const { client, queries } = makeChainableMock(defaultResponder);

    const list: ExamQuestionListItem[] = [
      { question_type: "angle", question_id: ANGLE_Q1, display_order: 1 },
    ];

    await resolveLearning360ForList(client as never, list);

    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("angle_questions");
  });
});

// =============================================================================
// getExamResultsAggregate enrichment + parallelism
// =============================================================================

describe("getExamResultsAggregate — Slice 17 B-2 enrichment", () => {
  it("populates byPosition[i].learning with the 360° fields + server-derived correctChoice", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const result = await getExamResultsAggregate(
      client as never,
      USER_ID,
      SESSION_ID
    );

    expect(result).not.toBeNull();
    expect(result!.byPosition).toHaveLength(3);

    // Position 0 — source question with full 360° + correct choice.
    const row0 = result!.byPosition[0];
    expect(row0.learning).not.toBeNull();
    expect(row0.learning!.legal_topic_analysis).toBe("src1 — ניתוח הנושא");
    expect(row0.learning!.summary_for_memory).toBe("src1 — סיכום");
    // correctChoice is derived server-side via choices.find(c => c.is_correct).
    expect(row0.learning!.correctChoice).not.toBeNull();
    expect(row0.learning!.correctChoice!.id).toBe(SRC1_CORRECT_CHOICE_ID);
    expect(row0.learning!.correctChoice!.letter).toBe("א");
    expect(row0.learning!.correctChoice!.is_correct).toBe(true);

    // Choices on the row flow as the full snake_case `Choice` shape
    // (Slice 17 B-2 dropped the ExamReviewChoice camelCase projection).
    expect(row0.choices).toHaveLength(2);
    expect(row0.choices[0].id).toBe(SRC1_CORRECT_CHOICE_ID);
    expect(row0.choices[0].choice_text).toBe("the right one");
    expect(row0.choices[0].is_correct).toBe(true);
    expect(row0.choices[1].distractor_analysis).toBe("why this is wrong");

    // Position 1 — angle question.
    const row1 = result!.byPosition[1];
    expect(row1.learning).not.toBeNull();
    expect(row1.learning!.legal_topic_analysis).toBe("ang1 — ניתוח הנושא");
    expect(row1.learning!.correctChoice!.id).toBe(ANG1_CORRECT_CHOICE_ID);
    expect(row1.learning!.correctChoice!.letter).toBe("ג");
  });

  it("yields learning: null for un-resolvable items (archived RLS branch)", async () => {
    const { client } = makeChainableMock(defaultResponder);

    const result = await getExamResultsAggregate(
      client as never,
      USER_ID,
      SESSION_ID
    );

    expect(result).not.toBeNull();
    // Position 2 — SOURCE_Q2_ARCHIVED. defaultResponder omits it from
    // BOTH the 360° response AND the choices response, so the aggregate
    // sets learning to null (defensive branch). The row still appears
    // in byPosition with its status preserved.
    const row2 = result!.byPosition[2];
    expect(row2.learning).toBeNull();
    // No attempt was recorded for SOURCE_Q2_ARCHIVED, so it lands as
    // 'unanswered' via computePositionStatuses.
    expect(row2.status).toBe("unanswered");
  });

  it("runs the Learning360 resolver in parallel with the rest (no extra serial round-trip introduced by Slice 17 B-2)", async () => {
    const { client, events } = makeChainableMock(defaultResponder);

    await getExamResultsAggregate(client as never, USER_ID, SESSION_ID);

    // The aggregate's top-level Promise.all kicks off every resolver
    // synchronously. The chapter and text resolvers happen to be
    // serial INTERNALLY (source-then-angle — pre-existing behavior
    // not touched by B-2), so 2 of the 8 in-starts land after the
    // first microtask flush. What B-2 must NOT do is add a new
    // serial step that pushes the learning resolver behind a settle.
    //
    // Direct proof: both the learning resolver's queries — the only
    // ones using SOURCE_SELECT_FULL / ANGLE_SELECT_FULL as their
    // SELECT — must be among the in-starts that precede the FIRST
    // in-settle. If B-2 had been chained after, say, choices, the
    // learning starts would land after the choices' settles.
    const firstSettleIdx = events.findIndex((e) => e.kind === "in-settle");
    expect(firstSettleIdx).toBeGreaterThan(0);

    const startsBeforeFirstSettle = events.slice(0, firstSettleIdx);
    const learningStartsInWave = startsBeforeFirstSettle.filter(
      (e) =>
        e.kind === "in-start" &&
        (e.selectCols === SOURCE_SELECT_FULL ||
          e.selectCols === ANGLE_SELECT_FULL)
    );
    expect(learningStartsInWave).toHaveLength(2);

    // Defensive: ensure the choices resolver (also Promise.all-shaped
    // internally) lands its 2 starts in the same wave too. If it
    // didn't, the test's lower bound would be too lax.
    const choicesStartsInWave = startsBeforeFirstSettle.filter(
      (e) =>
        e.kind === "in-start" &&
        (e.table === "source_choices" || e.table === "angle_choices")
    );
    expect(choicesStartsInWave).toHaveLength(2);

    // Sanity — every table the four .in()-terminated resolvers touch
    // appears at least once.
    const tablesTouched = new Set(events.map((e) => e.table));
    expect(tablesTouched).toContain("source_questions");
    expect(tablesTouched).toContain("angle_questions");
    expect(tablesTouched).toContain("source_choices");
    expect(tablesTouched).toContain("angle_choices");
  });
});
