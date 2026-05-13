# Slice 3 — Exam Simulation Mode · Master Plan (v1)

**Project:** LawPass · **Status:** Planning · **Date:** 2026-05-13
**Previous:** Slice 2 shipped (Phase 5 at `da296b8`, practice flow + bookmarks/mistakes live; 39 source questions / 195 effective practice items in production)
**Authored by:** Claude Code planning pass against `docs/SPEC_final.md` (§§ 4.1–4.4, 6.8, 7.0.4, 7.2, 7.3, 8.4.1, 8.4.3, 9.6.3) and the PM-locked scope below.

This is a **planning-only** document. No code changes. PM reviews + greenlights Phase 0 separately.

---

## 1. What we're building

Slice 3 = **Exam Simulation Mode**. A user with an active subscription can:

1. Visit `/exam` and see a configuration-free intro screen ("40 questions / 100 minutes / pass = 24/40").
2. Resume an in-flight `active`/`paused` exam (modal) or start a fresh one.
3. Sit a single 6,000-second timed run — sidebar hidden across the entire `/exam/*` subtree.
4. Pick answers (no feedback), navigate freely forward/backward, skip, pause/resume, bookmark for later review (writes to the same `bookmarks` table practice uses).
5. Submit manually (with an unanswered-count confirm if any remain) or auto-submit silently at 0:00.
6. See a results screen: pass/fail pill, score, cluster cards, flat per-question status list (no drill-in, no 360° from this screen — that's deferred).
7. Be blocked from opening the same exam in a second window unless they explicitly claim the new window (full-page block, not a modal).

What we are **not** building in Slice 3:

- 360° drill-in on the results screen (per-question view → defer to Slice 5/6 "exam review")
- Notes / feedback icons on the exam question screen (spec confirms both are hidden in exam)
- Per-question subtopic labels on the results screen
- Network-disconnect resilience beyond what autosave already gives us
- Pool-exhaustion handling (repeats allowed silently; PM accepted)
- Multi-window claim *across devices* (token is per row, not per device)

---

## 2. Confirmed decisions (PM-locked)

### Core mechanics
| | |
|---|---|
| Length | 40 questions, 100 minutes (6,000 s), pass = 24/40 (60%) |
| Question pool | Mix of `source_questions` (current+active) and `angle_questions` |
| 360° during exam | Hidden |
| Pause/resume | Supported (status flips active ↔ paused) |
| Single-window guard | `active_window_token` UUID minted on entry; full-page block on token mismatch |
| Autosave | Server-side after every answer/skip/pause; closing the browser preserves state |
| Timer | Counts down from 6,000 s; turns red at < 600 s; auto-submits silently at 0 |
| Sidebar | Hidden across the entire `/exam/*` tree (intro + play + results) |

### Cluster mapping (LawPass chapters → bar-exam clusters)
Encoded as a single config object in `lib/exam/clusters.ts` so future remapping = config change only:

```ts
// Conceptual shape — implementation in Phase 1
EXAM_CLUSTERS = [
  { code: "א", weight: 0.350, target: 14, chapter_codes: ["civil_proc"] },
  { code: "ב", weight: 0.275, target: 11, chapter_codes: ["criminal_proc","evidence","constitutional_intl"] },
  { code: "ג", weight: 0.325, target: 13, chapter_codes: ["execution","insolvency_arbitration"] },
];
```

### Sampling
- Weighted proportional per cluster (best-effort).
- Current pool fits target: civil_proc=14×5=70 ⊃ 14; criminal+evidence+constitutional ≈ (11+4+5)×5=100 ⊃ 11; execution+insolvency ≈ (5+0)×5=25 ⊂ 13 with slack — cluster ג will eat most of `execution` every run, with repeats inevitable.
- **No no-repeat rule in this slice** — same question can appear across multiple exams for the same user.
- If a cluster's pool can't fill its target after deduping within a single exam, pad from the remaining global pool (any chapter).

### UX
| Decision | Detail |
|---|---|
| Bookmark in exam | Same `bookmarks` table as practice (same `record_bookmark_toggle` RPC). Adding during exam surfaces in `/bookmarks` afterward. Notes are NOT shown in exam. |
| Auto-submit at 0:00 | Silent redirect to `/exam/results/[id]` — no modal, no warning at 0. The < 600 s red timer is the only escalation. |
| Manual "סיים בחינה" | All 40 answered → submit. Else confirm modal: "יש X שאלות לא ענויות, ייספרו כשגויות. בטוח לסיים?" |
| Single-window block | Full-page block (not a modal). Two CTAs: "העבר לחלון הזה" mints a new `active_window_token` and invalidates the old one. "חזור לדשבורד" redirects to `/dashboard`. |
| Resume detection | `/exam` Server Component looks for `exam_sessions` row where `user_id = $user AND status IN ('active','paused')`. If exists → modal "יש סימולציה פעילה, להמשיך?" with "המשך" (→ `/exam/play/[id]/0`) + "התחל חדש" (abandons the old, creates new). |
| Results screen | Pass/fail pill, score (X/40), %, time used, 3 cluster cards (correct/total + bar), flat list of 40 rows showing only `#row + status pill (נכון/שגוי/דולג)`. No subtopic labels, no drill-in, no 360° access. CTAs: "חזור לדשבורד" + "סימולציה נוספת". |

### From planning pass (this document)
| Decision | Value |
|---|---|
| **Routing** | Path segment `/exam/play/[idx]?session={id}` mirroring `/practice/play/[idx]`. Position is dense (0..39). |
| **Sidebar hiding strategy** | Branch in `app/(app)/layout.tsx` on the existing `x-pathname` header (already set by `lib/supabase/middleware.ts`). When `pathname.startsWith('/exam/')`, render `<main>{children}</main>` without `SidebarProvider`. Keeps the subscription gate intact — no separate route group needed. |
| **Idempotency on exam submit** | NEW partial unique indexes `attempts_unique_per_exam_source` + `attempts_unique_per_exam_angle` on `attempts(exam_session_id, source_question_id)` / `(exam_session_id, angle_question_id)` — Phase 2.7 only created the practice-side equivalents. (One small migration in Phase 0.) |
| **Atomic counter** | New `increment_exam_session_counters` RPC alongside the existing `increment_session_counters` (which is hard-coded to `practice_sessions`). Cleaner than overloading. |
| **Timer model** | Server-authoritative. `time_used_seconds` is incremented on every event (answer/skip/pause). Client also runs a visual countdown that resyncs from the server on every action. Server clamps `time_used_seconds ≤ total_duration_seconds`. Auto-submit fires when `time_used_seconds >= total_duration_seconds`. |
| **Bookmark in exam** | Reuse the existing `toggleBookmark` action by parameterising it on `session_kind`. Practice version reads `practice_sessions.question_list[position]`; exam version reads `exam_sessions.question_list[position]`. Either move into a shared helper or duplicate — Phase 3 decides. |
| **No DB schema changes** beyond the small idempotency-index migration above. `exam_sessions` and `attempts` already match spec §8.4.1/§8.4.3 (verified live 2026-05-13). |
| **Sampling RPC vs app-side** | App-side. `lib/db/exam.ts.sampleExamQuestions(userId)` shuffles per cluster in TS (Math.random is fine — same call we already make in `createPracticeSession`). |
| **Pool exhaustion fallback** | When a cluster can't satisfy its target, pad from the remaining global pool, then continue. No user-facing message. |

---

## 3. Current state — what exists (Slice 2 inventory)

### Routes
- `app/(app)/exam/page.tsx` — placeholder, prints `סימולציות בחינה (Slice 3)` after `requireActiveSubscription()`. No play/results routes exist.
- `app/(app)/practice/play/[idx]/page.tsx` + `_actions.ts` + `_components/*` — the patterns we'll mirror.
- `app/(app)/practice/summary/page.tsx` — practice-side summary (informational; we won't reuse the structure 1:1 because exam results are simpler).

### DB schemas (verified live)
- `public.exam_sessions` — exists with 15 columns matching spec §8.4.3 (id, user_id, question_list, total_duration_seconds default 6000, time_used_seconds default 0, status, questions_answered, questions_correct, final_score, passed, active_window_token, started_at, paused_at, completed_at, last_activity_at). 0 rows.
- `public.attempts` — exists with 14 columns matching spec §8.4.1, including `mode IN ('practice','exam')` and `exam_session_id` FK (currently always NULL — 53 attempt rows all `mode='practice'`).
- RLS: `users_own_exam_sessions` USING `(auth.uid() = user_id AND has_active_subscription())` plus admin SELECT. Same shape as `practice_sessions`.
- `record_bookmark_toggle` SECURITY DEFINER RPC — mode-agnostic; reusable from exam.
- `record_mistake` RPC — mode-agnostic. Spec is silent on whether wrong exam answers count toward `mistakes`. **Open question** (§ 9).
- `increment_session_counters` RPC — hard-coded to `practice_sessions`. Won't work for exam; need a sibling RPC.
- `attempts_unique_per_session_source` + `attempts_unique_per_session_angle` partial unique indexes — exist on practice side only. **Gap**: need exam-side equivalents.

### Layout / sidebar
- `app/(app)/layout.tsx` (line 124-136) unconditionally mounts `<SidebarProvider>` + `<AppSidebar>` + `<SidebarInset>` around `{children}`.
- `proxy.ts` + `lib/supabase/middleware.ts:10` set `x-pathname` header on every request — already used by the subscription-exempt check. The layout reads it via `headers().get('x-pathname')`.
- Conclusion: hiding the sidebar on `/exam/*` is a 5-line layout branch.

### Reusable primitives
| Component | Path | Reusable? | Notes |
|---|---|---|---|
| Choice button | `app/(app)/practice/play/_components/choice.tsx` (98 lines) | ✅ as-is | Already supports `revealed=false` (neutral, no green/red) — exam mode just never sets `revealed=true`. |
| Timer (countdown) | `app/(app)/practice/play/_components/timer.tsx` (98 lines) | ✅ as-is | Already accepts `initialSeconds + running + onExpired`. Wire `initialSeconds=remaining`, `onExpired=submitFinal`. Color change at < 600 s needs a tiny prop or class override. |
| Timer expiry dialog | `_components/timer-expired-dialog.tsx` (79 lines) | ❌ skip | Exam auto-submits silently — no dialog needed. |
| Exit confirm dialog | `_components/exit-confirm-dialog.tsx` (89 lines) | ⚠ extend | Pattern reusable; exam confirm copy is different ("X לא ענויות"). |
| Learning 360 panel | `_components/learning-360-panel.tsx` (239 lines) | ❌ never mounted | Spec §6.8 explicitly forbids 360° during exam. |
| Practice question shell | `_components/practice-question.tsx` (527 lines) | ❌ rebuild slim | Practice version owns 360° toggling, replay mode, bookmark icon, exit dialog. Exam shell is simpler: no 360°, no replay (exam doesn't "reveal" answers mid-run), backward nav, skip, pause. |
| `requireActiveSubscription` | `lib/auth/subscription-gate.ts` | ✅ as-is | Called at the top of each exam page. |
| Sidebar badges (bookmarks count) | `(app)/layout.tsx` | ✅ as-is | Bookmark adds during exam flush the badge via `revalidatePath('/', 'layout')` after `record_bookmark_toggle`. |

### DB helpers
- `lib/db/practice.ts` — large (1,200+ lines). Useful types (`Choice`, `AngleQuestionRow`, `SourceQuestionRow`, `AttemptRow`, `stripAnswerFromChoices`) but practice-specific naming on the session/list helpers. Slice 3 builds a parallel `lib/db/exam.ts` rather than overloading.
- `lib/validators/practice.ts` — Zod schemas; we'll add a parallel `lib/validators/exam.ts`.
- `lib/urls.ts` — has `practicePlayUrl`, `practiceSummaryUrl`. Add `examPlayUrl`, `examResultsUrl`, `examIntroUrl`.

---

## 4. Gap analysis

| Functional area | Verdict | Notes |
|---|---|---|
| **Routing & layout** | (c) New `/exam/play/[idx]` + `/exam/results/[id]`. (b) Layout-level sidebar-hiding branch is a 5-line edit. |
| **Sampling logic** | (c) New `lib/db/exam.ts.sampleExamQuestions`. Per-cluster weighted shuffle, app-side. Falls back to global pool when a cluster is short. |
| **Timer** | (a) Reuse `<Timer>` as-is for the visible countdown. (c) Server-authoritative `time_used_seconds` accounting in `submitExamAttempt` / `pauseExam` / `resumeExam`. |
| **Bookmark integration** | (a) Reuse `record_bookmark_toggle` RPC. (b) `toggleBookmark` action needs an exam variant that reads `exam_sessions.question_list` instead of `practice_sessions.question_list` to derive the target id/type. |
| **Pause/resume** | (c) New `pauseExam` + `resumeExam` actions that flip status and update `time_used_seconds`. Resume modal on `/exam` is new. |
| **Single-window guard** | (c) New. Token minted on session open, stored in `localStorage` under `lawpass.exam.{id}.windowToken`. Every server action validates the submitted token against `exam_sessions.active_window_token`. Mismatch → return `{ok:false, error:'window_conflict'}`. Client renders the full-page block + claim CTA. |
| **Autosave / resume edge cases** | (b) Mostly free — every server action already writes back to the row. Browser-close → next visit to `/exam` detects active session → modal. |
| **Submit + counters** | (c) New `submitFinalExam` action: computes `final_score`, `passed`, flips status to `completed`, sets `completed_at`. (c) New `increment_exam_session_counters` RPC. |
| **Results page** | (c) New, slim — no 360° drill-in. |
| **Sidebar hiding** | (b) One layout branch. |
| **Idempotency on exam attempts** | (c) One small migration to add two partial unique indexes. |
| **Mistakes write on wrong exam answer** | ❓ Open question — defer to PM. Spec is silent. See § 9. |

Net-new code surface (estimated): ~5 new routes, 1 new layout branch, 2 new db modules (`lib/db/exam.ts`, `lib/validators/exam.ts`), 1 cluster config (`lib/exam/clusters.ts`), 8–10 server actions, 7–10 client components, 1 small SQL migration. Total fresh code estimate: ~1,800–2,500 LOC (smaller than Slice 2 Phase 3 alone).

---

## 5. Phases — execution plan

### ⏳ Phase 0 — Prerequisites + scaffolding (2-3h, complexity S)
**Goal:** unblock parallel work in later phases; no user-visible behaviour.

**Files touched:**
- `supabase/migrations/2026XXXXXXXXX_exam_phase3_prerequisites.sql` (new)
  - `CREATE UNIQUE INDEX attempts_unique_per_exam_source ON attempts (exam_session_id, source_question_id) WHERE question_type='source' AND exam_session_id IS NOT NULL;`
  - `CREATE UNIQUE INDEX attempts_unique_per_exam_angle ON attempts (exam_session_id, angle_question_id) WHERE question_type='angle' AND exam_session_id IS NOT NULL;`
  - `CREATE FUNCTION public.increment_exam_session_counters(p_session_id uuid, p_was_correct boolean) RETURNS void` — SECURITY DEFINER, mirrors the practice version.
- `lib/urls.ts` — add `examIntroUrl()`, `examPlayUrl(sessionId, position)`, `examResultsUrl(sessionId)`.
- `lib/exam/clusters.ts` (new) — `EXAM_CLUSTERS` config object.
- `lib/validators/exam.ts` (new) — Zod schemas for every exam action (empty stubs; phases 1+ fill in).
- `app/(app)/layout.tsx` — branch on `pathname.startsWith('/exam/')` to skip `SidebarProvider`.
- `app/(app)/exam/page.tsx` — leave placeholder; Phase 2 replaces it.

**Acceptance criteria:**
- Migration applies cleanly via `Supabase:apply_migration`. Two new indexes show up in `\d attempts`. RPC callable from `authenticated` role, REVOKE from `PUBLIC`/`anon`.
- Visit `/exam` while logged in → page renders WITHOUT the sidebar (placeholder content visible full-bleed). Visit `/practice` → sidebar visible. Layout regression: zero — sidebar still mounts everywhere else.
- `pnpm tsc --noEmit && pnpm lint && pnpm test` clean.

**Dependencies:** none.

---

### ⏳ Phase 1 — Data layer + sampling (3-4h, complexity M)
**Goal:** `createExamSession` works end-to-end on the server; no UI yet.

**Files touched:**
- `lib/db/exam.ts` (new) — types (`ExamSessionRow`, `ExamQuestionListItem`, `ExamView`), helpers (`getExamSessionForUser`, `getQuestionForExamPosition`, `getExistingExamAttempt`, `sampleExamQuestions`).
- `lib/validators/exam.ts` — `createExamSessionSchema` (no inputs other than CSRF/auth; the action is parameterless).
- `app/(app)/exam/_actions.ts` (new) — `createExamSession()` action.
- `tests/exam-sampling.test.ts` (new) — unit tests for the cluster-weighted sampler:
  - With current DB (live or fixture): cluster א yields 14, ב yields 11, ג yields 13.
  - With a starved cluster (e.g., insolvency_arbitration=0, execution=5): cluster ג yields ≤25 (deduped within one exam), padded from global pool until 13.
  - Two consecutive `sampleExamQuestions(userId)` calls produce different `question_list` arrays (smoke test — randomness not asserted exactly).

**Acceptance criteria:**
- `createExamSession()` inserts an `exam_sessions` row with `status='active'`, `question_list` of length 40, `time_used_seconds=0`, `total_duration_seconds=6000`, `active_window_token` populated. Abandons any prior `active`/`paused` session for the same user first.
- Returns `{ok:true, url: examPlayUrl(sessionId, 0)}`.
- Cluster split (14/11/13) holds for the current production pool. Falls back gracefully if a cluster can't fill — pads from global pool, no error.
- Unit tests pass.

**Dependencies:** Phase 0 (clusters config + URL helpers).

---

### ⏳ Phase 2 — Intro screen + resume modal (2-3h, complexity S)
**Goal:** `/exam` route is a real intro screen with resume detection.

**Files touched:**
- `app/(app)/exam/page.tsx` — Server Component. `requireActiveSubscription()` → query `exam_sessions WHERE user_id=$user AND status IN ('active','paused')`. If exists, hand to `<ResumePrompt>` (client). Else `<ExamIntro>` (client) with the static copy + "התחל בחינה" button.
- `app/(app)/exam/_components/exam-intro.tsx` (new) — static intro card. CTA fires `createExamSession()` and `window.location.assign(url)` on success.
- `app/(app)/exam/_components/resume-prompt.tsx` (new) — small `<AlertDialog>`-based modal. "המשך" → `examPlayUrl(activeSession.id, examSession.questions_answered)`. "התחל חדש" → calls a new `abandonActiveExamSession()` action, then `createExamSession()`.
- `app/(app)/exam/_actions.ts` — add `abandonActiveExamSession()`.

**Acceptance criteria:**
- Fresh user → `/exam` shows intro card. Click "התחל בחינה" → lands on `/exam/play/0?session=...` (Phase 3 implements the route).
- User with an active session → `/exam` shows the resume modal. "המשך" goes to current `questions_answered` position. "התחל חדש" abandons + creates a new one.
- Sidebar hidden throughout `/exam/*` (Phase 0 verified).
- E2E (PM-side): create session, refresh `/exam`, modal appears. Close + reopen browser → same modal appears (autosave is implicit via DB persistence).

**Dependencies:** Phase 1.

---

### ⏳ Phase 3 — Play screen (timer, choices, navigation, bookmark, pause) (6-8h, complexity L)
**Goal:** user can sit the full exam: answer all 40, navigate back/forward, skip, pause, bookmark.

**Files touched:**
- `app/(app)/exam/play/[idx]/page.tsx` (new) — Server Component. Pattern mirrors `app/(app)/practice/play/[idx]/page.tsx`:
  - Auth gate.
  - Resolve session; redirect on `completed`/`abandoned`.
  - Resolve question at position via `getQuestionForExamPosition`.
  - Strip `is_correct` from choices (always — exam never reveals).
  - Look up existing attempt for this `(exam_session_id, question_id)` → pre-fill the user's prior selection (so backward nav restores the choice).
  - Look up bookmark state via the existing `getBookmarkState` helper.
  - Detect window-token conflict: server reads cookie/header set by client (carries the token claimed at session open). Mismatch → render `<WindowConflict>` block component instead of the question.
- `app/(app)/exam/play/_components/exam-question.tsx` (new, ~250 LOC) — client. Owns: timer running state, currently-selected letter (pre-filled from existing attempt), bookmark state. Renders: header (back arrow → prev, position counter, cluster pill, timer, bookmark icon, "סיים בחינה"), question text, 4 `<Choice>` cards, footer (Skip + Next).
- `app/(app)/exam/play/_components/exam-header.tsx` (new) — header cluster: `{idx+1} / 40`, cluster code badge (`א`/`ב`/`ג`), timer (red < 600 s), bookmark, "סיים בחינה". No breadcrumb. No subtopic chip. No exit-confirm in the header — the "סיים בחינה" button uses its own confirm modal (different from practice).
- `app/(app)/exam/play/_components/exam-submit-confirm-dialog.tsx` (new) — small. Shows count of unanswered. CTA: "סיים בחינה" (calls `submitFinalExam`) / "חזור לבחינה" (close).
- `app/(app)/exam/play/_components/window-conflict.tsx` (new) — full-page block. Two buttons: "העבר לחלון הזה" (calls `claimExamWindow(sessionId)` → mints new token, server invalidates old) / "חזור לדשבורד".
- `app/(app)/exam/_actions.ts` — add `submitExamAttempt(input)`, `advanceExam(input)` (forward), `goPrevExam(input)` (backward), `skipExamQuestion(input)`, `toggleExamBookmark(input)`, `pauseExam(sessionId)`, `resumeExam(sessionId)`, `claimExamWindow(sessionId)`. Every action validates the window token and bumps `time_used_seconds` server-side.
- `lib/validators/exam.ts` — schemas for every action.
- `lib/urls.ts` — `examPlayUrl` already in Phase 0.

**Server timer accounting (the contract):**
- Client sends `clientElapsedSeconds` (from `performance.now()` delta since the last server round-trip) with every action.
- Server clamps to `[0, remaining_seconds]` and adds to `time_used_seconds`. On every read, returns the new `remaining_seconds` for the client to resync.
- Pause action: snapshots `time_used_seconds` and sets `paused_at`. Resume: clears `paused_at`. Server-side `time_used_seconds` does NOT advance while paused — the *client* simply pauses its setInterval and resyncs on resume.

**Acceptance criteria:**
- Visit `/exam/play/0?session=X` → renders question 1/40 with a counting timer.
- Click a choice → server records attempt (ON CONFLICT DO UPDATE so backward nav + re-pick overwrites cleanly), client moves to position 1.
- Backward nav: visit `/exam/play/0?session=X` again → the previously-chosen letter is highlighted (pre-filled). Picking a different letter overwrites the attempt.
- Skip: leaves no attempt row (or inserts with `was_skipped=true, selected_choice_id=null` — Phase 3 decides which is simpler; spec § 8.4.1 allows either since the `is_correct` is nullable). Submit logic must count skips as wrong.
- Pause: status → `paused`, modal/banner reads "הסימולציה מושהית — לחץ להמשך". Timer freezes. Resume flips status back, timer continues.
- Bookmark icon toggles via `toggleExamBookmark` → sidebar badge increments after navigation (`revalidatePath('/', 'layout')`).
- Timer at 0:00: auto-submit fires silently. Lands on `/exam/results/[id]` (Phase 4).
- Manual "סיים בחינה" with unanswered remaining → confirm modal with count. Confirm → submit; Cancel → close.
- Second-window open: opening `/exam/play/0?session=X` in tab B mints new local token, server detects mismatch on first action in tab A → tab A goes to full-page block.

**Dependencies:** Phase 2.

---

### ⏳ Phase 4 — Submit + Results screen (3-4h, complexity M)
**Goal:** final-state UX is complete; user can re-take.

**Files touched:**
- `app/(app)/exam/_actions.ts` — `submitFinalExam(sessionId)`:
  - Reads all attempts for `exam_session_id=sessionId`. Computes `final_score` (count of `is_correct=true`), `passed` (≥24).
  - Updates row: `status='completed'`, `final_score`, `passed`, `completed_at=NOW()`, `last_activity_at=NOW()`.
  - `revalidatePath('/', 'layout')`. Returns `{ok:true, url: examResultsUrl(sessionId)}`.
- `app/(app)/exam/results/[id]/page.tsx` (new) — Server Component. Loads session + attempts + per-cluster aggregates via a new helper `getExamResultsAggregate(supabase, userId, sessionId)` in `lib/db/exam.ts`.
- `app/(app)/exam/results/_components/exam-results.tsx` (new) — top: pass/fail pill + score + percentage + time used. Middle: 3 cluster cards (correct/total + bar). Bottom: flat 40-row list `{idx+1} | status pill (נכון/שגוי/דולג)`. Footer CTAs: "חזור לדשבורד", "סימולציה נוספת" (creates new session, full-page nav).
- `lib/db/exam.ts` — `getExamResultsAggregate` (joins attempts → source_questions/angle_questions → chapters to derive cluster code per attempt).

**Acceptance criteria:**
- Submit any session → land on `/exam/results/[sessionId]`. Score matches `COUNT(attempts WHERE is_correct=true AND exam_session_id=...)`. Skips counted as wrong (excluded from numerator, included in denominator of 40).
- Cluster cards sum correctly: cluster `א` correct/total = subset of attempts whose underlying question is in `civil_proc`, etc. Bar width = correct/total × 100%.
- Each of the 40 rows shows the right status pill: נכון (green), שגוי (red), דולג (gray).
- "סימולציה נוספת" → new exam session created, redirects to play. The old completed session stays in DB (for analytics in future).
- E2E (PM-side, lawpass10@gmail.com): take a full 40-question exam; visit results; verify clusters tally; click "סימולציה נוספת"; new session starts.

**Dependencies:** Phase 3.

---

### ⏳ Phase 5 — Single-window guard + autosave/resume edge cases (2-3h, complexity M)
**Goal:** harden the multi-window + browser-close scenarios.

**Files touched:**
- `app/(app)/exam/play/_components/window-conflict.tsx` — full implementation (Phase 3 stubs the component).
- `app/(app)/exam/_actions.ts` — `claimExamWindow` action implementation + token validation helper used by every other exam action.
- `app/(app)/exam/play/_components/exam-question.tsx` — wire the local-storage token write on mount, attach it to every action call.
- (Optional) `app/(app)/exam/_components/exam-storage-event.tsx` — listens to `window.addEventListener('storage', …)` to detect when another tab claims, and proactively goes to the block screen.

**Acceptance criteria:**
- Open `/exam/play/0?session=X` in tab A. Open same URL in tab B. Tab B mints a new token (overwrites the stored token). Tab A's next action returns `window_conflict`. Tab A shows full-page block.
- Click "העבר לחלון הזה" in tab A → mints new token; tab B's next action returns `window_conflict`. (Last-tab-wins symmetry.)
- Close browser mid-exam → `exam_sessions.status` stays `active`, `time_used_seconds` reflects the latest action. Reopen → `/exam` shows resume modal → click "המשך" → lands at the correct position with the correct remaining time.
- Network blip mid-action: client retries (Phase 3 already idempotent via partial indexes); no double-counted time, no duplicate attempt rows.

**Dependencies:** Phase 3 + Phase 4.

---

### ⏳ Phase 6 — Polish + a11y + mobile RTL smoke (2-3h, complexity S)
**Goal:** ship-ready.

**Files touched:**
- Visual polish per the prototype (`prototype/exam.jsx` — see § 8 — Open Questions; not in repo).
- `app/(app)/exam/play/_components/exam-header.tsx` — red timer at < 600 s. Animation on timer cross-over (subtle pulse, optional).
- Keyboard nav: arrow keys to switch question, 1-4 / א-ד to pick choice, Esc to open submit dialog (optional).
- Aria labels on the bookmark + skip + pause icons.
- Mobile sanity: at 375px width the header doesn't overflow; bookmark icon is touch-target sized.
- Sidebar regression test: every non-`/exam` route still renders the sidebar; `/bookmarks` still shows count.

**Acceptance criteria:**
- `pnpm tsc --noEmit && pnpm lint && pnpm build && pnpm test` all green.
- Manual PM smoke on prod: enter exam, answer 5 in 1 minute, pause, leave, come back, finish, see results.
- Any prototype-divergence noted as Slice 4 followups, not blockers.

**Dependencies:** Phase 5.

---

## 6. Total time estimate

| Phase | Estimate | Cumulative |
|---|---|---|
| 0 — Prereqs + scaffolding | 2-3h | 2-3h |
| 1 — Data layer + sampling | 3-4h | 5-7h |
| 2 — Intro + resume modal | 2-3h | 7-10h |
| 3 — Play screen | 6-8h | 13-18h |
| 4 — Submit + results | 3-4h | 16-22h |
| 5 — Single-window + autosave | 2-3h | 18-25h |
| 6 — Polish + ship | 2-3h | 20-28h |

**Calendar: 1.5-2 weeks of focused work to ship Slice 3 internally.** Smaller than Slice 2 (which was 30-37h) because the DB tables exist, many primitives are reusable, and the results screen is intentionally simplified.

---

## 7. Risk surface

| Risk | Severity | Mitigation |
|---|---|---|
| **Cluster ג under-pool (only 25 questions, target 13)** — every exam takes most of `execution`, and `insolvency_arbitration` is empty in production today. Repeats inevitable. | 🟡 Medium | PM-accepted: small-pool tradeoff. Mitigation upstream: Sharon's next batches should prioritise `insolvency_arbitration` content. No code mitigation needed for the slice. |
| **Server timer drift** — client's `performance.now()` delta vs. server clock differ over a 100-minute session. | 🟡 Medium | Server is authoritative. Every action returns the new `remaining_seconds`. Client setInterval resyncs from that value, never trusts itself for `time_used_seconds`. Worst case: visible countdown jitters by ~1s after each action. |
| **Backward nav + attempt overwrite logic** — user picks ב for Q3, navigates to Q5, returns to Q3, picks ד. The attempt row needs to update, not duplicate. | 🟡 Medium | Use `INSERT … ON CONFLICT DO UPDATE` keyed on the new exam-side partial unique indexes (Phase 0 migration). Cleaner than DELETE-then-INSERT. |
| **Single-window guard misfire** — user closes tab A intentionally, reopens fresh → carries the old token in localStorage → conflicts with itself. | 🟡 Medium | On `/exam` page load, re-read the session's current `active_window_token` and write it to localStorage unconditionally (only the *play* page treats a stale token as a conflict). PM should sanity-check this flow during Phase 5 e2e. |
| **Exam autosubmit at 0:00 racing with the user clicking "סיים בחינה"** — both fire `submitFinalExam`; the second one finds `status='completed'` and errors. | 🟢 Low | Make `submitFinalExam` idempotent: if status is already `completed`, return the existing results URL. |
| **Wrong exam answers writing to `mistakes`** — Practice writes via `record_mistake`. Spec is silent on whether exam-mode wrong answers also should. | 🟢 Low (decision-blocked) | PM decides before Phase 3. Default in this plan: **do NOT write to mistakes from exam mode** — exam is a snapshot, the user reviews via the results page, not via the long-running `/mistakes` list. |
| **Sidebar hiding regression** — if the `/exam/*` check in the layout is too broad/narrow, it can leak. | 🟢 Low | Single source of truth: `pathname.startsWith('/exam/') || pathname === '/exam'`. Phase 0 acceptance criterion verifies both leaf and root. |
| **Prototype divergence** — `prototype/exam.jsx` not in repo (referenced but absent). Implementation will work from text spec only. | 🟢 Low | Phase 3/4 visual matches the SPEC copy verbatim; PM signs off on visual at Phase 6. If the prototype surfaces mid-build, fold it in as a polish pass. |

---

## 8. Open questions (PM to decide before Phase 0)

1. **Mistakes-write on wrong exam answer** — should `submitExamAttempt` call `record_mistake` on a wrong answer the way `submitAttempt` does in practice mode? My recommendation in this plan: **no**, but a one-line answer locks it in. (Risk #6.)

2. **Skip semantics in DB** — when a user skips, do we (a) insert an `attempts` row with `was_skipped=true, selected_choice_id=NULL, is_correct=NULL`, or (b) insert nothing and infer "skipped" at submit time from missing rows? The first is more queryable for analytics; the second is fewer writes. Recommendation: **(a) — insert with `was_skipped=true`** for symmetry with practice mode's idempotency model.

3. **Cluster code in `attempts` row** — should we denormalise the cluster code onto each attempt at insert time (cheap; saves a JOIN at results time) or always compute it via JOIN on the source/angle → chapter → cluster mapping? Recommendation: **JOIN at results time** — cluster mapping is config and may shift; denormalising would freeze it.

4. **"Back to dashboard" mid-exam** — the spec doesn't list a "leave without submitting" CTA. Today the only exits are `סיים בחינה` (manual submit) and `Pause`. Should there be a "Save & exit" that flips to `paused` and goes to `/dashboard`? Recommendation: **yes**, fold into Phase 3's `pauseExam` action and add an icon/menu option. PM confirms.

5. **Results-screen drill-in** — strictly out of scope for this slice per the PM brief, but the data is there. Confirm: PM is OK leaving results as a flat row list with no link out to the question? (Spec §7.3.2 describes drill-in as the future shape; spec §6.8 step 11 has it as MVP. The PM brief overrides — but want explicit confirm.)

6. **Prototype availability** — `prototype/exam.jsx` is referenced in the planning brief but is not in the repo or `~/Downloads`. PM to confirm whether to wait for it before Phase 3/4 visual work or proceed from the spec.

7. **Network-disconnect resilience** — spec §6.8 mentions "מערכת שומרת מצב כל פעולה". Today this is implicit (every server action writes). Should we add a client-side retry queue for failed actions, or accept that a brief disconnect simply blocks the next action until the user retries? Recommendation: **accept the simple model** — out of scope for MVP.

8. **Multi-window cross-device** — `active_window_token` blocks two tabs on the same browser. Does it block tab-on-laptop + tab-on-phone? **Yes** — same row, same token, both write to localStorage of different browsers. The phone tab claims, the laptop tab blocks. PM should confirm this matches the intent of "single window".

---

## 9. Out of scope for Slice 3 (defer)

- 360° drill-in on results page (Slice 5+)
- Notes / feedback icons during exam (Slice 5+ for notes; feedback in practice already)
- Per-question subtopic labels on results (cluster card is the level of detail this slice ships)
- Network-disconnect retry queue (defer)
- Pool-exhaustion banner (PM said no message; repeats happen silently)
- Cross-device multi-window UX (treated as single-window today; works correctly per current spec)
- Analytics dashboard for exam history (Slice 4+)
- Email summary of exam results (Slice 7)
- Admin "view exam attempts" panel (Slice 6 — admin tools)
- "Continue exam from the previous tab" handshake (we just have last-tab-wins; richer UX deferred)

---

## 10. Conventions (carried from Slice 2)

1. `requireActiveSubscription()` at the top of every protected page Server Component.
2. Server Action return shape: `{ok:true} | {ok:false, error:string}`. Cross-layout-redirect: `{ok:true, url:string}`, client does `window.location.assign(result.url)`.
3. Every mutation that touches sidebar-visible state calls `revalidatePath("/", "layout")`.
4. Fail-recovery on every error branch of session-establishing actions.
5. PostgREST function ACL: REVOKE EXECUTE FROM PUBLIC, anon + GRANT EXECUTE TO authenticated.
6. `(SELECT auth.uid())` wrapped in all RLS policies and SECURITY DEFINER bodies.
7. RTL throughout — `<html lang="he" dir="rtl">`, `text-align: start/end`.
8. Heebo font for Hebrew (no serif).
9. Zod v4 + react-hook-form + sonner.
10. Structured logging prefix `[exam]`.
11. Explicit `"use client"` on interactive components.
12. Direct push to `main`; CI is the safety net.

---

## 11. Next steps

1. **PM reviews this document.** Answers the 8 open questions in § 8. Flags any phase reordering preferences.
2. **PM greenlights Phase 0.** Phases 1-6 follow sequentially; each ends with a clear acceptance line.
3. **Claude Code writes Phase 0 SQL migration** (idempotency indexes + counter RPC) and lands the sidebar-hiding layout branch in one commit. PM applies the migration via Supabase MCP.
4. **Sharon's content cadence is independent of this slice.** Cluster ג will be repeat-heavy until `insolvency_arbitration` is seeded — flag for content roadmap but don't block the slice.
5. **At Phase 6 close**, this document gets a v2 update with the actual cumulative hours, any new decisions made mid-build, and the punchlist for Slice 4.
