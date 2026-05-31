/**
 * Slice 25 B-1 — contract test for `saveNote`. Verifies the action
 * resolves the question at (sessionId, position) and UPSERTs against
 * the question_notes table with the right `(question_type,
 * source_question_group_id, angle_position)` identity + the right
 * onConflict columns. Mirrors the chainable-supabase mock pattern
 * from tests/practice-create-session-session-timer.test.ts.
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
// Chainable supabase mock with upsert capture
// =============================================================================

type UpsertCapture = {
  table: string;
  payload: Record<string, unknown>;
  options: Record<string, unknown> | undefined;
};

function makeUpsertMock(
  upsertResult: { data: unknown; error: unknown } = {
    data: { updated_at: "2026-06-01T00:00:00Z" },
    error: null,
  }
) {
  const upserts: UpsertCapture[] = [];

  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.upsert = (
        payload: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => {
        upserts.push({ table, payload, options });
        chain.__lastUpsertResult = upsertResult;
        return chain;
      };
      chain.select = () => chain;
      chain.single = () => Promise.resolve(chain.__lastUpsertResult);
      return chain;
    },
  };
  return { client, upserts };
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
// Tests
// =============================================================================

describe("saveNote — Slice 25 B-1", () => {
  it("upserts a SOURCE note with question_group_id + null angle_position", async () => {
    const { client, upserts } = makeUpsertMock();
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_SOURCE);

    const result = await saveNote({
      sessionId: SESSION_ID,
      position: 0,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>hello</p>",
    });

    expect(result.ok).toBe(true);
    expect(upserts).toHaveLength(1);
    const u = upserts[0];
    expect(u.table).toBe("question_notes");
    expect(u.payload).toMatchObject({
      user_id: USER_ID,
      question_type: "source",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: null,
      content_json: SAMPLE_JSON,
      content_html: "<p>hello</p>",
    });
    // The UNIQUE constraint columns must be passed as `onConflict`
    // so the UPSERT picks the right index.
    expect(u.options?.onConflict).toBe(
      "user_id,question_type,source_question_group_id,angle_position"
    );
  });

  it("upserts an ANGLE note with parent group_id + display_order as angle_position", async () => {
    const { client, upserts } = makeUpsertMock();
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(getQuestionForPosition).mockResolvedValue(RESOLVED_ANGLE);

    const result = await saveNote({
      sessionId: SESSION_ID,
      position: 1,
      contentJson: SAMPLE_JSON,
      contentHtml: "<p>angle note</p>",
    });

    expect(result.ok).toBe(true);
    const u = upserts[0];
    // The most-critical assertion in this slice: the angle note
    // keys on the PARENT's question_group_id (group survives angle
    // versioning) and the angle's display_order, NOT the angle's
    // own UUID.
    expect(u.payload).toMatchObject({
      question_type: "angle",
      source_question_group_id: SOURCE_GROUP_ID,
      angle_position: 2,
    });
    expect(u.payload.source_question_group_id).not.toBe("angle-id");
  });

  it("returns ok:false when zod fails (e.g. malformed sessionId)", async () => {
    const { client } = makeUpsertMock();
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
