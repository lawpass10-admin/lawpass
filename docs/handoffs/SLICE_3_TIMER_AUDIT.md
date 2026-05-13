# Slice 3 — Exam Mode — Timer & State Architecture Audit

**Author:** Claude (discovery only, no code changes)
**Date:** 2026-05-13
**Status:** PM review pending. Do not patch until Yoav greenlights.
**Scope:** Slice 3 (Exam Mode) timer + session-state writes. Practice mode is the reference architecture; deltas are called out.

This document is a **read-only investigation**. The hotfix v2 timer change (commit `d906a82`) introduced a regression that is currently silent in production and is mis-diagnosable. The point of writing it down before patching is so the patch is shaped by the full blast radius — not by the first symptom PM reported.

---

## 1. Immediate bug

### 1.1 The thing

`app/(app)/exam/_actions.ts:229` — `computeServerElapsedSeconds` returns a **float**:

```ts
function computeServerElapsedSeconds(session: ExamSessionRow): number {
  const raw =
    (Date.now() - new Date(session.last_activity_at).getTime()) / 1000;
  return Math.max(0, Math.min(raw, 600));
}
```

`Date.now()` returns milliseconds. Dividing by 1000 produces a real number (e.g. `25.443`). The clamp preserves the float — `Math.min(25.443, 600) === 25.443`.

That float is consumed by `nextTimeUsed` (line 241), which adds it to `session.time_used_seconds` (an integer). JS does float arithmetic; the result is a float.

`nextTimeUsed`'s return value is then written to `exam_sessions.time_used_seconds`, which is **`integer NOT NULL`** (verified via `information_schema`). Postgres rejects with `invalid input syntax for type integer: "25.443"`.

### 1.2 The five call sites that hit the float→int boundary

All five pass the unrounded `nextTimeUsed(session)` directly to a `.update({ time_used_seconds })`:

| Action               | Line | Operation                                         |
|----------------------|------|---------------------------------------------------|
| `submitExamAttempt`  | 399  | per-choice time bump                              |
| `skipExamQuestion`   | 480  | per-skip time bump                                |
| `pauseExam`          | 519  | pause flip + time bump                            |
| `submitFinalExam`    | 689  | final submit + score + completed_at + time bump   |
| `abandonAndExitExam` | 749  | save-and-exit + time bump                         |

All five fail when the elapsed-since-`last_activity_at` is non-integer (which is almost always — the resolution of `Date.now()` is 1 ms).

### 1.3 The silent-failure amplifier (worse than the bug itself)

None of the five UPDATEs capture the error result. Example, line 396–402:

```ts
await supabase
  .from("exam_sessions")
  .update({
    time_used_seconds: newTimeUsed,
    last_activity_at: new Date().toISOString(),
  })
  .eq("id", sessionId);
```

No `const { error } =`, no `if (error)` check. supabase-js returns the rejection in the response object — and we throw it on the floor. The action returns `{ ok: true, remaining_seconds, is_correct }` to the client.

From the user's seat: the answer feels submitted (the RPC and the counter recompute *did* land), the timer **looks** OK (countdown is client-driven, decoupled from `time_used_seconds`), but **`time_used_seconds` never bumps and `last_activity_at` never moves**. Next action: same thing. Each call accumulates `raw = elapsed since the very first action`, until eventually `raw >= 600` and the clamp collapses to the integer `600` — at which point a write finally lands.

This is exactly the 5b83e8ee story; see §6.

### 1.4 The safe path (already rounded)

`p_duration_seconds` for `record_exam_attempt` IS rounded — `app/(app)/exam/_actions.ts:362, 447`:

```ts
const durationClamped = Math.round(computeServerElapsedSeconds(session));
```

That's why the `attempts` table is full of integer durations (queried: 2, 3, 4, 6, 7, 8, 9, 25 — all `integer`). The bug is precisely in the **`exam_sessions.time_used_seconds` path** and only that path.

### 1.5 Why this didn't trip pre-hotfix

Pre-`d906a82`, `nextTimeUsed` consumed the client-supplied `clientElapsedSeconds`, which the Zod schema typed as `z.number().int()` and the broken-client always passed as `0`. `0 + 0 = 0` (integer). The session's `time_used_seconds` was wrong (always 0) but it was an *integer 0*, so the UPDATE didn't reject. The pre-existing wrong-but-integer behavior was masking the type incompatibility.

---

## 2. Blast radius

### 2.1 Affected: the five exam actions in §1.2

