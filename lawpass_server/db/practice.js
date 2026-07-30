"use strict";

// Ported from ../../lib/db/practice.ts + deriveNoteIdentity from
// ../../lib/db/notes.ts. Every function takes an RLS-scoped Supabase
// client (req.supabase) — reads go through RLS, so archived questions
// surface as a distinct {kind:"archived"} state rather than "missing".

// =============================================================================
// JSONB / value narrowing
// =============================================================================

function parseQuestionList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      "id" in item &&
      "position" in item &&
      (item.type === "source" || item.type === "angle") &&
      typeof item.id === "string" &&
      typeof item.position === "number"
    ) {
      out.push({ type: item.type, id: item.id, position: item.position });
    }
  }
  return out;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string");
}

function pickOne(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function isValidLetter(s) {
  return s === "א" || s === "ב" || s === "ג" || s === "ד";
}

function isValidAngleLetter(s) {
  return isValidLetter(s) || s === "ה";
}

function angleLetterOrNull(s) {
  if (s === "א" || s === "ב" || s === "ג" || s === "ד" || s === "ה") return s;
  return null;
}

// =============================================================================
// SELECT fragments
// =============================================================================

const SOURCE_QUESTION_SELECT = `
  id, question_group_id, external_id, question_text, chapter_id, subtopic_id,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_QUESTION_SELECT = `
  id, source_question_id, angle_letter, angle_title, display_order, question_text,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list
`;

const SOURCE_CHOICE_SELECT =
  "id, letter, choice_text, is_correct, distractor_analysis, display_order";
const ANGLE_CHOICE_SELECT = SOURCE_CHOICE_SELECT;

const SESSION_COLS =
  "id, user_id, selected_chapters, selected_subtopics, source_count_target, angles_per_source, time_per_question_seconds, session_duration_seconds, question_list, status, questions_answered, questions_correct, started_at, completed_at, last_activity_at";

// =============================================================================
// Mappers
// =============================================================================

function mapChoices(rows) {
  return (rows || [])
    .filter((r) => isValidLetter(r.letter))
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => ({
      id: r.id,
      letter: r.letter,
      choice_text: r.choice_text,
      is_correct: r.is_correct,
      distractor_analysis: r.distractor_analysis,
      display_order: r.display_order,
    }));
}

function mapSource(row, choices) {
  const chapter = pickOne(row.chapter);
  const subtopic = pickOne(row.subtopic);
  return {
    id: row.id,
    question_group_id: row.question_group_id,
    external_id: row.external_id,
    question_text: row.question_text,
    chapter_id: row.chapter_id,
    subtopic_id: row.subtopic_id,
    chapter_title: chapter?.title ?? "",
    subtopic_title: subtopic?.title ?? "",
    legal_topic_analysis: row.legal_topic_analysis,
    full_explanation: row.full_explanation,
    common_pitfall: row.common_pitfall,
    concepts_and_skills: asStringArray(row.concepts_and_skills),
    quick_thinking_360: row.quick_thinking_360,
    summary_for_memory: row.summary_for_memory,
    references_list: asStringArray(row.references_list),
    choices,
  };
}

function mapAngle(row, choices) {
  if (!isValidAngleLetter(row.angle_letter)) return null;
  return {
    id: row.id,
    source_question_id: row.source_question_id,
    angle_letter: row.angle_letter,
    angle_title: row.angle_title,
    display_order: row.display_order,
    question_text: row.question_text,
    legal_topic_analysis: row.legal_topic_analysis,
    full_explanation: row.full_explanation,
    common_pitfall: row.common_pitfall,
    concepts_and_skills: asStringArray(row.concepts_and_skills),
    quick_thinking_360: row.quick_thinking_360,
    summary_for_memory: row.summary_for_memory,
    references_list: asStringArray(row.references_list),
    choices,
  };
}

function mapSessionRow(data) {
  return {
    id: data.id,
    user_id: data.user_id,
    selected_chapters: asStringArray(data.selected_chapters),
    selected_subtopics: asStringArray(data.selected_subtopics),
    source_count_target: data.source_count_target,
    angles_per_source: data.angles_per_source,
    time_per_question_seconds: data.time_per_question_seconds,
    session_duration_seconds:
      typeof data.session_duration_seconds === "number"
        ? data.session_duration_seconds
        : 0,
    question_list: parseQuestionList(data.question_list),
    status: data.status,
    questions_answered: data.questions_answered,
    questions_correct: data.questions_correct,
    started_at: data.started_at,
    completed_at: data.completed_at,
    last_activity_at: data.last_activity_at,
  };
}

// =============================================================================
// Session reads
// =============================================================================

async function getSessionForUser(supabase, userId, sessionId) {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(SESSION_COLS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const status = data.status;
  if (status !== "active" && status !== "completed" && status !== "abandoned") {
    return null;
  }
  return mapSessionRow(data);
}

/**
 * Resolves the question at `position` in session.question_list. Returns
 * one of: {kind:"source"|"angle"|"archived"|"out_of_range"}.
 */
async function getQuestionForPosition(supabase, session, position) {
  if (position < 0 || position >= session.question_list.length) {
    return { kind: "out_of_range", session };
  }

  const item = session.question_list[position];

  if (item.type === "source") {
    const [questionResult, choicesResult] = await Promise.all([
      supabase
        .from("source_questions")
        .select(SOURCE_QUESTION_SELECT)
        .eq("id", item.id)
        .maybeSingle(),
      supabase
        .from("source_choices")
        .select(SOURCE_CHOICE_SELECT)
        .eq("source_question_id", item.id),
    ]);

    if (questionResult.error || !questionResult.data) {
      return { kind: "archived", session, position };
    }
    const choices = mapChoices(choicesResult.data ?? []);
    return {
      kind: "source",
      session,
      question: mapSource(questionResult.data, choices),
    };
  }

  const [angleResult, angleChoicesResult] = await Promise.all([
    supabase
      .from("angle_questions")
      .select(ANGLE_QUESTION_SELECT)
      .eq("id", item.id)
      .maybeSingle(),
    supabase
      .from("angle_choices")
      .select(ANGLE_CHOICE_SELECT)
      .eq("angle_question_id", item.id),
  ]);

  if (angleResult.error || !angleResult.data) {
    return { kind: "archived", session, position };
  }

  const angleChoices = mapChoices(angleChoicesResult.data ?? []);
  const angle = mapAngle(angleResult.data, angleChoices);
  if (!angle) {
    return { kind: "archived", session, position };
  }

  const [parentResult, parentChoicesResult] = await Promise.all([
    supabase
      .from("source_questions")
      .select(SOURCE_QUESTION_SELECT)
      .eq("id", angle.source_question_id)
      .maybeSingle(),
    supabase
      .from("source_choices")
      .select(SOURCE_CHOICE_SELECT)
      .eq("source_question_id", angle.source_question_id),
  ]);

  if (parentResult.error || !parentResult.data) {
    return { kind: "archived", session, position };
  }

  const parentChoices = mapChoices(parentChoicesResult.data ?? []);
  const parentSource = mapSource(parentResult.data, parentChoices);

  return { kind: "angle", session, question: angle, parentSource };
}

/** The user's prior attempt for this (session, question) pair, or null. */
async function getExistingAttempt(supabase, userId, sessionId, resolved) {
  if (resolved.kind !== "source" && resolved.kind !== "angle") return null;

  const query = supabase
    .from("attempts")
    .select(
      "id, question_type, source_question_id, angle_question_id, selected_choice_id, selected_letter, is_correct, duration_seconds, was_skipped, attempted_at"
    )
    .eq("user_id", userId)
    .eq("practice_session_id", sessionId);

  if (resolved.kind === "source") {
    query.eq("question_type", "source").eq(
      "source_question_id",
      resolved.question.id
    );
  } else {
    query.eq("question_type", "angle").eq(
      "angle_question_id",
      resolved.question.id
    );
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const letter =
    data.selected_letter && isValidLetter(data.selected_letter)
      ? data.selected_letter
      : null;

  return {
    id: data.id,
    question_type: data.question_type,
    source_question_id: data.source_question_id,
    angle_question_id: data.angle_question_id,
    selected_choice_id: data.selected_choice_id,
    selected_letter: letter,
    is_correct: data.is_correct,
    duration_seconds: data.duration_seconds,
    was_skipped: data.was_skipped,
    attempted_at: data.attempted_at,
  };
}

// =============================================================================
// Note identity (from lib/db/notes.ts)
// =============================================================================

function deriveNoteIdentity(resolved) {
  if (resolved.kind === "source") {
    return {
      question_type: "source",
      source_question_group_id: resolved.question.question_group_id,
      angle_position: null,
    };
  }
  if (resolved.kind === "angle") {
    const position = resolved.question.display_order;
    if (
      !Number.isFinite(position) ||
      position < 1 ||
      position > 5 ||
      !Number.isInteger(position)
    ) {
      return null;
    }
    return {
      question_type: "angle",
      source_question_group_id: resolved.parentSource.question_group_id,
      angle_position: position,
    };
  }
  return null;
}

// =============================================================================
// Bookmarks + mistakes list loaders (used by createBatchReviewSession)
// =============================================================================

const PREVIEW_MAX_CHARS = 200;
function truncatePreview(text) {
  if (text.length <= PREVIEW_MAX_CHARS) return text;
  return text.slice(0, PREVIEW_MAX_CHARS).trimEnd() + "…";
}

const SOURCE_PREVIEW_SELECT = `
  id, question_group_id, external_id, question_text, chapter_id,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_PREVIEW_SELECT = `
  id, angle_letter, angle_title, question_text, display_order,
  source_question:source_questions!angle_questions_source_question_id_fkey(
    id, question_group_id, external_id, chapter_id,
    chapter:chapters!source_questions_chapter_id_fkey(title),
    subtopic:subtopics!source_questions_subtopic_id_fkey(title)
  )
`;

function mapSourcePreview(row, questionGroupId) {
  if (!row) {
    return {
      id: "",
      questionGroupId,
      externalId: "",
      questionText: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
    };
  }
  const chapter = pickOne(row.chapter);
  const subtopic = pickOne(row.subtopic);
  return {
    id: row.id,
    questionGroupId: row.question_group_id,
    externalId: row.external_id,
    questionText: truncatePreview(row.question_text),
    chapterId: row.chapter_id,
    chapterTitle: chapter?.title ?? "",
    subtopicTitle: subtopic?.title ?? "",
    isArchived: false,
  };
}

function mapAnglePreview(row, angleQuestionId) {
  if (!row) {
    return {
      id: angleQuestionId,
      angleLetter: "א",
      angleTitle: null,
      questionText: "",
      parentSourceExternalId: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
      parentQuestionGroupId: "",
      displayOrder: null,
    };
  }
  const letter = angleLetterOrNull(row.angle_letter) ?? "א";
  const parent = pickOne(row.source_question);
  if (!parent) {
    return {
      id: row.id,
      angleLetter: letter,
      angleTitle: row.angle_title,
      questionText: truncatePreview(row.question_text),
      parentSourceExternalId: "",
      chapterId: "",
      chapterTitle: "",
      subtopicTitle: "",
      isArchived: true,
      parentQuestionGroupId: "",
      displayOrder: row.display_order ?? null,
    };
  }
  const chapter = pickOne(parent.chapter);
  const subtopic = pickOne(parent.subtopic);
  return {
    id: row.id,
    angleLetter: letter,
    angleTitle: row.angle_title,
    questionText: truncatePreview(row.question_text),
    parentSourceExternalId: parent.external_id,
    chapterId: parent.chapter_id,
    chapterTitle: chapter?.title ?? "",
    subtopicTitle: subtopic?.title ?? "",
    isArchived: false,
    parentQuestionGroupId: parent.question_group_id,
    displayOrder: row.display_order,
  };
}

async function loadPreviewMaps(supabase, groupIds, angleIds) {
  const sources = new Map();
  const angles = new Map();

  const sourcesPromise =
    groupIds.length > 0
      ? supabase
          .from("source_questions")
          .select(SOURCE_PREVIEW_SELECT)
          .in("question_group_id", groupIds)
          .eq("is_current", true)
      : null;

  const anglesPromise =
    angleIds.length > 0
      ? supabase
          .from("angle_questions")
          .select(ANGLE_PREVIEW_SELECT)
          .in("id", angleIds)
      : null;

  const [sourcesResult, anglesResult] = await Promise.all([
    sourcesPromise,
    anglesPromise,
  ]);

  if (sourcesResult?.data) {
    for (const row of sourcesResult.data) {
      sources.set(row.question_group_id, row);
    }
  }
  if (anglesResult?.data) {
    for (const row of anglesResult.data) {
      angles.set(row.id, row);
    }
  }

  return { sources, angles };
}

/**
 * Given the user's mistaked/bookmarked question ids, returns the subset
 * whose most recent attempt was correct (= "resolved", hidden at read
 * time). Source rows key on question_group_id → resolved via
 * source_questions to the attempt's source_question_id.
 */
async function findResolvedQuestions(supabase, userId, groupIds, angleIds, options) {
  const resolvedGroupIds = new Set();
  const resolvedAngleIds = new Set();

  if (groupIds.length === 0 && angleIds.length === 0) {
    return { resolvedGroupIds, resolvedAngleIds };
  }

  let groupToId = options?.sourceGroupToCurrentId;
  if (!groupToId) {
    groupToId = new Map();
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from("source_questions")
        .select("id, question_group_id")
        .in("question_group_id", groupIds)
        .eq("is_current", true);
      for (const row of data ?? []) {
        groupToId.set(row.question_group_id, row.id);
      }
    }
  }
  const currentSourceIds = Array.from(groupToId.values());
  const idToGroup = new Map();
  for (const [g, id] of groupToId) idToGroup.set(id, g);

  const [sourceAttemptsRes, angleAttemptsRes] = await Promise.all([
    currentSourceIds.length > 0
      ? supabase
          .from("attempts")
          .select("source_question_id, is_correct, attempted_at")
          .eq("user_id", userId)
          .eq("question_type", "source")
          .in("source_question_id", currentSourceIds)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    angleIds.length > 0
      ? supabase
          .from("attempts")
          .select("angle_question_id, is_correct, attempted_at")
          .eq("user_id", userId)
          .eq("question_type", "angle")
          .in("angle_question_id", angleIds)
          .order("attempted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const seenSourceIds = new Set();
  for (const a of sourceAttemptsRes.data ?? []) {
    if (!a.source_question_id) continue;
    if (seenSourceIds.has(a.source_question_id)) continue;
    seenSourceIds.add(a.source_question_id);
    if (a.is_correct === true) {
      const groupId = idToGroup.get(a.source_question_id);
      if (groupId) resolvedGroupIds.add(groupId);
    }
  }

  const seenAngleIds = new Set();
  for (const a of angleAttemptsRes.data ?? []) {
    if (!a.angle_question_id) continue;
    if (seenAngleIds.has(a.angle_question_id)) continue;
    seenAngleIds.add(a.angle_question_id);
    if (a.is_correct === true) {
      resolvedAngleIds.add(a.angle_question_id);
    }
  }

  return { resolvedGroupIds, resolvedAngleIds };
}

async function getUserBookmarks(supabase, userId) {
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      "id, question_type, source_question_group_id, angle_question_id, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data;
  const groupIds = [];
  const angleIds = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      groupIds.push(r.source_question_group_id);
    } else if (r.question_type === "angle" && r.angle_question_id) {
      angleIds.push(r.angle_question_id);
    }
  }

  const { sources, angles } = await loadPreviewMaps(supabase, groupIds, angleIds);

  const sourceGroupToCurrentId = new Map();
  for (const [groupId, row] of sources) {
    sourceGroupToCurrentId.set(groupId, row.id);
  }
  const { resolvedGroupIds, resolvedAngleIds } = await findResolvedQuestions(
    supabase,
    userId,
    groupIds,
    angleIds,
    { sourceGroupToCurrentId }
  );

  const out = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      if (resolvedGroupIds.has(r.source_question_group_id)) continue;
      out.push({
        bookmarkId: r.id,
        questionType: "source",
        createdAt: r.created_at,
        sourceQuestion: mapSourcePreview(
          sources.get(r.source_question_group_id),
          r.source_question_group_id
        ),
      });
    } else if (r.question_type === "angle" && r.angle_question_id) {
      if (resolvedAngleIds.has(r.angle_question_id)) continue;
      out.push({
        bookmarkId: r.id,
        questionType: "angle",
        createdAt: r.created_at,
        angleQuestion: mapAnglePreview(
          angles.get(r.angle_question_id),
          r.angle_question_id
        ),
      });
    }
  }
  return out;
}

