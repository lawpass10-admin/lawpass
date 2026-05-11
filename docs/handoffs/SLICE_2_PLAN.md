# Slice 2 — Practice Mode · Master Plan (v3)

**Project:** LawPass · **Status:** Phase 0/0.5/1/2 shipped; Phase 3 prerequisites in progress · **Date:** May 11, 2026
**Previous:** Slice 1 closed (Foundation + Auth) · Production live at `https://law-pass.com`
**Reviewed by:** Claude Code — see `docs/handoffs/SLICE_2_PLAN_REVIEW.md` (v2 review) and `docs/handoffs/PHASE_3_DISCOVERY_REPORT.md` (v3 discovery, if present)

**v3 changes:**
- 4 PM blocker decisions confirmed (bookmark target on angle, mistakes-write strategy, replay mode, completed-session URL)
- 7 clarifications resolved (exit confirmation, prefill format, skip deferral, etc.)
- Phase 2.7 added (DB prerequisites for Phase 3): SECURITY DEFINER RPCs + idempotency indexes
- Phase 3 estimate revised: 7-9h → 15-16h (per discovery report)
- Technical findings inlined: URL helper module, timer model, position math, atomic counter increment

---

## 1. What we're building

Slice 2 = **Practice Mode**. A user with an active subscription can:

1. Configure a practice session (chapters, subtopic, source count, angles per source, time per question)
2. Run through the questions one by one (source question, then optional 0-4 angles, then next source)
3. Answer each question, see correct/wrong feedback, view full 360° pedagogical analysis inline
4. Bookmark questions, get auto-tracked into "mistakes" on wrong answers
5. See a session summary at the end (success rate, breakdown by subtopic, mistakes added)

This is the user-facing centerpiece of LawPass.

---

## 2. Confirmed decisions

### From PM (May 11, original)

| Decision | Value |
|---|---|
| Data seeding strategy | Manual via Supabase MCP (PM-side) |
| 360° display layout | Inline only (no drawer) |
| Wave 2 infrastructure | Slim (~3h), Sentry deferred to Slice 7 |
| Angles per source | 0-4 (schema allows 0-5, we use 4) |
| Source count buttons | 5/10/20/50, always visible, disabled when DB has too few |
| Subtopic selector visibility | Only when exactly 1 chapter is selected |
| Timer at 0 seconds | Visual warning only (no auto-submit) |
| Git workflow | Direct push to `main`, CI is the safety net |

### From Claude Code review (May 11, v2)

| Decision | Value |
|---|---|
| NULLS DISTINCT fix strategy | Two partial unique indexes per `question_type` (applied in Phase 0.5) |
| RLS for archived questions | Accept session breakage; toast "השאלה הזו הוסרה זמנית מהמערכת. עוברים לשאלה הבאה." |
| Timer measurement | Client-side via `performance.now()` for `duration_seconds`, plus `setInterval` for visual countdown |
| Routing for question pages | Path segment `/practice/play/[idx]?session={id}` |
| `lib/db/practice.ts` helper module | Yes, created in Phase 3 |

### From PM (May 11, v3 — after discovery report)