Already enumerated. Every gameplay action that bumps `time_used_seconds` is broken. Live DB evidence (`cfe3e875-a501-…`, currently `active`): 6 attempts landed in the `attempts` table over 24 seconds; `time_used_seconds=0`; `last_activity_at = started_at` exactly. The session timer is frozen at the server-of-truth level even though the client thinks it's playing fine.

### 2.2 Not affected (verified):

- `createExamSession` — writes `time_used_seconds: 0` (integer literal).
- `abandonActiveExamSession` — doesn't touch `time_used_seconds`.
- `resumeExam` (line 531) — explicitly does **not** call `nextTimeUsed`. Only clears `paused_at` and bumps `last_activity_at`. Pause intervals are correctly *excluded* from `time_used_seconds`.
- `toggleExamBookmark` — no time math.
- `claimExamWindow` — Phase 5 stub.
- `record_exam_attempt` RPC payloads (`p_duration_seconds`) — rounded inside the action.
- `recomputeExamCounters` — writes integer counts, no float.

### 2.3 Cosmetic float leak (low-risk but inconsistent)

`remainingSeconds(session, newTimeUsed)` (line 249) returns `total_duration_seconds - newTimeUsed`, which is a float when `newTimeUsed` is a float. It's sent to the client as JSON and consumed for display. The countdown ring is wall-clock driven (`setInterval` from `started_at`/`last_activity_at`), so the float passes through cosmetically. Worth fixing for hygiene; not a user-visible defect.

### 2.4 Practice mode — the structural reference

Practice avoided the trap by accident-of-construction, not by design:

- `lib/validators/practice.ts` types `durationSeconds` as `z.number().int()` at the wire. The client computes it; integer in, integer out.
- `app/(app)/practice/play/_actions.ts:56` defines `clampDuration(s) = Math.max(0, Math.min(600, Math.round(s)))` — `Math.round` is **inside** the clamp.
- Practice time accounting goes through the `increment_session_counters` SECURITY DEFINER RPC, which receives integer `p_duration_seconds` only. Postgres does the addition.
- Practice doesn't track a session-level "elapsed" the way exam does — each question is its own duration entry; the session has `total_duration_seconds = SUM(...)` via the RPC. There is no `nextTimeUsed`-equivalent path that can carry a float.

The exam codepath bypassed both of these guarantees: it computes elapsed server-side from `last_activity_at` (so the client value is irrelevant) but never rounded inside `computeServerElapsedSeconds`, and it does the column addition in JS rather than in SQL.

### 2.5 Test coverage

`tests/exam-sampling.test.ts` has 7 tests, all covering the pure `bucketAndShuffleExamPool` function. **Zero coverage for the 10 server actions.** A trivial Vitest case that calls `submitExamAttempt` against any Supabase test instance (or a hand-mocked client where the `time_used_seconds` column is typed as integer) would have caught this on Phase 4 hotfix v2 day-1. This is the single highest-leverage fix.

---

## 3. Architecture options

The current model is "do timer math in TS, write the result to Postgres." Two cleaner shapes are available.

### Option A — Minimal: round at the boundary

Wrap every `time_used_seconds` write with `Math.round` (or pull the rounding into `nextTimeUsed`). Add an `error` check on every UPDATE.

- **Pros:** smallest diff, lowest risk, ships as a hotfix in <100 lines.
- **Cons:** still does read-modify-write in TS; still vulnerable to lost updates under concurrent windows (relevant when Phase 5 ships `claimExamWindow`); still asymmetric with practice mode (where time math is in the RPC). Doesn't address the **silent-error pattern** which is the real footgun. Doesn't get atomicity (§4).
- **Verdict:** the right hotfix shape. Not the right end state.

### Option B — Postgres-RPC: move time math into a SECURITY DEFINER RPC

`bump_exam_session_time(p_session_id uuid, p_status text default null, p_paused_at timestamptz default null, …)` — internally:

```sql
UPDATE exam_sessions
   SET time_used_seconds = LEAST(
         time_used_seconds + GREATEST(0, LEAST(EXTRACT(EPOCH FROM (NOW() - last_activity_at))::int, 600)),
         total_duration_seconds
       ),
       last_activity_at = NOW(),
       status = COALESCE(p_status, status),
       paused_at = COALESCE(p_paused_at, paused_at)
 WHERE id = p_session_id AND user_id = auth.uid();
```

The cast `::int` lives where it's the most natural type coercion. The read-modify-write becomes a single UPDATE — Postgres serializes row writes per the row lock, so there's no lost-update window.

