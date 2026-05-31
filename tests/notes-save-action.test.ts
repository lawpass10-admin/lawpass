/**
 * Slice 25 B-1 + Slice 25.2 — contract tests for `saveNote`.
 *
 * Slice 25.2 bugfix: source notes (angle_position=NULL) can't use
 * `.upsert(onConflict)` because Postgres' default UNIQUE treats
 * NULL values as distinct, so the conflict never matches an
 * existing row and every save creates a duplicate. The action now
 * splits on identity:
 *   - SOURCE: manual emulate-UPSERT (lookup → UPDATE+cleanup, or
 *     INSERT when no row exists)
 *   - ANGLE: keep the simpler upsert+onConflict path
 *
 * The chainable mock below captures every `from(...).method(...)`
 * call so the tests can assert the right SQL shape for each path.
 *
 * Slice 25.2 also adds a round-trip identity test: the columns
 * `saveNote` writes match the columns `getNoteForPosition` reads
 * for the same `ResolvedQuestion`. A drift between the two would
 * silently lose notes — the most-load-bearing invariant in this
 * subsystem.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/db/practice", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/db/practice")>(
      "@/lib/db/practice"
    );
  return {
    ...actual,
    getSessionForUser: vi.fn(),
    getQuestionForPosition: vi.fn(),
  };
});

import { saveNote } from "@/app/(app)/practice/play/_actions";
import { getNoteForPosition } from "@/lib/db/notes";
import {
  getQuestionForPosition,
  getSessionForUser,
  type PracticeSessionRow,
  type ResolvedQuestion,
  type SourceQuestionRow,
} from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_GROUP_ID = "33333333-3333-4333-8333-333333333333";

// =============================================================================
// Chainable supabase mock — broad enough to cover both action paths
// =============================================================================
//
// Records every `.insert(...)` / `.update(...)` / `.delete()` /
// `.upsert(...)` payload + every chained `.eq/.is/.neq/.order/.limit`
// per call. Each chain instance also remembers its row response so
// terminators (`.maybeSingle()`, `.single()`, `.then()`) can resolve
// in line with the action's expectations.

type Filter = ["eq" | "is" | "neq", string, unknown];

type Capture = {
  table: string;
  method:
    | "select"
    | "insert"
    | "update"
    | "delete"
    | "upsert"
    | null;
  payload?: unknown;
  options?: Record<string, unknown>;
  selectCols?: string;
  filters: Filter[];
  orderBy?: { col: string; ascending?: boolean };
  limit?: number;
};

type Responder = (q: Capture) => {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

function makeMock(responder: Responder) {
  const captures: Capture[] = [];

  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
    from(table: string) {
      const capture: Capture = { table, method: null, filters: [] };
      captures.push(capture);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = (cols: string) => {
        if (capture.method === null) capture.method = "select";
        capture.selectCols = cols;
        return chain;
      };
      chain.insert = (payload: unknown) => {
        capture.method = "insert";
        capture.payload = payload;
        return chain;
      };
      chain.update = (payload: unknown) => {
        capture.method = "update";
        capture.payload = payload;
        return chain;
      };
      chain.delete = () => {
        capture.method = "delete";
        return chain;
      };
      chain.upsert = (payload: unknown, options?: Record<string, unknown>) => {
        capture.method = "upsert";
        capture.payload = payload;
        capture.options = options;
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        capture.filters.push(["eq", col, val]);
        return chain;
      };
      chain.is = (col: string, val: unknown) => {
        capture.filters.push(["is", col, val]);
        return chain;
      };
      chain.neq = (col: string, val: unknown) => {
        capture.filters.push(["neq", col, val]);
        return chain;
      };
      chain.order = (col: string, opts?: { ascending?: boolean }) => {
        capture.orderBy = { col, ascending: opts?.ascending };
        return chain;
      };
      chain.limit = (n: number) => {
        capture.limit = n;
        return chain;
      };
      chain.single = () => Promise.resolve(responder(capture));
      chain.maybeSingle = () => Promise.resolve(responder(capture));
      chain.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => Promise.resolve(responder(capture)).then(onFulfilled, onRejected);
      return chain;
    },
  };

  return { client, captures };
}

// =============================================================================
// Fixtures
// =============================================================================

const SESSION = {
  id: SESSION_ID,
  user_id: USER_ID,
  status: "active",
} as PracticeSessionRow;

function fakeSource(): SourceQuestionRow {
  return {
    id: "src-id",
    question_group_id: SOURCE_GROUP_ID,
    external_id: "ext",
    question_text: "q",
    chapter_id: "ch",
    subtopic_id: "st",
    chapter_title: "ch title",
    subtopic_title: "st title",
    choices: [],
    legal_topic_analysis: "",
    full_explanation: "",
    common_pitfall: "",
    concepts_and_skills: [],
    quick_thinking_360: "",
    summary_for_memory: "",
    references_list: [],
  };
}

const RESOLVED_SOURCE: ResolvedQuestion = {
  kind: "source",
  question: fakeSource(),
  session: SESSION,
};

const RESOLVED_ANGLE: ResolvedQuestion = {
  kind: "angle",
  question: {
    id: "angle-id",
    source_question_id: "src-id",
    angle_letter: "ב",
    angle_title: null,
    display_order: 2,
    question_text: "q",
    choices: [],
    legal_topic_analysis: "",
    full_explanation: "",
    common_pitfall: "",
    concepts_and_skills: [],
    quick_thinking_360: "",
    summary_for_memory: "",
    references_list: [],
  },
  parentSource: fakeSource(),
  session: SESSION,
};

const SAMPLE_JSON = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "hello" }],
    },
  ],
};

beforeEach(() => {
  vi.mocked(getSessionForUser).mockResolvedValue(SESSION);
});

afterEach(() => {
  vi.resetAllMocks();
});

// =============================================================================
// SOURCE notes — Slice 25.2 emulated-UPSERT path
// =============================================================================

describe("saveNote — Slice 25.2 SOURCE branch", () => {
  it("INSERTs when no existing source row is found", async () => {
    // First call (the lookup) returns no row; the insert succeeds.
    const responder: Responder = (q) => {
      if (q.method === "select") return { data: [], error: null };
      if (q.method === "insert")
        return { data: { updated_at: "2026-06-01T00:00:00Z" }, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_SOURCE);

    const result = await saveNote({
      sessionId: SESSION_ID,
      position: 0,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>hello</p>",
    });

    expect(result.ok).toBe(true);

    // 1) lookup SELECT with the exact identity columns + ordered by
    //    updated_at desc + limit 1. Filters: user_id eq, type eq
    //    'source', group_id eq, angle_position IS NULL.
    const lookup = captures.find(
      (c) => c.table === "question_notes" && c.method === "select"
    );
    expect(lookup).toBeDefined();
    expect(lookup!.filters).toContainEqual(["eq", "user_id", USER_ID]);
    expect(lookup!.filters).toContainEqual(["eq", "question_type", "source"]);
    expect(lookup!.filters).toContainEqual([
      "eq",
      "source_question_group_id",
      SOURCE_GROUP_ID,
    ]);
    expect(lookup!.filters).toContainEqual(["is", "angle_position", null]);
    expect(lookup!.orderBy).toEqual({ col: "updated_at", ascending: false });
    expect(lookup!.limit).toBe(1);

    // 2) INSERT with the full payload
    const insert = captures.find(
      (c) => c.table === "question_notes" && c.method === "insert"
    );
    expect(insert).toBeDefined();
    expect(insert!.payload).toMatchObject({
      user_id: USER_ID,
      question_type: "source",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: null,
      content_json: SAMPLE_JSON,
      content_html: "<p>hello</p>",
    });
  });

  it("UPDATEs the existing row + DELETEs duplicates when one already exists", async () => {
    // Lookup returns one row; the UPDATE succeeds; the cleanup
    // DELETE succeeds.
    const responder: Responder = (q) => {
      if (q.method === "select")
        return { data: [{ id: "row-id-1" }], error: null };
      if (q.method === "update")
        return { data: { updated_at: "2026-06-01T00:00:00Z" }, error: null };
      if (q.method === "delete") return { data: null, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_SOURCE);

    const result = await saveNote({
      sessionId: SESSION_ID,
      position: 0,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>hello</p>",
    });

    expect(result.ok).toBe(true);

    // UPDATE targets the row by id
    const update = captures.find(
      (c) => c.table === "question_notes" && c.method === "update"
    );
    expect(update).toBeDefined();
    expect(update!.payload).toMatchObject({
      content_json: SAMPLE_JSON,
      content_html: "<p>hello</p>",
    });
    expect(update!.filters).toContainEqual(["eq", "id", "row-id-1"]);

    // DELETE prunes older duplicates: same identity + .neq("id", row).
    const cleanup = captures.find(
      (c) => c.table === "question_notes" && c.method === "delete"
    );
    expect(cleanup).toBeDefined();
    expect(cleanup!.filters).toContainEqual(["eq", "user_id", USER_ID]);
    expect(cleanup!.filters).toContainEqual(["eq", "question_type", "source"]);
    expect(cleanup!.filters).toContainEqual([
      "eq",
      "source_question_group_id",
      SOURCE_GROUP_ID,
    ]);
    expect(cleanup!.filters).toContainEqual(["is", "angle_position", null]);
    expect(cleanup!.filters).toContainEqual(["neq", "id", "row-id-1"]);
  });
});

// =============================================================================
// ANGLE notes — unchanged onConflict-backed upsert
// =============================================================================

describe("saveNote — ANGLE branch", () => {
  it("upserts an ANGLE note with parent group_id + display_order as angle_position", async () => {
    const responder: Responder = (q) => {
      if (q.method === "upsert")
        return { data: { updated_at: "2026-06-01T00:00:00Z" }, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_ANGLE);

    const result = await saveNote({
      sessionId: SESSION_ID,
      position: 1,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>angle note</p>",
    });

    expect(result.ok).toBe(true);
    const upsert = captures.find(
      (c) => c.table === "question_notes" && c.method === "upsert"
    );
    expect(upsert).toBeDefined();
    expect(upsert!.payload).toMatchObject({
      question_type: "angle",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: 2,
    });
    // Critical: the angle note keys on the PARENT's group_id + the
    // angle's display_order, NOT the angle's own UUID.
    expect(
      (upsert!.payload as Record<string, unknown>).source_question_group_id
    ).not.toBe("angle-id");
    expect(upsert!.options?.onConflict).toBe(
      "user_id,question_type,source_question_group_id,angle_position"
    );
  });
});

// =============================================================================
// Zod
// =============================================================================

describe("saveNote — schema validation", () => {
  it("returns ok:false when zod fails (e.g. malformed sessionId)", async () => {
    const { client } = makeMock(() => ({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_SOURCE);

    const result = await saveNote({
      sessionId: "not-a-uuid",
      position: 0,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>hello</p>",
    });

    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Slice 25.2 — Round-trip identity invariant
// =============================================================================
//
// The single most-load-bearing assertion in this subsystem: the
// columns saveNote writes for a given ResolvedQuestion must be the
// same columns getNoteForPosition reads. A drift between the two
// silently swallows saved notes.

describe("Notes — identity round-trip (Slice 25.2)", () => {
  it("SOURCE: read filters match write columns", async () => {
    // Drive both halves through the chainable mock.
    const SAMPLE_ROW = {
      id: "row-id",
      question_type: "source",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: null,
      content_json: SAMPLE_JSON,
      content_html: "<p>hi</p>",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    const responder: Responder = (q) => {
      // saveNote's lookup selects only "id"; getNoteForPosition's
      // read selects the full NOTE_SELECT_COLS (which includes
      // "content_json"). We distinguish on that so the SAVE path
      // sees "no existing row" → INSERT, and the READ path sees
      // the sample row we want back.
      if (q.method === "select") {
        if ((q.selectCols ?? "").includes("content_json")) {
          return { data: [SAMPLE_ROW], error: null };
        }
        return { data: [], error: null };
      }
      if (q.method === "insert")
        return { data: { updated_at: "2026-06-01T00:00:00Z" }, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_SOURCE);

    // 1. Save a note.
    const saved = await saveNote({
      sessionId: SESSION_ID,
      position: 0,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>hi</p>",
    });
    expect(saved.ok).toBe(true);

    // 2. Read it back via getNoteForPosition.
    const note = await getNoteForPosition(
      client as never,
      USER_ID,
      RESOLVED_SOURCE
    );
    expect(note).not.toBeNull();
    expect(note!.source_question_group_id).toBe(SOURCE_GROUP_ID);
    expect(note!.angle_position).toBeNull();

    // 3. Identity columns from the write match the filter columns
    //    used by the read.
    const insertPayload = captures.find(
      (c) =>
        c.table === "question_notes" &&
        c.method === "insert" &&
        c.payload !== undefined
    )!.payload as Record<string, unknown>;
    const readLookup = captures.find(
      (c) =>
        c.table === "question_notes" &&
        c.method === "select" &&
        c.orderBy?.col === "updated_at" &&
        c.limit === 1
    )!;
    expect(insertPayload.user_id).toBe(USER_ID);
    expect(insertPayload.question_type).toBe("source");
    expect(insertPayload.source_question_group_id).toBe(SOURCE_GROUP_ID);
    expect(insertPayload.angle_position).toBeNull();
    expect(readLookup.filters).toContainEqual(["eq", "user_id", USER_ID]);
    expect(readLookup.filters).toContainEqual([
      "eq",
      "question_type",
      "source",
    ]);
    expect(readLookup.filters).toContainEqual([
      "eq",
      "source_question_group_id",
      SOURCE_GROUP_ID,
    ]);
    expect(readLookup.filters).toContainEqual(["is", "angle_position", null]);
  });

  it("ANGLE: read filters match write columns", async () => {
    const SAMPLE_ROW = {
      id: "row-id",
      question_type: "angle",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: 2,
      content_json: SAMPLE_JSON,
      content_html: "<p>angle</p>",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    const responder: Responder = (q) => {
      // Read path: ordered select returns the sample row.
      if (q.method === "select" && q.orderBy && q.limit === 1) {
        return { data: [SAMPLE_ROW], error: null };
      }
      // Save path: upsert returns updated_at.
      if (q.method === "upsert")
        return { data: { updated_at: "2026-06-01T00:00:00Z" }, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_ANGLE);

    const saved = await saveNote({
      sessionId: SESSION_ID,
      position: 1,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>angle</p>",
    });
    expect(saved.ok).toBe(true);

    const note = await getNoteForPosition(
      client as never,
      USER_ID,
      RESOLVED_ANGLE
    );
    expect(note).not.toBeNull();
    expect(note!.angle_position).toBe(2);

    const upsertPayload = captures.find(
      (c) => c.method === "upsert" && c.payload !== undefined
    )!.payload as Record<string, unknown>;
    const readLookup = captures.find(
      (c) =>
        c.table === "question_notes" &&
        c.method === "select" &&
        c.orderBy?.col === "updated_at" &&
        c.limit === 1
    )!;
    expect(upsertPayload.question_type).toBe("angle");
    expect(upsertPayload.angle_position).toBe(2);
    expect(readLookup.filters).toContainEqual(["eq", "question_type", "angle"]);
    expect(readLookup.filters).toContainEqual([
      "eq",
      "angle_position",
      2,
    ]);
  });
});
