"use strict";

// Ported from ../../lib/db/exam.ts — only the helpers the exam actions
// call: sampleExamQuestions, getExamSessionById, getQuestionForExamPosition
// (+ the pure bucketer and mappers). Read-only page aggregations
// (getExamResultsAggregate, getExamPositionStatuses, etc.) are not moved.

const { EXAM_TOTAL_QUESTIONS, EXAM_CLUSTERS, clustersForMode } = require("../constants/exam");

// =============================================================================
// Pure sampling helpers (no I/O)
// =============================================================================

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function itemKey(it) {
  return `${it.question_type}:${it.question_id}`;
}

/**
 * Pure bucket + shuffle. Per-cluster pick → global padding → final
 * cross-cluster shuffle. Throws Error("exam_pool_insufficient") when the
 * pool can't cover totalTarget items.
 */
function bucketAndShuffleExamPool(
  pool,
  clusters = EXAM_CLUSTERS,
  totalTarget = EXAM_TOTAL_QUESTIONS
) {
  const picked = new Set();
  const result = [];

  for (const cluster of clusters) {
    const clusterPool = pool.filter((p) =>
      cluster.chapter_codes.includes(p.chapter_code)
    );
    shuffleInPlace(clusterPool);
    let taken = 0;
    for (const item of clusterPool) {
      if (taken >= cluster.target) break;
      const k = itemKey(item);
      if (picked.has(k)) continue;
      picked.add(k);
      result.push(item);
      taken++;
    }
  }

  if (result.length < totalTarget) {
    const leftover = pool.filter((p) => !picked.has(itemKey(p)));
    shuffleInPlace(leftover);
    for (const item of leftover) {
      if (result.length >= totalTarget) break;
      picked.add(itemKey(item));
      result.push(item);
    }
  }

  if (result.length < totalTarget) {
    throw new Error("exam_pool_insufficient");
  }

  shuffleInPlace(result);
  return result;
}

// =============================================================================
// Session fetch + mapping
// =============================================================================

const EXAM_SESSION_SELECT =
  "id, user_id, question_list, total_duration_seconds, time_used_seconds, " +
  "status, questions_answered, questions_correct, final_score, passed, " +
  "active_window_token, started_at, paused_at, completed_at, " +
  "last_activity_at, mode";

function parseQuestionList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (
      item &&
      typeof item === "object" &&
      "question_type" in item &&
      "question_id" in item &&
      "display_order" in item &&
      (item.question_type === "source" || item.question_type === "angle") &&
      typeof item.question_id === "string" &&
      typeof item.display_order === "number"
    ) {
      out.push({
        question_type: item.question_type,
        question_id: item.question_id,
        display_order: item.display_order,
      });
    }
  }
  return out;
}

function parseExamMode(v) {
  if (v === "procedural" || v === "substantive" || v === "combined") return v;
  return "procedural";
}

function mapExamSession(data) {
  return {
    id: data.id,
    user_id: data.user_id,
    question_list: parseQuestionList(data.question_list),
    total_duration_seconds: data.total_duration_seconds,
    time_used_seconds: data.time_used_seconds,
    status: data.status,
    questions_answered: data.questions_answered,
    questions_correct: data.questions_correct,
    final_score: data.final_score ?? null,
    passed: data.passed ?? null,
    active_window_token: data.active_window_token,
    started_at: data.started_at,
    paused_at: data.paused_at ?? null,
    completed_at: data.completed_at ?? null,
    last_activity_at: data.last_activity_at,
    mode: parseExamMode(data.mode),
  };
}