For `submitExamAttempt` and `skipExamQuestion`, this composes with the existing `record_exam_attempt` RPC: either chain them (RPC1 then RPC2 — still two round trips but each is atomic) or fuse them into a single `submit_exam_attempt(p_session_id, p_question_type, …)` RPC that performs the UPSERT, the counter recompute, AND the time bump in one transaction.

- **Pros:** eliminates the float boundary entirely; matches the practice pattern (counter math in RPC); atomicity within each action; lost-update-safe under concurrent windows; the source of truth (Postgres) holds the math.
- **Cons:** more migrations; the fused-RPC shape introduces a new RPC contract that has to be kept in sync with the action's input schema. SECURITY DEFINER RPCs need careful auth checks (the existing `record_exam_attempt` already demonstrates the pattern).
- **Verdict:** the right end state. Phase 5 or Phase 6 work.

### Option C — Pure-TS, with a typed-boundary check

Add a `assertExamSessionTimeUsed` runtime check that throws if a non-integer is about to be written. Belt-and-suspenders, not a fix on its own.

- **Verdict:** worth adding as a guardrail INSIDE option A or B, not instead of either.

### Recommendation

Ship **A** as the hotfix (today). Plan **B** for Phase 5 or 6. Add **C** at the same time as **A** so the next regression of this shape page faults loudly instead of silently dropping writes.

---

## 4. Atomicity audit

No exam action runs inside an explicit Postgres transaction. supabase-js doesn't expose them through the data API; you'd have to use a custom RPC (which is part of why option B is appealing).

### Per-action breakdown

| Action               | Sequential ops (each its own DB round-trip)                                   | Partial-success risk |
|----------------------|-------------------------------------------------------------------------------|----------------------|
| `submitExamAttempt`  | 1. `record_exam_attempt` RPC <br> 2. recompute counters UPDATE <br> 3. session time UPDATE | High — and currently realized: (3) fails silently, (1) + (2) land. |
| `skipExamQuestion`   | Same shape as submit                                                          | Same.                |
| `pauseExam`          | Single UPDATE (status + paused_at + time + last_activity)                     | None (single statement). |
| `submitFinalExam`    | 1. recompute counters UPDATE <br> 2. main UPDATE (status + score + time)      | High — if (2) fails on float, (1) has already mutated `questions_correct`. Counters drift from a non-terminal session. |
| `abandonAndExitExam` | Single UPDATE                                                                 | None.                |
| `resumeExam`         | Single UPDATE                                                                 | None.                |
| `toggleExamBookmark` | Single `record_bookmark_toggle` RPC                                           | None.                |

The 3-op actions are the failure surface. The current float→int bug makes the worst-case scenario regular: every choice click lands an attempt and recomputes counters, then silently fails to bump time. The session row drifts away from the `attempts` table on every click.

Option B fuses ops 1–3 into one RPC and turns this column into "None."

### Re-entry on partial failure

There is no compensating action. The Phase 3 design relies on **counter recompute** to be idempotent — backward nav + re-pick converges because the next call re-reads `attempts` from scratch. That's still true. But "time bumped" cannot be recomputed from `attempts` (the attempt durations sum to "time at the keyboard," not "time since last_activity_at"). Once `last_activity_at` is frozen, the next call will burn 600 s on the clamp regardless of true elapsed.

---

## 5. Lurking risks — E.1 through E.8

Walk through each scenario PM raised, with verdict + a one-line test sketch.

### E.1 — Pause/resume excludes pause intervals correctly

**Verdict:** Bug-free *by design*. `resumeExam` (line 531) deliberately does **not** call `nextTimeUsed` — it just clears `paused_at` and sets `last_activity_at=NOW()`. So elapsed-during-pause is discarded. The float→int bug touches the pause path (`pauseExam` line 519) but not resume; once pause lands a write, the resume side is clean.

**Test sketch:** `pauseExam` at T=10s, sleep 20s, `resumeExam`, `submitExamAttempt` after another 5s. Assert `time_used_seconds === 15` (not 35).

### E.2 — Window-token mismatch

**Verdict:** Works. `loadSessionForAction` (line 198) checks `session.active_window_token !== windowToken` and returns `window_conflict` before any write. The Phase 5 `claimExamWindow` flow (currently stub) will mint a new token and the old tab's writes will reject as expected.

**Test sketch:** Open session in tab A (token T1). Mint T2 directly via SQL, simulating tab B claim. Call `submitExamAttempt({windowToken: T1, …})` from tab A's context — expect `window_conflict`.