async function getUserMistakes(supabase, userId) {
  const { data, error } = await supabase
    .from("mistakes")
    .select(
      "id, question_type, source_question_group_id, angle_question_id, mistakes_count, last_mistake_at, first_mistake_at"
    )
    .eq("user_id", userId)
    .eq("manually_removed", false)
    .order("last_mistake_at", { ascending: false });

  if (error || !data) return [];

  const rows = data;
  const groupIds = [];
  const angleIds = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      groupIds.push(r.source_question_group_id);
    } else if (r.question_type === "angle" && r.angle_question_id) {
      angleIds.push(r.angle_question_id);
    }
  }

  const { sources, angles } = await loadPreviewMaps(supabase, groupIds, angleIds);

  const sourceGroupToCurrentId = new Map();
  for (const [groupId, row] of sources) {
    sourceGroupToCurrentId.set(groupId, row.id);
  }
  const { resolvedGroupIds, resolvedAngleIds } = await findResolvedQuestions(
    supabase,
    userId,
    groupIds,
    angleIds,
    { sourceGroupToCurrentId }
  );

  const out = [];
  for (const r of rows) {
    if (r.question_type === "source" && r.source_question_group_id) {
      if (resolvedGroupIds.has(r.source_question_group_id)) continue;
      out.push({
        mistakeId: r.id,
        questionType: "source",
        mistakesCount: r.mistakes_count,
        lastMistakeAt: r.last_mistake_at,
        firstMistakeAt: r.first_mistake_at,
        sourceQuestion: mapSourcePreview(
          sources.get(r.source_question_group_id),
          r.source_question_group_id
        ),
      });
    } else if (r.question_type === "angle" && r.angle_question_id) {
      if (resolvedAngleIds.has(r.angle_question_id)) continue;
      out.push({
        mistakeId: r.id,
        questionType: "angle",
        mistakesCount: r.mistakes_count,
        lastMistakeAt: r.last_mistake_at,
        firstMistakeAt: r.first_mistake_at,
        angleQuestion: mapAnglePreview(
          angles.get(r.angle_question_id),
          r.angle_question_id
        ),
      });
    }
  }
  return out;
}

module.exports = {
  getSessionForUser,
  getQuestionForPosition,
  getExistingAttempt,
  deriveNoteIdentity,
  getUserBookmarks,
  getUserMistakes,
};