| Decision | Value |
|---|---|
| **B1: Bookmark target on angle question** | Bookmark the angle itself (`question_type='angle'`, `angle_question_id=<id>`). Source question keeps `question_type='source'`, `source_question_group_id=<id>`. |
| **B2: Mistakes/bookmarks write strategy** | SECURITY DEFINER RPCs (`record_mistake`, `record_bookmark_toggle`). Supabase JS `.upsert()` can't target partial unique indexes. |
| **B3: Replay mode** | YES. Visiting a URL of an already-answered position shows the question in view-mode: user's prior choice highlighted, 360° panel auto-expanded, "השאלה הבאה" button still present. |
| **B4: Completed session URL** | Visiting `/practice/play/N?session=X` when session is `completed` redirects to `/practice/summary?session=X`. |
| **"סיים סשן" behavior** | If `questions_answered > 0` → set status='completed', redirect to `/practice/summary`. If `questions_answered = 0` → set status='abandoned', redirect to `/practice` (no summary). |
| **Exit confirmation modal** | YES. Shadcn AlertDialog before "סיים סשן" when `0 < answered < total`. |
| **Prefill format for "תרגול נוסף"** | URL params (`?chapters=civil,criminal&count=10&angles=3&time=150`), not base64. |
| **Skip support in Phase 3** | NO. Defer to Slice 5. Schema supports `was_skipped=true` but UI doesn't expose. |
| **Choice display randomization** | NO. Use DB `display_order` for MVP. |
| **`attempts.selected_choice_id` AND `selected_letter`** | Store both. Server derives letter from choice id. |
| **Idempotency on submit** | Partial unique indexes on `attempts` per question_type prevent duplicate submissions on retry. |
| **Atomic counter increment** | Via `increment_session_counters` RPC. No SELECT-then-UPDATE race in app code. |
| **URL helper module** | `lib/urls.ts` with `practicePlayUrl(sessionId, position)`, `practiceSummaryUrl(sessionId)`, `practiceSetupUrl(prefill?)`. |
| **Typography** | Heebo throughout. No serif font. Prototype's serif accents not ported. |

---

## 3. Current state — what exists

### From Slice 1 (✅ live in production)
- Full DB schema (15 tables, 36 RLS policies, 3 MViews)
- Auth flows (email signup, OTP, Google OAuth, login, password reset)
- App shell with sidebar (bookmarksCount/mistakesCount badges)
- Pricing + checkout (mock subscriptions)
- Dashboard with empty states
- 5 placeholder routes: `/practice`, `/exam`, `/bookmarks`, `/mistakes`, `/statistics`
- Subscription gate (`requireActiveSubscription()`)
- 5 Hardening Rules enforced

### From Slice 2 (✅ shipped)
- **Phase 0** (`285667a`): error boundaries, loading states, Vitest, CI
- **Phase 0.5** (`e45233c` + applied via MCP): 4 partial unique indexes on `bookmarks` and `mistakes`
- **Phase 1** (via Supabase MCP): 1 chapter, 1 subtopic, 1 source_q (`2019-S-Q11`), 4 source_choices, 4 angle_questions, 16 angle_choices
- **Phase 2** (`1a5abaf`): `/practice` PracticeSetup page, `createPracticeSession` Server Action, resume-prompt component, full e2e tested

### Prototype assets (in PM's hand, NOT in repo)
- `practice-setup.jsx` — already implemented in Phase 2
- `practice-question.jsx` — prototype for Phase 3 PracticeQuestion (the heart)
- `practice-summary.jsx` — prototype for Phase 3 PracticeSummary

---

## 4. DB schema cheat sheet

### `chapters`
- `id` uuid pk · `code` text · `title` text · `display_order` int
- RLS: any authenticated user can SELECT

### `subtopics`
- `id` uuid pk · `chapter_id` fk · `code` text · `title` text · `display_order` int
- RLS: any authenticated user can SELECT

### `source_questions`
- `id` uuid pk · `question_group_id` uuid · `version` int · `is_current` bool
- `external_id` text (NOT unique-constrained; index for speed)
- `chapter_id` fk · `subtopic_id` fk
- `question_text` text · `source_metadata` jsonb
- **360° fields:** `legal_topic_analysis`, `full_explanation`, `common_pitfall`, `concepts_and_skills` (jsonb array), `quick_thinking_360`, `summary_for_memory`, `references_list` (jsonb array)
- `status` text — CHECK: `('draft','active','archived')`
- `created_by` fk → admin user
- **RLS:** `(status='active' AND is_current=true AND has_active_subscription())` — archived rows are hidden

### `source_choices`
- `id` uuid pk · `source_question_id` fk · `letter` (א/ב/ג/ד) · `choice_text` text
- `is_correct` bool · `distractor_analysis` text (NULL-allowed) · `display_order` int (1-4)
- RLS: via JOIN to source_questions

