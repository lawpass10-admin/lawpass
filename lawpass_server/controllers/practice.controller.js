"use strict";

// Ported from ../../app/(app)/practice/_actions.ts and
// ../../app/(app)/practice/play/_actions.ts. The only Next-specific bits
// dropped are `revalidatePath` (a cache hint with no server-side
// equivalent) and the redirect-based subscription gate (now the
// requireSubscription middleware). Auth context comes from the
// authenticate middleware: req.user + req.supabase (RLS-scoped).

const db = require("../db/practice");

// URL helpers (from ../../lib/urls.ts) — the frontend consumes these to
// navigate after a mutation, same as with the server actions.
function practicePlayUrl(sessionId, position) {
  return `/practice/play/${position}?session=${sessionId}`;
}
function practiceSummaryUrl(sessionId) {
  return `/practice/summary?session=${sessionId}`;
}

// Fisher-Yates in-place shuffle. Math.random() is fine for picking
// practice questions.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clampDuration(s) {
  return Math.max(0, Math.min(600, Math.round(s)));
}

// =============================================================================
// Builder endpoints (subscription-gated)
// =============================================================================

async function getAvailableQuestionCount(req, res) {
  const supabase = req.supabase;
  const data = req.valid;

  let query = supabase
    .from("source_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("is_current", true)
    .in("chapter_id", data.chapterIds);

  if (data.subtopicId) {
    query = query.eq("subtopic_id", data.subtopicId);
  }

  const { count, error } = await query;
  if (error) {
    console.error(
      `[practice] available_count FAILED code=${error.code ?? "unknown"} message=${error.message}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה. נסה שוב" });
  }

  return res.json({ ok: true, count: count ?? 0 });
}

async function createPracticeSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const data = req.valid;

  try {
    // Defensive: abandon any active session before creating a new one.
    await supabase
      .from("practice_sessions")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    const targetTotal =
      data.totalQuestions ??
      data.sourceCountTarget * (1 + data.anglesPerSource);

    // Step 1 — source-question candidate pool.
    let pool = supabase
      .from("source_questions")
      .select("id, question_group_id")
      .eq("status", "active")
      .eq("is_current", true)
      .in("chapter_id", data.selectedChapterIds);
    if (data.selectedSubtopicId) {
      pool = pool.eq("subtopic_id", data.selectedSubtopicId);
    }
    const { data: poolRows, error: poolError } = await pool;
    if (poolError) throw poolError;

    const poolSources = (poolRows ?? []).map((r) => ({
      id: r.id,
      question_group_id: r.question_group_id,
    }));
    if (poolSources.length === 0) {
      return res.json({ ok: false, error: "אין שאלות זמינות לפרקים שנבחרו" });
    }

    // Step 1b — the user's "seen" sets (mode='practice' only), per-item.
    const [seenSrcAttemptsResult, seenAngleAttemptsResult] = await Promise.all([
      supabase
        .from("attempts")
        .select("source_question_id, attempted_at")
        .eq("user_id", user.id)
        .eq("mode", "practice")
        .eq("question_type", "source"),
      supabase
        .from("attempts")
        .select("angle_question_id, attempted_at")
        .eq("user_id", user.id)
        .eq("mode", "practice")
        .eq("question_type", "angle"),
    ]);
    if (seenSrcAttemptsResult.error) throw seenSrcAttemptsResult.error;
    if (seenAngleAttemptsResult.error) throw seenAngleAttemptsResult.error;

    const angleLastAt = new Map();
    for (const a of seenAngleAttemptsResult.data ?? []) {
      if (!a.angle_question_id) continue;
      const prev = angleLastAt.get(a.angle_question_id);
      if (!prev || a.attempted_at > prev) {
        angleLastAt.set(a.angle_question_id, a.attempted_at);
      }
    }

    const groupLastAt = new Map();
    const seenSrcAttempts = seenSrcAttemptsResult.data ?? [];
    if (seenSrcAttempts.length > 0) {
      const distinctSrcIds = Array.from(
        new Set(
          seenSrcAttempts
            .map((a) => a.source_question_id)
            .filter((v) => Boolean(v))
        )
      );
      if (distinctSrcIds.length > 0) {
        const { data: srcRows, error: srcLookupError } = await supabase
          .from("source_questions")
          .select("id, question_group_id")
          .in("id", distinctSrcIds);
        if (srcLookupError) throw srcLookupError;
        const srcToGroup = new Map();
        for (const r of srcRows ?? []) {
          srcToGroup.set(r.id, r.question_group_id);
        }
        for (const a of seenSrcAttempts) {
          if (!a.source_question_id) continue;
          const g = srcToGroup.get(a.source_question_id);
          if (!g) continue;
          const prev = groupLastAt.get(g);
          if (!prev || a.attempted_at > prev) {
            groupLastAt.set(g, a.attempted_at);
          }
        }
      }
    }

    // Step 2 — angle map for the entire pool.
    const allPoolSourceIds = poolSources.map((s) => s.id);
    let angleMap = new Map();
    if (data.anglesPerSource > 0) {
      const { data: angleRows, error: angleError } = await supabase
        .from("angle_questions")
        .select("id, source_question_id, display_order")
        .in("source_question_id", allPoolSourceIds)
        .order("display_order", { ascending: true });
      if (angleError) throw angleError;

      angleMap = new Map(allPoolSourceIds.map((sid) => [sid, []]));
      for (const row of angleRows ?? []) {
        const bucket = angleMap.get(row.source_question_id);
        if (bucket && bucket.length < data.anglesPerSource) {
          bucket.push(row.id);
        }
      }
    }

    // Step 3 — three-pass assembly (UNSEEN first, then LRU top-up, then fill).
    const shuffledPool = shuffle([...poolSources]);

    const questionList = [];
    const usedItemIds = new Set();
    const touchedSources = new Set();
    let pos = 0;

    const pushItem = (type, id) => {
      if (questionList.length >= targetTotal) return false;
      if (usedItemIds.has(id)) return questionList.length < targetTotal;
      usedItemIds.add(id);
      questionList.push({ type, id, position: pos++ });
      return questionList.length < targetTotal;
    };

    const maxAngleAt = (angleIds) => {
      let m = null;
      for (const aid of angleIds) {
        const t = angleLastAt.get(aid);
        if (t && (!m || t > m)) m = t;
      }
      return m;
    };

    const unitLastAt = (source) => {
      const g = groupLastAt.get(source.question_group_id) ?? null;
      const a = maxAngleAt(angleMap.get(source.id) ?? []);
      if (g && a) return g > a ? g : a;
      return g ?? a ?? "";
    };

    // Pass 1 — UNSEEN FIRST.
    let pass1Pushed = 0;
    for (const src of shuffledPool) {
      if (questionList.length >= targetTotal) break;
      const angleIds = angleMap.get(src.id) ?? [];
      const sourceUnseen = !groupLastAt.has(src.question_group_id);
      const unseenAngles = angleIds.filter((aid) => !angleLastAt.has(aid));
      if (!sourceUnseen && unseenAngles.length === 0) continue;

      const lenBefore = questionList.length;
      let canContinue = true;
      if (sourceUnseen) {
        if (!pushItem("source", src.id)) {
          canContinue = false;
        }
      }
      if (canContinue) {
        for (const aid of unseenAngles) {
          if (!pushItem("angle", aid)) {
            canContinue = false;
            break;
          }
        }
      }
      if (questionList.length > lenBefore) touchedSources.add(src.id);
      pass1Pushed += questionList.length - lenBefore;
      if (!canContinue) break;
    }

    // Pass 2 — TOP-UP from SEEN (whole-unit, LRU, appended).
    let pass2Pushed = 0;
    if (questionList.length < targetTotal) {
      const recycleCandidates = shuffledPool
        .filter((s) => !touchedSources.has(s.id))
        .map((s) => ({ src: s, lastAt: unitLastAt(s) }))
        .sort((a, b) => {
          if (a.lastAt === b.lastAt) return 0;
          return a.lastAt < b.lastAt ? -1 : 1;
        });
      for (const { src } of recycleCandidates) {
        if (questionList.length >= targetTotal) break;
        const lenBefore = questionList.length;
        let canContinue = pushItem("source", src.id);
        if (canContinue) {
          for (const aid of angleMap.get(src.id) ?? []) {
            if (!pushItem("angle", aid)) {
              canContinue = false;
              break;
            }
          }
        }
        if (questionList.length > lenBefore) touchedSources.add(src.id);
        pass2Pushed += questionList.length - lenBefore;
        if (!canContinue) break;
      }
    }

    // Pass 3 — SAFETY FILL from partial units.
    let pass3Pushed = 0;
    if (questionList.length < targetTotal) {
      const leftoverCandidates = shuffledPool
        .filter((s) => touchedSources.has(s.id))
        .map((s) => ({ src: s, lastAt: unitLastAt(s) }))
        .sort((a, b) => {
          if (a.lastAt === b.lastAt) return 0;
          return a.lastAt < b.lastAt ? -1 : 1;
        });
      for (const { src } of leftoverCandidates) {
        if (questionList.length >= targetTotal) break;
        const lenBefore = questionList.length;
        let canContinue = true;
        if (!usedItemIds.has(src.id)) {
          if (!pushItem("source", src.id)) canContinue = false;
        }
        if (canContinue) {
          for (const aid of angleMap.get(src.id) ?? []) {
            if (usedItemIds.has(aid)) continue;
            if (!pushItem("angle", aid)) {
              canContinue = false;
              break;
            }
          }
        }
        pass3Pushed += questionList.length - lenBefore;
        if (!canContinue) break;
      }
    }

    // Step 4 — insert the session row.
    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: data.selectedChapterIds,
        selected_subtopics: data.selectedSubtopicId
          ? [data.selectedSubtopicId]
          : [],
        source_count_target: data.sourceCountTarget,
        angles_per_source: data.anglesPerSource,
        time_per_question_seconds: data.timePerQuestionSeconds,
        session_duration_seconds: data.sessionDurationSeconds,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    console.info(
      `[practice] create_session OK user=${user.id} session=${inserted.id} items=${questionList.length} pass1=${pass1Pushed} pass2=${pass2Pushed} pass3=${pass3Pushed}`
    );

    return res.json({ ok: true, url: practicePlayUrl(inserted.id, 0) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && err.code;
    console.error(
      `[practice] create_session FAILED user=${user.id} code=${code ?? "unknown"} message=${message}`
    );
    return res.json({ ok: false, error: "הסשן לא נוצר, נסה שוב" });
  }
}

async function abandonActiveSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;

  const { error } = await supabase
    .from("practice_sessions")
    .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error(
      `[practice] abandon_session FAILED user=${user.id} code=${error.code ?? "unknown"} message=${error.message}`
    );
    return res.json({ ok: false, error: "אירעה שגיאה. נסה שוב" });
  }

  console.info(`[practice] abandon_session OK user=${user.id}`);
  return res.json({ ok: true });
}

async function createReviewSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const data = req.valid;

  try {
    let targetId = null;
    if (data.questionType === "source") {
      const { data: srcRow } = await supabase
        .from("source_questions")
        .select("id")
        .eq("question_group_id", data.sourceQuestionGroupId)
        .eq("is_current", true)
        .eq("status", "active")
        .maybeSingle();
      targetId = srcRow?.id ?? null;
    } else {
      const { data: angleRow } = await supabase
        .from("angle_questions")
        .select("id")
        .eq("id", data.angleQuestionId)
        .maybeSingle();
      targetId = angleRow?.id ?? null;
    }

    if (!targetId) {
      console.info(
        `[practice] create_review_session ARCHIVED user=${user.id} target_type=${data.questionType}`
      );
      return res.json({ ok: false, error: "השאלה כבר אינה זמינה" });
    }

    await supabase
      .from("practice_sessions")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    const questionList = [{ type: data.questionType, id: targetId, position: 0 }];

    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: [],
        selected_subtopics: [],
        source_count_target: 1,
        angles_per_source: 0,
        time_per_question_seconds: 150,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    console.info(
      `[practice] create_review_session OK user=${user.id} session=${inserted.id} target_type=${data.questionType} target_id=${targetId}`
    );
    return res.json({ ok: true, url: practicePlayUrl(inserted.id, 0) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && err.code;
    console.error(
      `[practice] create_review_session FAILED user=${user.id} code=${code ?? "unknown"} message=${message}`
    );
    return res.json({ ok: false, error: "לא ניתן לפתוח את השאלה. נסה שוב" });
  }
}

const BATCH_SIZE_MAX = 50;

async function createBatchReviewSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { source, chapterIdFilter } = req.valid;

  try {
    const rows =
      source === "bookmarks"
        ? await db.getUserBookmarks(supabase, user.id)
        : await db.getUserMistakes(supabase, user.id);

    const items = [];
    for (const r of rows) {
      const isArchived =
        r.questionType === "source"
          ? r.sourceQuestion.isArchived
          : r.angleQuestion.isArchived;
      if (isArchived) continue;

      const chapterId =
        r.questionType === "source"
          ? r.sourceQuestion.chapterId
          : r.angleQuestion.chapterId;
      if (chapterIdFilter && chapterId !== chapterIdFilter) continue;

      if (r.questionType === "source") {
        items.push({ type: "source", id: r.sourceQuestion.id });
      } else {
        items.push({ type: "angle", id: r.angleQuestion.id });
      }

      if (items.length >= BATCH_SIZE_MAX) break;
    }

    if (items.length === 0) {
      console.info(
        `[practice] create_batch_review_session EMPTY user=${user.id} source=${source} chapter=${chapterIdFilter ?? "*"}`
      );
      return res.json({ ok: false, error: "empty_list" });
    }

    await supabase
      .from("practice_sessions")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    const questionList = items.map((it, idx) => ({
      type: it.type,
      id: it.id,
      position: idx,
    }));

    const sourceCount = items.filter((it) => it.type === "source").length;

    const { data: inserted, error: insertError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        selected_chapters: [],
        selected_subtopics: [],
        source_count_target: sourceCount,
        angles_per_source: 0,
        time_per_question_seconds: 150,
        question_list: questionList,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    console.info(
      `[practice] create_batch_review_session OK user=${user.id} session=${inserted.id} count=${items.length} source=${source} chapter=${chapterIdFilter ?? "*"}`
    );
    return res.json({ ok: true, url: practicePlayUrl(inserted.id, 0) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && err.code;
    console.error(
      `[practice] create_batch_review_session FAILED user=${user.id} code=${code ?? "unknown"} message=${message}`
    );
    return res.json({ ok: false, error: "לא ניתן לפתוח את התרגול. נסה שוב" });
  }
}

// =============================================================================
// Play endpoints (auth only; RLS enforces subscription)
// =============================================================================

async function submitAttempt(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId, position, selectedLetter, durationSeconds } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });
  if (session.status !== "active") {
    return res.json({ ok: false, error: "הסשן אינו פעיל" });
  }

  const resolved = await db.getQuestionForPosition(supabase, session, position);

  if (resolved.kind === "archived") {
    console.info(
      `[practice] submit_attempt archived user=${user.id} session=${sessionId} position=${position}`
    );
    return res.json({ ok: true, archived: true });
  }
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return res.json({ ok: false, error: "מיקום לא תקין" });
  }

  const chosenChoice = resolved.question.choices.find(
    (c) => c.letter === selectedLetter
  );
  if (!chosenChoice) {
    return res.json({ ok: false, error: "תשובה לא תקינה" });
  }
  const correctChoice = resolved.question.choices.find((c) => c.is_correct);
  if (!correctChoice) {
    console.error(
      `[practice] submit_attempt FAILED user=${user.id} session=${sessionId} position=${position} reason=no_correct_choice`
    );
    return res.json({ ok: false, error: "תקלה בנתוני השאלה" });
  }

  const isCorrect = chosenChoice.id === correctChoice.id;
  const isSource = resolved.kind === "source";
  const clampedDuration = clampDuration(durationSeconds);

  const { error: insertError } = await supabase.from("attempts").insert({
    user_id: user.id,
    question_type: isSource ? "source" : "angle",
    source_question_id: isSource ? resolved.question.id : null,
    angle_question_id: isSource ? null : resolved.question.id,
    selected_choice_id: chosenChoice.id,
    selected_letter: selectedLetter,
    is_correct: isCorrect,
    mode: "practice",
    practice_session_id: sessionId,
    duration_seconds: clampedDuration,
    was_skipped: false,
  });

  if (insertError) {
    const code = insertError.code;
    if (code === "23505") {
      const existing = await db.getExistingAttempt(
        supabase,
        user.id,
        sessionId,
        resolved
      );
      if (existing && existing.is_correct !== null) {
        console.info(
          `[practice] submit_attempt IDEMPOTENT user=${user.id} session=${sessionId} position=${position}`
        );
        return res.json({
          ok: true,
          archived: false,
          isCorrect: existing.is_correct,
          correctChoiceId: correctChoice.id,
          correctLetter: correctChoice.letter,
        });
      }
    }
    console.error(
      `[practice] submit_attempt FAILED user=${user.id} session=${sessionId} position=${position} code=${code ?? "unknown"} msg=${insertError.message}`
    );
    return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
  }

  // increment_session_counters + record_mistake run in parallel after the
  // attempt insert succeeds. Neither is fatal — the attempt row is the
  // source of truth for the summary.
  const incrPromise = supabase.rpc("increment_session_counters", {
    p_session_id: sessionId,
    p_was_correct: isCorrect,
  });

  const mistakePromise = isCorrect
    ? Promise.resolve({ error: null })
    : isSource
      ? supabase.rpc("record_mistake", {
          p_question_type: "source",
          p_source_question_group_id: resolved.question.question_group_id,
          p_angle_question_id: null,
        })
      : supabase.rpc("record_mistake", {
          p_question_type: "angle",
          p_source_question_group_id: null,
          p_angle_question_id: resolved.question.id,
        });

  const [incrResult, mistakeResult] = await Promise.all([
    incrPromise,
    mistakePromise,
  ]);

  if (incrResult.error) {
    console.error(
      `[practice] increment_session_counters FAILED session=${sessionId} code=${incrResult.error.code ?? "unknown"} msg=${incrResult.error.message}`
    );
  }
  if (mistakeResult.error) {
    console.error(
      `[practice] record_mistake FAILED session=${sessionId} position=${position} code=${mistakeResult.error.code ?? "unknown"} msg=${mistakeResult.error.message}`
    );
  }

  console.info(
    `[practice] submit_attempt OK user=${user.id} session=${sessionId} position=${position} is_correct=${isCorrect} letter=${selectedLetter} duration=${clampedDuration}`
  );

  return res.json({
    ok: true,
    archived: false,
    isCorrect,
    correctChoiceId: correctChoice.id,
    correctLetter: correctChoice.letter,
  });
}

async function advanceToNext(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId, fromPosition } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });

  if (session.status === "completed") {
    return res.json({ ok: true, url: practiceSummaryUrl(sessionId) });
  }
  if (session.status === "abandoned") {
    return res.json({ ok: true, url: "/practice" });
  }

  const nextPosition = fromPosition + 1;

  if (nextPosition >= session.question_list.length) {
    const { error: updErr } = await supabase
      .from("practice_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (updErr) {
      console.error(
        `[practice] advance_complete FAILED session=${sessionId} code=${updErr.code ?? "unknown"} msg=${updErr.message}`
      );
      return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
    }
    console.info(
      `[practice] advance_to_next OK user=${user.id} session=${sessionId} from=${fromPosition} to=summary`
    );
    return res.json({ ok: true, url: practiceSummaryUrl(sessionId) });
  }

  console.info(
    `[practice] advance_to_next OK user=${user.id} session=${sessionId} from=${fromPosition} to=${nextPosition}`
  );
  return res.json({ ok: true, url: practicePlayUrl(sessionId, nextPosition) });
}

async function toggleBookmark(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId, position } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });

  const resolved = await db.getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return res.json({ ok: false, error: "מיקום לא תקין" });
  }

  let bookmarked;
  if (resolved.kind === "source") {
    const { data, error } = await supabase.rpc("record_bookmark_toggle", {
      p_question_type: "source",
      p_source_question_group_id: resolved.question.question_group_id,
      p_angle_question_id: null,
    });
    if (error) {
      console.error(
        `[practice] toggle_bookmark source FAILED session=${sessionId} position=${position} code=${error.code ?? "unknown"} msg=${error.message}`
      );
      return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
    }
    bookmarked = Boolean(data);
  } else {
    const { data, error } = await supabase.rpc("record_bookmark_toggle", {
      p_question_type: "angle",
      p_source_question_group_id: null,
      p_angle_question_id: resolved.question.id,
    });
    if (error) {
      console.error(
        `[practice] toggle_bookmark angle FAILED session=${sessionId} position=${position} code=${error.code ?? "unknown"} msg=${error.message}`
      );
      return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
    }
    bookmarked = Boolean(data);
  }

  console.info(
    `[practice] toggle_bookmark OK user=${user.id} session=${sessionId} target=${resolved.kind} new_state=${bookmarked}`
  );
  return res.json({ ok: true, bookmarked });
}

async function exitSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });

  if (session.status === "completed") {
    return res.json({ ok: true, url: practiceSummaryUrl(sessionId) });
  }
  if (session.status === "abandoned") {
    return res.json({ ok: true, url: "/practice" });
  }

  const isCompletion = session.questions_answered > 0;
  const newStatus = isCompletion ? "completed" : "abandoned";
  const completedAt = isCompletion ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("practice_sessions")
    .update({
      status: newStatus,
      completed_at: completedAt,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[practice] exit_session FAILED session=${sessionId} code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
  }

  console.info(
    `[practice] exit_session OK user=${user.id} session=${sessionId} status=${newStatus} answered=${session.questions_answered}`
  );

  return res.json({
    ok: true,
    url: isCompletion ? practiceSummaryUrl(sessionId) : "/practice",
  });
}

// =============================================================================
// Notes (auth only)
// =============================================================================

async function saveSourceNote(args) {
  const {
    supabase,
    userId,
    sessionId,
    position,
    sourceQuestionGroupId,
    contentJson,
    contentHtml,
  } = args;

  const { data: existingRows, error: lookupError } = await supabase
    .from("question_notes")
    .select("id")
    .eq("user_id", userId)
    .eq("question_type", "source")
    .eq("source_question_group_id", sourceQuestionGroupId)
    .is("angle_position", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error(
      `[practice] save_note lookup FAILED user=${userId} session=${sessionId} position=${position} msg=${lookupError.message}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }

  const existing =
    existingRows && existingRows.length > 0 ? existingRows[0] : null;

  if (existing) {
    const [updateResult, cleanupResult] = await Promise.all([
      supabase
        .from("question_notes")
        .update({ content_json: contentJson, content_html: contentHtml })
        .eq("id", existing.id)
        .select("updated_at")
        .single(),
      supabase
        .from("question_notes")
        .delete()
        .eq("user_id", userId)
        .eq("question_type", "source")
        .eq("source_question_group_id", sourceQuestionGroupId)
        .is("angle_position", null)
        .neq("id", existing.id),
    ]);

    if (updateResult.error || !updateResult.data) {
      console.error(
        `[practice] save_note update FAILED user=${userId} session=${sessionId} position=${position} msg=${updateResult.error?.message ?? "no data"}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    if (cleanupResult.error) {
      console.warn(
        `[practice] save_note cleanup non-fatal user=${userId} session=${sessionId} position=${position} msg=${cleanupResult.error.message}`
      );
    }
    console.info(
      `[practice] save_note OK source/update user=${userId} session=${sessionId} position=${position}`
    );
    return { ok: true, updatedAt: updateResult.data.updated_at };
  }

  const { data, error } = await supabase
    .from("question_notes")
    .insert({
      user_id: userId,
      question_type: "source",
      source_question_group_id: sourceQuestionGroupId,
      angle_position: null,
      content_json: contentJson,
      content_html: contentHtml,
    })
    .select("updated_at")
    .single();

  if (error || !data) {
    console.error(
      `[practice] save_note insert FAILED user=${userId} session=${sessionId} position=${position} msg=${error?.message ?? "no data"}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }
  console.info(
    `[practice] save_note OK source/insert user=${userId} session=${sessionId} position=${position}`
  );
  return { ok: true, updatedAt: data.updated_at };
}

async function saveNote(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId, position, contentJson, contentHtml } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });

  const resolved = await db.getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return res.json({ ok: false, error: "מיקום לא תקין" });
  }
  const identity = db.deriveNoteIdentity(resolved);
  if (!identity) {
    console.error(
      `[practice] save_note IDENTITY_FAILED user=${user.id} session=${sessionId} position=${position} kind=${resolved.kind}`
    );
    return res.json({ ok: false, error: "מיקום לא תקין" });
  }

  if (identity.angle_position === null) {
    const result = await saveSourceNote({
      supabase,
      userId: user.id,
      sessionId,
      position,
      sourceQuestionGroupId: identity.source_question_group_id,
      contentJson,
      contentHtml,
    });
    return res.json(result);
  }

  const { data, error } = await supabase
    .from("question_notes")
    .upsert(
      {
        user_id: user.id,
        question_type: identity.question_type,
        source_question_group_id: identity.source_question_group_id,
        angle_position: identity.angle_position,
        content_json: contentJson,
        content_html: contentHtml,
      },
      {
        onConflict:
          "user_id,question_type,source_question_group_id,angle_position",
      }
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    console.error(
      `[practice] save_note FAILED user=${user.id} session=${sessionId} position=${position} code=${error?.code ?? "unknown"} msg=${error?.message ?? "no data"}`
    );
    return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
  }

  console.info(
    `[practice] save_note OK user=${user.id} session=${sessionId} position=${position} type=${identity.question_type}`
  );

  return res.json({ ok: true, updatedAt: data.updated_at });
}