### E.3 — Bookmark in exam

**Verdict:** Bug-free. `toggleExamBookmark` doesn't touch `time_used_seconds`; immune to the float bug. Goes through `record_bookmark_toggle` RPC like practice.

**Test sketch:** Bookmark same position twice in succession; assert second call returns `bookmarked: false` and that no time fields changed.

### E.4 — Skip + backward nav + answer

**Verdict:** Works because of the partial-index UPSERT shape. `record_exam_attempt` RPC uses `ON CONFLICT (exam_session_id, source_question_id) WHERE …` so a skip row (selected_letter=null, was_skipped=true) at position N can be overwritten by an answer row at the same position. Counter recompute then converges (was_skipped=false AND is_correct IS NOT NULL passes the predicate).

**Test sketch:** position=0 → skip. Backward nav. position=0 → submit correct answer. Assert `questions_answered=1`, `questions_correct=1`. (Modulo §4 — the *time bump* part of submit will silently fail today, but the attempt + counter state will converge.)

### E.5 — Auto-submit at 0:00

**Verdict:** Decoupled. The visual countdown is client-side (`exam-question.tsx` runs a local `setInterval` from a baseline). When `time_used_seconds=0` (i.e. every session today, per the bug), the visual hits 0 at **100 min from page load**, not 100 min from session start. Pause/resume cycles ARE reflected in the visual only insofar as the baseline is re-read on resume — needs verification (the client re-fetches remaining_seconds from each action response, so once that pipeline works, this self-heals).

After option A lands: visual ≈ wall-clock for `time_used_seconds`, which is finally truthful. After option B lands: identical, but the math is on the server. Auto-submit at 0 should always fire `submitFinalExam` regardless of float bug, because `0 - elapsed` clamps to 0 on the client. Verify the auto-submit path doesn't depend on `time_used_seconds` being correct on the server.

**Test sketch:** Mock `Date.now()` to advance 6001 s past session start; assert the play screen calls `submitFinalExam`. Server-side, assert `final_score = recomputed correct count` even if `time_used_seconds` is stale.

### E.6 — Two-tab claim

**Verdict:** Phase 3 stub. `claimExamWindow` returns `{ ok: false, error: "not_implemented_yet" }`. The WindowConflict screen renders but no claim flow yet. This is a known-deferred Phase 5 item; not a Slice 3 blocker.

**Test sketch:** N/A until Phase 5. When it lands: open in tab A, refresh in tab B, click "Take over" — A's next action should return `window_conflict`, B's should succeed.

### E.7 — Resume modal at >24h paused

**Verdict:** The 600s clamp keeps `nextTimeUsed` from blowing past `total_duration_seconds` (also clamped). The bug doesn't change this — pre-fix, even with `raw = 86400`, the inner `Math.min(raw, 600) = 600`, then outer `Math.min(time_used + 600, 6000) = either 6000 or time_used+600`. Both branches yield integers in this corner case (which is why the 5b83e8ee row landed `time_used_seconds=600` instead of e.g. `5400.443`). Post-fix: same, but with `error` capture, so a future regression doesn't silently land.

**Test sketch:** Insert an `exam_sessions` row with `last_activity_at = NOW() - INTERVAL '2 days'`, status=paused. Call `resumeExam` then `submitExamAttempt`. Assert `time_used_seconds` increased by ≤600.

### E.8 — createExamSession transitions

**Verdict:** Confirmed by `app/(app)/exam/_actions.ts:55-62`. Prior in-flight sessions (active OR paused) flip to `'abandoned'`, NOT `'completed'`. Rules out one hypothesis for 5b83e8ee — that mystery row is `'completed'` from its own final submit, not from a sibling-creation side-effect.

**Test sketch:** Create session A, abandon implicitly by creating session B. Assert A.status=='abandoned' and A.final_score is null.

---

## 6. The 5b83e8ee mystery — diagnosed

### 6.1 The mystery

PM reported: session `5b83e8ee-3100-4401-9e77-d771b0a4c720` transitioned to `status='completed'` with `final_score=0`, despite multiple choice-submit clicks returning `attempt_write_failed` in the client console. How did a session that PM couldn't submit answers to end up in a terminal state?

### 6.2 What I queried

```sql
SELECT id, status, final_score, time_used_seconds, total_duration_seconds,
       started_at, last_activity_at, completed_at, questions_answered, questions_correct
FROM exam_sessions WHERE id = '5b83e8ee-…';
```