### `angle_questions`
- `id` uuid pk · `source_question_id` fk · `angle_letter` (CHECK allows א/ב/ג/ד/ה, we use 4)
- `display_order` int (CHECK 1-5, we use 1-4)
- `angle_title` text · `question_text` text · same 7 × 360° fields
- RLS: via JOIN to source_questions

### `angle_choices`
- Same structure as source_choices, with `angle_question_id` fk
- RLS: via JOIN to angle_questions

### `practice_sessions`
- `id` uuid pk · `user_id` fk
- `selected_chapters` jsonb (array) · `selected_subtopics` jsonb (array)
- `source_count_target` int · `angles_per_source` int (CHECK 0-5, we use 0-4)
- `time_per_question_seconds` int (default 150)
- `question_list` jsonb — array of `{type:"source"|"angle", id:uuid, position:int}` in dense order
- `status` text — CHECK: `('active','completed','abandoned')` — NO `paused`
- `questions_answered` int · `questions_correct` int
- `started_at`, `completed_at`, `last_activity_at`

### `attempts`
- `id` uuid pk · `user_id` fk · `question_type` ('source'/'angle')
- `source_question_id` fk or `angle_question_id` fk
- XOR CHECK: exactly one of source/angle FK populated per question_type
- `selected_choice_id` fk · `selected_letter` text · `is_correct` bool
- `mode` ('practice'/'exam') · `practice_session_id` fk · `exam_session_id` fk
- `duration_seconds` int · `was_skipped` bool · `attempted_at` timestamp
- **Idempotency (Phase 2.7):** partial unique indexes per question_type on `(practice_session_id, source_question_id)` and `(practice_session_id, angle_question_id)`

### `bookmarks`
- `id` uuid pk · `user_id` fk · `question_type` text
- `source_question_group_id` or `angle_question_id` (XOR)
- Phase 0.5 partial unique indexes per question_type
- Phase 2.7: writes go through `record_bookmark_toggle` RPC (SECURITY DEFINER)

### `mistakes`
- `id` uuid pk · `user_id` fk · `question_type` text
- `source_question_group_id` or `angle_question_id` (XOR)
- `mistakes_count` int · `manually_removed` bool · `last_mistake_at`, `created_at`
- Phase 0.5 partial unique indexes per question_type
- Phase 2.7: writes go through `record_mistake` RPC (SECURITY DEFINER)

### New RPCs from Phase 2.7
- `record_mistake(p_question_type, p_source_question_group_id, p_angle_question_id)` — RETURNS VOID. ON CONFLICT increments `mistakes_count`, resets `manually_removed` to false, updates `last_mistake_at`.
- `record_bookmark_toggle(p_question_type, p_source_question_group_id, p_angle_question_id)` — RETURNS BOOLEAN (true = now bookmarked, false = removed). Toggles existence.
- `increment_session_counters(p_session_id, p_was_correct)` — RETURNS VOID. Atomic +=1 on `questions_answered`, conditional +=1 on `questions_correct`, updates `last_activity_at`. Validates session belongs to caller and status='active'.