async function deleteNote(req, res) {
  const supabase = req.supabase;
  const user = req.user;
  const { sessionId, position } = req.valid;

  const session = await db.getSessionForUser(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "סשן לא נמצא" });

  const resolved = await db.getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return res.json({ ok: false, error: "מיקום לא תקין" });
  }
  const identity = db.deriveNoteIdentity(resolved);
  if (!identity) return res.json({ ok: false, error: "מיקום לא תקין" });

  let q = supabase
    .from("question_notes")
    .delete()
    .eq("user_id", user.id)
    .eq("question_type", identity.question_type)
    .eq("source_question_group_id", identity.source_question_group_id);
  q =
    identity.angle_position === null
      ? q.is("angle_position", null)
      : q.eq("angle_position", identity.angle_position);

  const { error } = await q;
  if (error) {
    console.error(
      `[practice] delete_note FAILED user=${user.id} session=${sessionId} position=${position} code=${error.code ?? "unknown"} msg=${error.message}`
    );
    return res.json({ ok: false, error: "התרחשה שגיאה. נסה שוב" });
  }
  console.info(
    `[practice] delete_note OK user=${user.id} session=${sessionId} position=${position}`
  );
  return res.json({ ok: true });
}

module.exports = {
  getAvailableQuestionCount,
  createPracticeSession,
  abandonActiveSession,
  createReviewSession,
  createBatchReviewSession,
  submitAttempt,
  advanceToNext,
  toggleBookmark,
  exitSession,
  saveNote,
  deleteNote,
};