| field                  | value                          |
|------------------------|--------------------------------|
| status                 | completed                      |
| final_score            | 0                              |
| questions_answered     | 2                              |
| questions_correct      | 0                              |
| time_used_seconds      | **600**                        |
| total_duration_seconds | 6000                           |
| started_at             | 2026-05-13 13:17:11.558+00     |
| last_activity_at       | 2026-05-13 18:26:13.01+00      |
| completed_at           | 2026-05-13 18:26:13.01+00      |

```sql
SELECT id, is_correct, was_skipped, duration_seconds, attempted_at
FROM attempts WHERE exam_session_id = '5b83e8ee-…' ORDER BY attempted_at;
```

| #  | is_correct | was_skipped | duration_s | attempted_at                  |
|----|------------|-------------|------------|-------------------------------|
| 1  | false      | false       | 3          | 13:17:14.21                   |
| 2  | false      | false       | 8          | 13:17:19.20                   |
| —  | —          | —           | —          | (no further rows for ~5h09m)  |

### 6.3 The diagnosis

The two attempt rows at 13:17:14 and 13:17:19 are real — `record_exam_attempt` RPC succeeded both times (its `p_duration_seconds` is `Math.round`-ed, integer-clean). After each, the action ran `recomputeExamCounters` (integer-clean — succeeds) and then the session-time UPDATE — which is the **float→int reject path**, unchecked.

Per §1.3, the action returned `{ ok: true, … }` despite the silent UPDATE failure. The client got a fine response, the user thought "answered, moving on." `last_activity_at` stayed frozen at exactly `started_at`. The user took two more clicks, both repeated the same silent-failure pattern; no `attempts` rows? Actually re-check: only 2 rows exist. Either positions 3+ failed at the RPC layer (e.g. resolved.kind === 'archived') — unlikely given the matching cfe3e875 evidence — or PM stopped clicking after 2.

Either way: 5+ hours pass. PM returns, hits "submit". `submitFinalExam` runs:
1. `recomputeExamCounters` → `questions_answered=2, questions_correct=0`. ✓ landed.
2. `finalScore = 0`, `passed = false`.
3. `nextTimeUsed`: `raw = (NOW - last_activity_at)/1000 ≈ 5h09m ≈ 18,541 s`. `Math.min(18541, 600) = 600` — an **integer literal**. `Math.min(0 + 600, 6000) = 600`. Integer.
4. Main UPDATE writes `time_used_seconds: 600` (integer), `final_score: 0`, `passed: false`, `completed_at: NOW`, `last_activity_at: NOW`. ✓ landed. The whole row commits because every value is an integer.

**The "impossible" state transition is a coincidence:** when `raw >= 600`, the inner clamp produces the integer literal `600` exactly. The float ↔ integer dance happens to land on an integer on that specific call.

### 6.4 Implications for the recommended fix

- The silent-error pattern (§1.3) is the actual root cause. Float→int rejection is the trigger; unchecked errors are the amplifier.
- The visible symptoms (sessions with `time_used_seconds=0` despite real attempts; sessions that suddenly land `time_used_seconds=600` after long idles) are both predicted by this model.
- The fix MUST capture the UPDATE error and surface it, or no future bug of this shape will be diagnosable. Option B captures-by-construction; option A needs explicit `if (error) return { ok: false, error: 'time_update_failed' }`.

---

## 7. Recommended fix sequence

Phased so PM can ship the bleed-stop today and queue the architecture work for the next sprint. Slice 3 is still mid-flight (Phase 5 + 6 pending), so neither plan disturbs the in-progress phases.

### 7.1 Immediate hotfix (today) — option A + option C

Scope is small enough to ship in one PR, one review pass.

1. **Round inside `nextTimeUsed`** (one-line change at `app/(app)/exam/_actions.ts:241`):

   ```ts
   function nextTimeUsed(session: ExamSessionRow): number {
     const incr = computeServerElapsedSeconds(session);
     return Math.min(
       Math.round(session.time_used_seconds + incr),
       session.total_duration_seconds
     );
   }
   ```

   `Math.round` is the cheapest place; only one site needs editing.

2. **Capture errors on all 5 session UPDATEs.** Wrap each in:

   ```ts
   const { error: timeError } = await supabase.from("exam_sessions").update({…}).eq("id", sessionId);
   if (timeError) {
     console.error(`[exam] time_bump FAILED session=${sessionId} action=submitExamAttempt code=${timeError.code} msg=${timeError.message}`);
     return { ok: false, error: "time_update_failed" };
   }
   ```

   The client already handles failure toasts; surface the new error code in `exam-question.tsx`'s switch.