async function getExamSessionById(supabase, userId, sessionId) {
  const { data, error } = await supabase
    .from("exam_sessions")
    .select(EXAM_SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapExamSession(data);
}

// =============================================================================
// Sampling
// =============================================================================

async function sampleExamQuestions(supabase, mode = "procedural") {
  const allowedTracks =
    mode === "procedural"
      ? ["procedural"]
      : mode === "substantive"
        ? ["substantive"]
        : ["procedural", "substantive"];
  const allowedTrackSet = new Set(allowedTracks);

  const baseQuery = supabase
    .from("source_questions")
    .select(
      "id, chapter:chapters!source_questions_chapter_id_fkey!inner(code, track)"
    )
    .eq("is_current", true)
    .eq("status", "active");
  const filteredQuery =
    allowedTracks.length === 1
      ? baseQuery.eq("chapter.track", allowedTracks[0])
      : baseQuery.in("chapter.track", allowedTracks);
  const { data: srcRows, error: srcErr } = await filteredQuery;
  if (srcErr) throw srcErr;

  const sourceById = new Map();
  for (const row of srcRows ?? []) {
    const chapter = Array.isArray(row.chapter) ? row.chapter[0] : row.chapter;
    if (!chapter?.code) continue;
    if (!chapter.track || !allowedTrackSet.has(chapter.track)) continue;
    sourceById.set(row.id, {
      id: row.id,
      chapter_code: chapter.code,
      track: chapter.track,
    });
  }

  const { data: angleRows, error: angleErr } = await supabase
    .from("angle_questions")
    .select("id, source_question_id")
    .in("source_question_id", Array.from(sourceById.keys()));
  if (angleErr) throw angleErr;

  const pool = [];
  for (const src of sourceById.values()) {
    pool.push({
      question_type: "source",
      question_id: src.id,
      chapter_code: src.chapter_code,
      track: src.track,
    });
  }
  for (const ang of angleRows ?? []) {
    const parent = sourceById.get(ang.source_question_id);
    if (!parent) continue;
    pool.push({
      question_type: "angle",
      question_id: ang.id,
      chapter_code: parent.chapter_code,
      track: parent.track,
    });
  }

  const sampled = bucketAndShuffleExamPool(pool, clustersForMode(mode));

  return sampled.map((it, idx) => ({
    question_type: it.question_type,
    question_id: it.question_id,
    display_order: idx + 1,
  }));
}

// =============================================================================
// Per-position question resolution
// =============================================================================

const SOURCE_SELECT_FULL = `
  id, question_group_id, external_id, question_text, chapter_id, subtopic_id,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list,
  chapter:chapters!source_questions_chapter_id_fkey(title),
  subtopic:subtopics!source_questions_subtopic_id_fkey(title)
`;

const ANGLE_SELECT_FULL = `
  id, source_question_id, angle_letter, angle_title, display_order, question_text,
  legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
  quick_thinking_360, summary_for_memory, references_list
`;

const CHOICE_SELECT =
  "id, letter, choice_text, is_correct, distractor_analysis, display_order";

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

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string");
}

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

/**
 * Resolve the question (+ choices) for a single question_list item.
 * Returns {kind:"archived"} if RLS hid the row mid-flight. Choices carry
 * is_correct — the actions use it to derive correctness server-side.
 */
async function getQuestionForExamPosition(supabase, item) {
  if (item.question_type === "source") {
    const [qRes, cRes] = await Promise.all([
      supabase
        .from("source_questions")
        .select(SOURCE_SELECT_FULL)
        .eq("id", item.question_id)
        .maybeSingle(),
      supabase
        .from("source_choices")
        .select(CHOICE_SELECT)
        .eq("source_question_id", item.question_id),
    ]);
    if (qRes.error || !qRes.data) return { kind: "archived" };
    const row = qRes.data;
    const chapter = pickOne(row.chapter);
    const subtopic = pickOne(row.subtopic);
    return {
      kind: "source",
      question: {
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
        concepts_and_skills: toStringArray(row.concepts_and_skills),
        quick_thinking_360: row.quick_thinking_360,
        summary_for_memory: row.summary_for_memory,
        references_list: toStringArray(row.references_list),
        choices: mapChoices(cRes.data ?? []),
      },
    };
  }

  const [aRes, acRes] = await Promise.all([
    supabase
      .from("angle_questions")
      .select(ANGLE_SELECT_FULL)
      .eq("id", item.question_id)
      .maybeSingle(),
    supabase
      .from("angle_choices")
      .select(CHOICE_SELECT)
      .eq("angle_question_id", item.question_id),
  ]);
  if (aRes.error || !aRes.data) return { kind: "archived" };
  const ang = aRes.data;
  if (!isValidAngleLetter(ang.angle_letter)) return { kind: "archived" };

  const { data: parent } = await supabase
    .from("source_questions")
    .select("question_group_id")
    .eq("id", ang.source_question_id)
    .maybeSingle();
  if (!parent) return { kind: "archived" };

  return {
    kind: "angle",
    parentQuestionGroupId: parent.question_group_id,
    question: {
      id: ang.id,
      source_question_id: ang.source_question_id,
      angle_letter: ang.angle_letter,
      angle_title: ang.angle_title,
      display_order: ang.display_order,
      question_text: ang.question_text,
      legal_topic_analysis: ang.legal_topic_analysis,
      full_explanation: ang.full_explanation,
      common_pitfall: ang.common_pitfall,
      concepts_and_skills: toStringArray(ang.concepts_and_skills),
      quick_thinking_360: ang.quick_thinking_360,
      summary_for_memory: ang.summary_for_memory,
      references_list: toStringArray(ang.references_list),
      choices: mapChoices(acRes.data ?? []),
    },
  };
}

module.exports = {
  getExamSessionById,
  sampleExamQuestions,
  getQuestionForExamPosition,
  bucketAndShuffleExamPool,
  shuffleInPlace,
};