All three are SECURITY DEFINER with `SET search_path = public, pg_temp`. ACL: REVOKE FROM PUBLIC, anon; GRANT TO authenticated. (Hardening Rule #6.)

---

## 5. Conventions from Slice 1 — must follow

1. `requireActiveSubscription()` at the top of every protected page Server Component
2. Server Action return shape:
   - Simple: `{ok:true} | {ok:false, error:string}`
   - Cross-layout-redirect: `{ok:true, url:string}`, client does `window.location.assign(result.url)`
   - Mutating actions affecting sidebar badges: call `revalidatePath("/", "layout")` before return
3. Fail-recovery on every error branch of session-establishing actions
4. `.nullish()` over `.nullable()` for `user_metadata` validations
5. PostgREST function ACL: REVOKE EXECUTE FROM PUBLIC, anon + GRANT EXECUTE TO authenticated
6. `(SELECT auth.uid())` wrapped in all RLS policies and SECURITY DEFINER bodies
7. RTL throughout — `<html lang="he" dir="rtl">`, `text-align: start/end`
8. Heebo font for Hebrew (no serif, even where prototype shows it)
9. Zod v4 + react-hook-form + sonner
10. Structured logging prefix `[practice]`
11. Explicit `"use client"` on interactive components

---

## 6. Phases — execution plan

### ✅ Phase 0 — Wave 2 Infrastructure (DONE, commit `285667a`)
Error boundaries, loading states, CI, Vitest. 22 tests passing.

### ✅ Phase 0.5 — NULLS DISTINCT fix (DONE, commit `e45233c` + applied via MCP)
Partial unique indexes on `bookmarks` and `mistakes` per question_type.

### ✅ Phase 1 — Seed Q11 (DONE, via Supabase MCP)
1 chapter, 1 subtopic, 1 source_q + 4 source_choices + 4 angles + 16 angle_choices.

### ✅ Phase 2 — PracticeSetup (DONE, commit `1a5abaf`)
Multi-chapter selection, source count, angles, time, resume prompt. Live at production.

### ⏳ Phase 2.5 — PM-side seed expansion (~30 min, no commit)
PM creates via Supabase MCP:
- 3 dedicated E2E users (`e2e-3m@`, `e2e-6m@`, `e2e-nosub@`) with known passwords stored in `.env.local`
- 1 mock duplicate of `2019-S-Q11` with new `external_id` (e.g. `2019-S-Q11-mock`) in a different subtopic — allows multi-source flow testing

### ⏳ Phase 2.7 — DB prerequisites for Phase 3 (current; ~1 hour)
One migration file at `supabase/migrations/20260511000002_practice_phase3_prerequisites.sql`:
- `record_mistake` SECURITY DEFINER RPC
- `record_bookmark_toggle` SECURITY DEFINER RPC
- `increment_session_counters` SECURITY DEFINER RPC
- 2 partial unique indexes on `attempts` for idempotency

PM applies the migration manually via Supabase MCP after Claude Code pushes the SQL file. Verification:
- Each function exists with correct signature
- Each function has REVOKE/GRANT ACL applied
- Two indexes exist on attempts: `attempts_unique_per_session_source`, `attempts_unique_per_session_angle`

### ⏳ Phase 3 — PracticeQuestion + PracticeSummary (~15-16 hours, REVISED from 7-9h)

**Files to create:**
- `app/(app)/practice/play/[idx]/page.tsx` — Server Component (path-segment route)
- `app/(app)/practice/play/_components/practice-question.tsx` — `"use client"`
- `app/(app)/practice/play/_components/learning-360-panel.tsx` — 9-section inline 360° panel
- `app/(app)/practice/play/_components/timer.tsx` — performance.now()-anchored, setInterval-driven display
- `app/(app)/practice/play/_components/choice.tsx` — choice button with reveal states
- `app/(app)/practice/play/_components/exit-confirm-dialog.tsx` — shadcn AlertDialog wrapper
- `app/(app)/practice/play/_actions.ts` — `submitAttempt`, `advanceToNext`, `toggleBookmark`, `exitSession`
- `app/(app)/practice/summary/page.tsx` — Server Component
- `lib/db/practice.ts` — shared DB query helpers
- `lib/urls.ts` — `practicePlayUrl`, `practiceSummaryUrl`, `practiceSetupUrl`

**Files to modify:**
- `lib/validators/practice.ts` — add `submitAttemptSchema`, `advanceToNextSchema`, `toggleBookmarkSchema`, `exitSessionSchema`
- `app/(app)/practice/page.tsx` — accept and parse `?prefill=...` search params

**Key behaviors:**
- URL: `/practice/play/[idx]?session={id}` — `idx` is path segment (Router Cache safe), `session` is search param
- Page reads `practice_sessions.question_list[idx]`, fetches the source_question or angle_question with all choices + 360° fields via `lib/db/practice.ts` helper
- Position math: use `session.question_list.length` for total. Never use `sourcesTotal * (1 + anglesPerSource)`.
- Client renders: question text, 4 choices, timer (manual start with "התחל טיימר" button), bookmark icon in topbar
- Timer model: `useRef(performance.now())` at mount captures `questionRenderedAt`; on submit, `durationSeconds = Math.round((performance.now() - questionRenderedAt.current) / 1000)`. Server clamps 0-600. `setInterval` separately drives the visible M:SS countdown from `time_per_question_seconds`.
- User clicks choice → `submitAttempt` Server Action:
  - Validates ownership + session status
  - Inserts row in `attempts` (ON CONFLICT DO NOTHING via idempotency index — retries safe)
  - Calls `record_mistake` RPC if `is_correct=false`
  - Calls `increment_session_counters` RPC (atomic)
  - Returns `{ok:true, isCorrect, correctChoiceId, correctLetter}` for inline feedback
  - `revalidatePath("/", "layout")` for sidebar mistake count
- 360° panel reveals inline with 9 sub-sections (always inline, never drawer):
  1. ✅ Correct answer banner (success bg)
  2. 📚 ניתוח הנושא המשפטי
  3. ⚖️ הסבר משפטי מלא
  4. 🎯 ניתוח מסיחים (table: 4 rows, distractor_analysis per choice; if NULL, render `<span>—</span>`)
  5. ⚠️ מלכודת נפוצה
  6. 🏷️ מושגים ומיומנויות (concepts_and_skills jsonb array → tag chips)
  7. ⚡ חשיבה מהירה 360° (quick_thinking_360 with `\n\n`, rendered `whitespace-pre-wrap`, container `dir="rtl"`)
  8. 📝 מבט מסכם לזכירה
  9. 📖 רפרנסים (references_list jsonb array → `<ul>`, each `<li dir="auto">` for mixed Heb/Latin citations)
- "השאלה הבאה" → `advanceToNext` Server Action → returns `{ok:true, url}` (next idx OR summary URL); cross-segment to summary uses `window.location.assign(url)` per Slice 1 convention
- Bookmark icon → `toggleBookmark` Server Action → calls `record_bookmark_toggle` RPC; for source question pass `source_question.question_group_id`; for angle pass `angle_question.id`; revalidatePath layout
- "סיים סשן" → exit-confirm-dialog → `exitSession` Server Action:
  - If `questions_answered > 0`: status='completed', completed_at=NOW(), redirect to `/practice/summary`
  - If `questions_answered = 0`: status='abandoned', redirect to `/practice`

**Replay mode (B3):**
- Page Server Component checks if `attempts` row exists for this `(session_id, question_id)` pair
- If exists: pre-render with `selectedLetter` filled, `revealed=true`, 360° panel auto-expanded
- If session status='completed': redirect to summary (B4)
- "השאלה הבאה" button still present and advances normally (replay can step through)

**Archived question mid-session:**
- `lib/db/practice.ts.getQuestionForPosition` returns `{kind:"archived"}` when RLS hides the row
- Page shows toast "השאלה הזו הוסרה זמנית מהמערכת. עוברים לשאלה הבאה"
- Auto-calls `advanceToNext` with `was_skipped=true` semantics (no attempt row inserted, counters not incremented)

**Summary page:**
- Read session + attempts JOIN to source_questions/angle_questions + subtopics + chapters
- Display: top success %, source/angle breakdown, subtopic breakdown bars (prefix with chapter name when session spans multiple chapters: `סדר דין אזרחי / הודעה לצד שלישי   5/5`)
- If 100% correct: green encouragement banner `🎯 מצוין! ענית נכון על כל השאלות` (no red mistakes banner)
- If <100%: red mistakes banner with count
- CTAs: "חזור לדשבורד" → `/dashboard`; "תרגול נוסף" → `/practice?chapters=...&count=...&angles=...&time=...` (prefill from this session's settings)

### ⏳ Phase 4 — Bookmarks + Mistakes integration (~3-4 hours)
Read-only lists at `/bookmarks` and `/mistakes`. Logic mostly already exists from Phase 3's `toggleBookmark` action.

### ⏳ Phase 5 — Polish, edge cases, shipping (~2-3 hours)
A11y (keyboard nav, aria labels), mobile RTL test, cross-browser test, CI green.

---

## 7. Critical risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `.upsert()` can't target partial indexes | 🔴 RESOLVED via Phase 2.7 | SECURITY DEFINER RPCs handle ON CONFLICT server-side |
| Source question archived mid-session | 🟡 Medium | Toast + auto-skip via advanceToNext; no attempt row inserted |
| Router Cache stale on `/practice/play` navigation | 🟡 Medium | Path segment + explicit revalidatePath in advanceToNext |
| Sidebar badges stale after attempts | 🟡 Medium | Every mutating Server Action calls `revalidatePath("/", "layout")` |
| Duplicate attempts on retry | 🟡 Medium → RESOLVED Phase 2.7 | Idempotency partial unique indexes on attempts |
| Two-tab counter race | 🟡 Medium → RESOLVED Phase 2.7 | Atomic `increment_session_counters` RPC |
| Replay mode complexity | 🟢 Low | Server Component reads existing attempts; client receives pre-revealed state |
| Position math drift | 🟢 Low | Use `question_list.length`, never multiplication |
| 360° fields with newlines + RTL | 🟢 Low | `whitespace-pre-wrap` + container `dir="rtl"`, inline `dir="auto"` on citations |
| URL helper duplication | 🟢 Low | New `lib/urls.ts` consolidates 3+ call sites |
| Subtopic breakdown when archived | 🟢 Low | Bucket archived-attempted as "—" subtopic row |
| Session with 0 attempts hitting summary | 🟢 Low | exitSession redirects to /practice instead of /summary if answered=0 |

---

## 8. Out of scope for Slice 2 (defer)

- Exam Mode — Slice 3
- Subscription upgrade (3m→6m) — Slice 4
- "המאגר שלי" with notes, search, filter, RLS widening — Slice 5
- Admin Panel for question management — Slice 6
- Onboarding spotlight tour — Slice 7
- Email notifications, analytics, Sentry — Slice 7
- Skip support (`was_skipped` button) — Slice 5
- Choice display randomization — Slice 5
- Bulk question import script — defer
- Server-side timer ownership — defer

---

## 9. Time estimate (REVISED v3)

| Phase | Estimate | Cumulative |
|---|---|---|
| ✅ Phase 0 + 0.5 + 1 + 2 | 9-12 done | done |
| ✅ Phase 2.5 — PM seed expansion | 0.5 (PM-side) | 9-12.5 |
| ⏳ Phase 2.7 — DB prerequisites | 1 (Claude Code) + 0.5 (PM apply) | 10-14 |
| ⏳ Phase 3 — Question + Summary | **15-16** | **25-30** |
| ⏳ Phase 4 — Bookmarks + Mistakes | 3-4 | 28-34 |
| ⏳ Phase 5 — Polish + ship | 2-3 | 30-37 |

**Calendar: 2-3 weeks of focused work to ship Slice 2.**

---

## 10. Next steps

1. ✅ Plan v3 reviewed by PM (May 11)
2. **▶ NOW:** Claude Code writes this plan to disk + creates Phase 2.7 migration file (single commit)
3. PM applies Phase 2.7 migration via Supabase MCP, verifies functions and indexes
4. PM creates 3 E2E users + mock seed question via Supabase MCP
5. PM writes Phase 3 implementation prompt for Claude Code (includes the practice-question.jsx prototype inline)
6. Claude Code implements Phase 3 in one session
7. PM verifies via Vercel MCP + Supabase MCP + manual e2e