3. **Add a typed-boundary assert in `nextTimeUsed`** (option C):

   ```ts
   const v = Math.round(...);
   if (!Number.isInteger(v)) throw new Error(`nextTimeUsed produced non-integer: ${v}`);
   return v;
   ```

   Belt and suspenders. Trips loudly if a future regression of this shape sneaks in.

4. **Backfill the float-cosmetic in `remainingSeconds`** — `Math.max(0, total - newTimeUsed)` is already int-on-int once (1) lands, so no extra round needed. Document this in a one-line comment.

5. **Smoke test** in dev: open a session, click 3 choices, query `exam_sessions` — assert `time_used_seconds > 0` and `last_activity_at` advanced.

**Why this is enough for now:** unblocks all in-flight users, makes failures observable, doesn't change the architecture in a way that conflicts with Phase 5 (window claim) or Phase 6 (whatever lands next).

### 7.2 Next sprint — option B (architecture refactor)

Slottable into **Phase 5 or Phase 6** of Slice 3, depending on what Yoav scopes next. Concrete shape:

1. New migration: `supabase/migrations/2026XXXX_exam_bump_session_time_rpc.sql` — a `bump_exam_session_time` SECURITY DEFINER RPC. Replaces the 5 inline UPDATEs.

2. New migration: `supabase/migrations/2026XXXX_exam_submit_attempt_rpc.sql` — fuses `record_exam_attempt` + counter recompute + time bump into one `submit_exam_attempt(p_session_id, …)` RPC. Same fusion for `skip_exam_question` and `submit_final_exam`.

3. `app/(app)/exam/_actions.ts` becomes thin wrappers — Zod parse, auth check, single RPC call, error handling.

4. Remove `clientElapsedSeconds` from `lib/validators/exam.ts` (currently `@deprecated`). The wire contract is no longer used by anyone.

5. Atomicity: each action becomes a single SQL transaction. §4 partial-success column drops to "None" for every row.

**Why this is the right end state:** matches practice mode's pattern, eliminates the silent-failure surface entirely, prepares for concurrent-window claim (where lost-update windows would otherwise bite Phase 5).

### 7.3 Test coverage backfill (rolling)

The reason this bug shipped is that there is **zero integration coverage for `_actions.ts`**. Even one test per action would have caught it.

1. **First wave (during 7.1):** add `tests/exam-actions.test.ts` with at least:
   - `submitExamAttempt` happy path — assert `time_used_seconds` increases and is an integer
   - `submitExamAttempt` with non-integer-producing elapsed (e.g. mock `Date.now()` to return a value 25.443 s after `last_activity_at`) — assert no error and integer write
   - `submitFinalExam` happy path — assert status=completed, final_score=correct count, time integer
   - `pauseExam` then `resumeExam` then `submitExamAttempt` — assert pause interval excluded
   - `submitExamAttempt` with wrong windowToken — assert `window_conflict`

2. **Second wave (during 7.2):** the RPCs themselves get pgTAP or Vitest-against-supabase tests. Postgres-side assertions for the LEAST/GREATEST clamping, the SECURITY DEFINER auth check, and the partial-index UPSERT predicate.

3. **Rolling:** every new action in Phase 5/6 must ship with at least one happy-path test in `tests/exam-actions.test.ts`. Make it the bar for review.

**Why not all at once:** the test infrastructure question (Supabase test DB vs mocked client) is itself a sprint of work. The first wave can use a mocked supabase client with column-type-aware fakes; the second wave needs a real Postgres branch. Don't block the hotfix on the test infrastructure decision.

---

## Appendix — files touched by this audit

Read-only. No edits, no commits.

- `app/(app)/exam/_actions.ts` — 773 lines, all read
- `lib/validators/exam.ts` — 84 lines, full read
- `lib/db/exam.ts` — partial recall from prior conversation
- `app/(app)/exam/play/_components/exam-question.tsx` — partial recall from prior conversation
- `app/(app)/practice/play/_actions.ts` — grep-level reference for the practice pattern
- `tests/exam-sampling.test.ts` — confirmed 7 tests, all on `bucketAndShuffleExamPool`
- Live DB queries against project `yxwggfvhpvszcigkztol` — 5b83e8ee row, cfe3e875 row, attempts for both, schema for `exam_sessions` and `attempts`
