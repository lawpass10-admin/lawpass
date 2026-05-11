# Slice 2 Plan Review

**Reviewer:** Claude (Opus 4.7) · **Date:** May 11, 2026
**Plan reviewed:** `SLICE_2_PLAN.md` (12 sections, May 11, 2026)
**Codebase verified against:** `main` @ `ba3549a`
**DB verified live via Supabase MCP** (project `yxwggfvhpvszcigkztol`)

This is a planning-pass review. No feature code was written, no migrations were run. The PM should treat Part 2 risk #1 (NULLS DISTINCT) as a blocker that must be addressed before Phase 3 begins.

---

## Part 1 — Architecture review (per phase)

### Phase 0 — Wave 2 Infrastructure (~3h plan / 4–5h realistic)

- **Scope:** Right ballpark, time is tight. Three error boundaries + two loading shells + CI workflow + Vitest setup with RTL + 5–10 unit tests in 3 hours assumes everything is well-charted. Vitest with React 19 / Next 16 / Turbopack isn't well-charted — `jsdom` setup, path aliases, and the `lucide-react@^1.14` ESM-only resolution will eat at least 60–90 minutes alone.
- **Exit criteria gap:** "Push deliberately broken commit → CI catches" verifies the workflow runs. It does *not* verify the error boundaries actually catch a thrown error from a child Server Component — Next 16 + RSC's `error.tsx` behavior differs from older Pages-Router intuition. Add a manual test: throw from inside a page body and confirm the boundary renders.
- **Missing dependency:** `package.json` currently has no `test` script ([package.json](package.json) ends at "lint"). Phase 0 should add `"test": "vitest run"` and the matching `pnpm test` step in CI. Plan section 9's "modified files" list misses `package.json`.
- **Order:** Phase 0 blocks nothing in Phase 1 (PM-side manual seed). Run them in parallel — Phase 1 can complete in 30 minutes while CI is still being wired.

### Phase 1 — Seed first question (~1h, PM-side)

- **Scope:** Realistic for one question.
- **Hidden gap:** `source_questions` has NO unique constraint on `external_id` — verified live via `pg_constraint`. A re-run of the manual insert will create a duplicate `2019-S-Q11`. Either guard with a `SELECT NOT EXISTS` pre-check, or add a `UNIQUE (external_id) WHERE is_current = true` partial index. Slice 1 has indexes (`idx_source_q_external_id`) for lookup speed but no uniqueness enforcement.
- **Plan documentation errors in Section 4 (cheat sheet)** — fix before writing any code:
  - `practice_sessions.status` does **not** allow `paused`. Live CHECK is `('active','completed','abandoned')`. The plan says "active/paused/completed" — wrong on both axes.
  - `angle_questions.angle_letter` allows `'ה'` (5 letters total) and `display_order` is CHECK 1–5. Plan says 1–4. We're using 1–4, but the schema accepts more — fine, but document it.
  - `attempts` has a structural CHECK enforcing **XOR** between `source_question_id` and `angle_question_id` (one must be NOT NULL, the other NULL, matching `question_type`). Plan's cheat sheet omits this — and Phase 3's `submitAttempt` design must honor it.

### Phase 2 — PracticeSetup (~3h plan / 4–5h realistic)

- **Scope:** Underestimated. Breakdown:
  - Server Component fetch of chapters + subtopics (~30m)
  - Multi-select chapter UI — no shadcn primitive, must build with Checkbox + state (~60–90m)
  - Conditional subtopic selector when exactly 1 chapter selected (~30m)
  - Reactive "כרגע יש N שאלות זמינות" subtitle — requires either a `getAvailableQuestionCount` Server Action called on selection change, or pre-fetching counts in the page render (only works if `selected_chapters` is in searchParams) (~45m)
  - `createPracticeSession` Server Action with random sampling, angle expansion, JSONB construction (~90m)
- **Dependency the plan misses:** Phase 2 cannot be meaningfully demoed against an empty `chapters` table — Phase 1 must complete first. Plan section 6 lists Phase 1 first, so order is fine; just call out hard dependency.
- **Subtle correctness:** The plan says "random-samples `source_count_target` questions." This must happen **at session creation** and the result frozen in `question_list` JSONB. Never resample on resume. Implicit in the plan but should be stated.

### Phase 3 — PracticeQuestion (~5h plan / 7–9h realistic)

- **Scope:** Significantly underestimated. The 360° panel has 9 distinct sub-sections, each with format-specific rendering (table for distractor_analysis × 4 choices, tag chips for `concepts_and_skills` JSONB, ordered list for `references_list` JSONB, `whitespace-pre-wrap` for `quick_thinking_360`, etc.). Just the panel and its sub-components is 3 hours of focused work.
- **Critical correctness bug** — see Part 2 risk #1. The plan's "upsert: increment count" on `mistakes` will **not deduplicate** because `bookmarks` and `mistakes` unique indexes use `NULLS DISTINCT` (the Postgres default). Verified live: `pg_index.indnullsnotdistinct = false`. ON CONFLICT will not fire when one of the constrained columns is NULL — which is *always* the case in this schema (source vs. angle is mutually exclusive via NULL). Without a fix, every wrong answer creates a new mistakes row.
- **Exit criteria gap:** Add explicit "DB inspection" checks. After a full session: `SELECT COUNT(*) FROM attempts WHERE practice_session_id = X` = `question_list.length`; `SELECT COUNT(*) FROM mistakes WHERE user_id = X` matches the *distinct* number of question_groups they got wrong, not the total wrong count.

### Phase 4 — PracticeSummary (~2h)

- **Scope:** Realistic for the render-only portion. Aggregation queries are straightforward.
- **Dependency the plan misses:** Summary queries `attempts` joined to `source_questions`/`angle_questions` for subtopic display. **`source_questions` RLS = `(status='active' AND is_current=true AND has_active_subscription())`.** If an admin archives a question between answer-time and summary-load, the join silently drops that row from the breakdown — totals are off. Mitigations: (a) SECURITY DEFINER aggregation RPC that bypasses RLS, (b) admin client (not great — Hardening Rule), or (c) widen the RLS to include archived for historical reads. Default recommendation: SECURITY DEFINER RPC for the summary stats; apply Hardening Rule #5 (REVOKE/GRANT).

### Phase 5 — Bookmarks + Mistakes (~2h plan / 3–4h realistic)

- **Scope:** Optimistic. The plan says "polish placeholder routes to actually show bookmarked questions." That requires:
  - List query joining `bookmarks` → `source_questions` (via `question_group_id` lookup) → `subtopics` for display
  - Same RLS-against-archived problem as Phase 4
  - `toggleBookmark` Server Action with the NULLS DISTINCT correctness issue
- **Scope conflict with plan section 8:** Section 8 lists "Full 'המאגר שלי' with notes, search, filter" as deferred to Slice 5. Section 6 Phase 5 says "polish to actually show bookmarked questions." Reconcile: Phase 5 = read-only list, no notes/search/filter. Otherwise Slice 5 has nothing to do.

### Phase 6 — Polish + Edge cases (~3h plan / 5–6h realistic)

- **Scope:** Catch-all phases always slip. Realistic breakdown:
  - Resume-session detection + UI prompt: 1.5h
  - Timer states + color shift: 30m
  - Exit confirmation modal: 45m
  - Error states + empty states: 1h
  - A11y / RTL keyboard nav + aria labels: 1.5h
- **Recommendation:** Distribute these into the phases that introduce them (see Part 5). A monolithic Phase 6 reliably balloons.

### Cross-cutting time estimate

Plan: 19 hours. Realistic: **26–32 hours**, plus 4–6h debugging the NULLS DISTINCT migration if it bites mid-Phase-3. Calendar 2 weeks is OK if PM can absorb 50% slippage.

---

## Part 2 — Risks the PM missed

### 1. NULLS DISTINCT bug — **blocks Phase 3 correctness**

Verified live: `bookmarks_user_id_question_type_source_question_group_id_an_key` and the equivalent on `mistakes` have `indnullsnotdistinct = false`. Postgres default. The constrained columns are `(user_id, question_type, source_question_group_id, angle_question_id)`. For a source-question row, `angle_question_id` is NULL. Two rows with `(u, 'source', X, NULL)` are treated as **distinct** by the constraint, so `INSERT ... ON CONFLICT (...) DO UPDATE` doesn't fire.

Consequences:
- Every wrong source-question answer creates a new mistakes row. The user's mistakes list grows unboundedly. `mistakes_count` is never incremented.
- Double-clicking the bookmark icon creates two bookmark rows.
- Sidebar badge counts overcount.

Fix options (in order of preference):
1. Migration in Phase 0: `ALTER INDEX ... NULLS NOT DISTINCT` (Postgres 17 supported, confirmed via `database.version: 17.6.1.111`)
2. Replace with two partial unique indexes: one `WHERE question_type='source'` on `(user_id, source_question_group_id)`, one `WHERE question_type='angle'` on `(user_id, angle_question_id)`. Cleaner long-term.
3. App-level SELECT-then-INSERT-or-UPDATE in a transaction. Worst — race-prone.

### 2. RLS hides archived/non-current questions for historical retrieval

`source_questions` policy `active_users_view_active_source_questions` = `(status='active' AND is_current=true AND has_active_subscription())`. Same pattern on `source_choices`, `angle_questions`, `angle_choices`. This affects:
- **Mid-session resume:** if an admin archives a question between session creation and the user's next page load, the question fetch returns nothing — page breaks.
- **Summary aggregation:** joins drop archived rows; totals diverge from `attempts.is_correct` counts.
- **Bookmarks/Mistakes list pages:** archived questions vanish from the user's list, even though the bookmark/mistake row still exists.

Decision needed (see Part 3 question #2). Lowest-effort fix: SECURITY DEFINER RPC for read paths that need historical access; keep client-facing RLS strict.

### 3. `bookmarks` and `mistakes` reference `question_group_id`, not `source_question_id`

Plan section 4 cheat sheet mentions this in passing but Phase 3's `submitAttempt` and Phase 5's `toggleBookmark` will need to JOIN through `source_questions` to derive `question_group_id` from the `source_question_id` they hold in memory. Easy to miss — every wrong-path insert needs the extra lookup.

### 4. `attempts` XOR CHECK constraint

`attempts_check` = `((question_type='source' AND source_question_id NOT NULL AND angle_question_id NULL) OR (question_type='angle' AND angle_question_id NOT NULL AND source_question_id NULL))`. `submitAttempt` must split on `question_type` and set exactly one of the two FK columns. Naïve "set both to the value, NULL the other" works only with case-by-case branching.

### 5. No idempotency on `attempts`

A user double-clicks the submit button → two attempts rows for the same question. Plan doesn't address. Fix: client-side disable on submit + server-side check `EXISTS (SELECT FROM attempts WHERE practice_session_id=X AND idx-position=Y)`. The `question_list` JSONB stores ordering, so `idx` is the natural disambiguator. Could add a partial unique index `(practice_session_id, source_question_id) WHERE question_type='source'` etc.

### 6. Router Cache will bite `/practice/play?session=X&idx=N` navigation

Next.js 16 caches Server Component segments by route + searchParams. Going from `idx=2` → `idx=3` on the same route segment may serve stale RSC payload. This is the same class of bug Slice 1 hit (see [lib/auth/subscription-gate.ts:8-13](lib/auth/subscription-gate.ts:8)). Either:
- Use `export const dynamic = 'force-dynamic'` on `/practice/play/page.tsx`
- Or use a real path segment `/practice/play/[idx]/page.tsx`
- Or revalidate explicitly after `advanceToNext`

Plan recommends the searchParams approach but doesn't anticipate the cache.

### 7. Sidebar badge counts (`bookmarksCount`, `mistakesCount`) won't update without revalidation

`(app)/layout.tsx:110-122` fetches counts. Server Action `submitAttempt` writes mistakes but doesn't `revalidatePath("/", "layout")`. Until next nav, the sidebar shows stale counts. Slice 1 already established the pattern ([app/(auth)/_actions.ts:349, 455, 545](app/(auth)/_actions.ts:349)) — Phase 3 must follow.

### 8. RTL issues specific to the 360° panel

- **Distractor analysis table:** mixed-direction content. Choice letters (`א`/`ב`) read RTL; surrounding Hebrew analysis text is RTL; but if `distractor_analysis` includes Latin citations they're LTR. Need `dir="auto"` on cells.
- **`concepts_and_skills` tag chips:** Hebrew tags need RTL flow; if tags wrap, the natural reading order across lines reverses unexpectedly. Use `flex-row-reverse` carefully or rely on `dir="rtl"` parent.
- **`references_list`:** Each item potentially has Hebrew title + Latin citation ("Goldstein, 2018"). `dir="auto"` per item.
- **`quick_thinking_360` whitespace-pre-wrap:** Pre-formatted text with embedded `\n\n`. CSS `text-align: start` is fine but if any line starts with a Latin character or number, that line's `dir="auto"` will flip — visible misalignment.

### 9. Caching/revalidation traps not in Section 7

- `practice_sessions` row mutations (`submitAttempt` updates `questions_answered`/`questions_correct`/`last_activity_at`) — if the next page re-fetches the session, the read may hit the cached version. The plan's flow alternates write → navigate → read, which means each `advanceToNext` must `revalidatePath` the dynamic route segment.
- `revalidatePath('/practice/play', 'page')` vs `revalidatePath('/', 'layout')` — the layout-level one is heavier but ensures badge counts update. The page-level one is enough to refresh the question payload but not the sidebar.

### 10. Race: user with two browser tabs

Two tabs, same active session, alternate answers. There's no `active_window_token` on `practice_sessions` (unlike `exam_sessions` which has one). Both tabs will write to the same session row. Plan doesn't flag. Probably acceptable for MVP but worth a brief decision.

### 11. `attempts.duration_seconds` lacks a server source-of-truth

Plan says "Server logs duration_seconds based on submit timestamp - question_started_at." But `question_started_at` isn't stored anywhere server-side. Either:
- Client measures (Performance API) and sends `duration_seconds` in the submitAttempt payload (clamp to 0–300s server-side)
- Or store `current_question_started_at` on `practice_sessions` and update it on each `advanceToNext`. Server reads it on submit.

Plan defers but doesn't pick. Pick one before Phase 3.

---

## Part 3 — Decisions the PM should make NOW (5–10 flags, no answers)

1. **`question_list` JSONB schema** — `[{type, id}]` (positional via array index) vs `[{type, id, position}]` (explicit). Recommend explicit `position` for resume stability and easier debugging.

2. **`attempts.selected_choice_id` source** — Plan inserts both `selected_choice_id` and `selected_letter`. If the choice text changes via question_group versioning, an attempt that only stores the letter loses the link to the exact choice text it referred to. Recommend: always store `selected_choice_id`; derive `selected_letter` server-side via JOIN.

3. **Mid-session archival behavior** — Admin sets `is_current=false` or `status='archived'` while a session has that question in its `question_list`. Skip silently and advance? Hard error? Show with a "no longer available" placeholder? Recommend: skip silently with a passing toast `"שאלה זו הוסרה זמנית"`.

4. **Active-session-resume policy** — User has `practice_sessions.status='active'` and lands on `/practice`. Auto-resume? Prompt "continue or start new"? Silent abandon-and-replace? Recommend: prompt modal with two CTAs. Sets the abandoned session's status correctly.

5. **`duration_seconds` measurement source** — Client measures and sends, or server stores `current_question_started_at` and computes on submit? Recommend client-measured + server-clamped (0–300s) for simplicity.

6. **Snapshot-vs-live for question_list resolution** — When `advanceToNext` reads `question_list[idx]` and fetches the question, does it resolve through `question_group_id` (so a re-versioned question gives the user the new version mid-session) or pin to the exact `id` snapshotted at session creation? Recommend pin-to-id with archival fallback — versioning during a session is an admin-shoots-foot scenario.

7. **Bookmark/Mistake group_id lookup location** — `toggleBookmark` accepts `source_question_id` or `source_question_group_id`? Recommend accept `source_question_id` (what the page already has in memory) and lookup `question_group_id` server-side.

8. **Random sampling fairness** — `ORDER BY random() LIMIT N` allows the same question to appear in back-to-back sessions. Exclude already-attempted? Weight toward never-attempted? Recommend: no weighting for MVP, plain `random()`.

9. **Choice display order** — `source_choices.display_order` is stored in DB. Plan implies render in that order. Should we randomize per session (so user can't memorize "always pick א")? Recommend: keep DB order for MVP; if Sharon flags pattern-memorization, randomize in Slice 7.

10. **`completeGoogleOAuthSignup` parity for Practice mode resume** — When a user resumes a session after sign-out + sign-in, do we treat the old active session as continuable or abandoned? Recommend: continuable if `last_activity_at` within 24h, else auto-abandon on next `/practice` load.

---

## Part 4 — Code-level concerns

### Server Action return-shape — pick a convention up front

Slice 1 evolved a hybrid pattern in [app/(auth)/_actions.ts:31-53](app/(auth)/_actions.ts:31):
- Simple actions: `{ok:true} | {ok:false, error:string}`
- Session-establishing or cross-layout-redirect actions: `{ok:true, url:string} | {ok:false, error:string}`, client does `window.location.assign(result.url)`

Practice Mode actions:
- `createPracticeSession` → `{ok:true, url}` (crosses no layout but client navigation desired)
- `submitAttempt` → `{ok:true}` or `{ok:true, isCorrect, correctChoiceId}` for inline feedback
- `advanceToNext` → `{ok:true, url}` (next question or summary)
- `toggleBookmark` → `{ok:true, bookmarked:bool}` for optimistic UI

The plan doesn't specify. Standardize before writing.

### Client Components vs Server Components — explicit "use client" needed

Plan section 9 lists files but doesn't mark which are Client Components. The interactive ones (`practice-setup-form`, `practice-question`, `timer`, `choice`, `learning-360-panel`) are all `"use client"`. The page.tsx files are Server Components. This matches Slice 1's pattern ([app/(auth)/signup/_components/signup-form.tsx](app/(auth)/signup/_components/signup-form.tsx) is `"use client"`; [app/(auth)/signup/page.tsx](app/(auth)/signup/page.tsx) is not). Just call it out explicitly per file.

### Structured logging prefix convention

Slice 1 uses `[profile]`, `[billing]` ([app/(auth)/_actions.ts:175, 187](app/(auth)/_actions.ts:175), [app/(app)/_actions.ts:69, 80](app/(app)/_actions.ts:69)). Phase 3+ should use `[practice]`. Pattern: `console.info('[practice] submit_attempt OK user=X session=Y position=Z is_correct=true')`. Plan doesn't mention.

### `revalidatePath` on every mutation

Slice 1's pattern: every Server Action that mutates DB state and changes what the layout shows calls `revalidatePath("/", "layout")` before redirect ([app/(auth)/_actions.ts:349](app/(auth)/_actions.ts:349), [app/(app)/_actions.ts:86](app/(app)/_actions.ts:86)). Apply to:
- `submitAttempt` → mutates `mistakes`, `bookmarks` counts → revalidate layout
- `toggleBookmark` → revalidate layout
- `createPracticeSession`, `advanceToNext` → revalidate `/practice/play` page-level
- Final question's `advanceToNext` → revalidate layout (so badge counts reflect session-end state)

### `lib/db/practice.ts` introduces a convention not present in Slice 1

Slice 1 inlines all DB queries into pages and Server Actions (compare [app/(app)/dashboard/page.tsx:93](app/(app)/dashboard/page.tsx:93) and [app/(auth)/_actions.ts:358](app/(auth)/_actions.ts:358)). Introducing `lib/db/practice.ts` is a new pattern. If genuinely shared (e.g., the session+question fetch reused across `/practice/play` and `/practice/summary`), worth doing. Otherwise inline. Decide before writing.

### Existing utilities to reuse

- `requireActiveSubscription()` ([lib/auth/subscription-gate.ts](lib/auth/subscription-gate.ts)) — every protected page Server Component, including `/practice/play`, `/practice/summary`
- `getHebrewGreeting()` ([lib/greetings.ts](lib/greetings.ts)) — reusable on the summary page if we want a "great session!" header
- `PLAN_LABELS` map convention ([app/(app)/dashboard/page.tsx:47](app/(app)/dashboard/page.tsx:47), [components/app/app-sidebar.tsx:50](components/app/app-sidebar.tsx:50)) — duplicated in two places already; if Slice 2 needs more such maps (chapter labels?), consolidate to `lib/labels.ts`

### Dead code / scaffolding

- [app/(app)/practice/page.tsx](app/(app)/practice/page.tsx) is a 6-line placeholder — full replacement, plan section 9 acknowledges
- [app/(app)/bookmarks/page.tsx](app/(app)/bookmarks/page.tsx), [app/(app)/mistakes/page.tsx](app/(app)/mistakes/page.tsx) are 6-line placeholders — Phase 5 replaces partially
- `components/app/app-sidebar.tsx:182-202` already wires `bookmarksCount`/`mistakesCount` — no change needed beyond ensuring revalidation fires

### Naming consistency

Slice 1 uses snake_case for DB columns (`full_name`, `birth_date`) and camelCase for TS variables (`fullName`, `birthDate`). Server Actions take camelCase input ([app/(auth)/_actions.ts:209](app/(auth)/_actions.ts:209) `SignupInput`). Plan's `createPracticeSession` input shape isn't specified — assume camelCase (`selectedChapters`, `sourceCountTarget`).

### `package.json` script for tests

Phase 0 adds Vitest but plan section 9's modified-files list misses `package.json`. Need `"test": "vitest run"` and CI step. Trivial but a footgun.

---

## Part 5 — What I'd change in the plan

### 1. Add a NULLS DISTINCT migration to Phase 0 (or insert a Phase 0.5)

This is the single most important plan change. Without it, Phase 3 ships a data-correctness bug. The migration itself is ~10 lines, runs in milliseconds, and Postgres 17 supports `ALTER INDEX ... ALTER COLUMN ... NULLS NOT DISTINCT` natively. Better: drop the existing unique index and create two partial unique indexes that match question_type. Either way: do it in Phase 0.

### 2. Combine Phase 3 (Question) + Phase 4 (Summary)

They share the session-state read path, the same RLS-archived-question concern, the same `attempts` query for aggregation. Splitting forces re-deriving the joins in two files when 80% is shared. Combined estimate: 7–9h. Aligns with `/practice/play` and `/practice/summary` sharing `lib/db/practice.ts` helpers.

### 3. Distribute Phase 6 into the phases that introduce features

Resume-session → Phase 2 (creation). Empty states → Phase 2 (setup). Timer color shift → Phase 3 (question render). Exit confirmation → Phase 3 (question UX). RTL/a11y fixes → each phase as components land. A monolithic Phase 6 always slips because nothing is enforcing it.

### 4. Phase 1 should seed 3+ source questions, ideally 2 across different chapters

With 1 question:
- Phase 2's count=5/10/20/50 buttons are permanently disabled — can't visually test enabled state
- Phase 3's transition logic (source→angle→source) can be tested for 1 source + 4 angles, but the "next source" transition can't
- Multi-chapter selection in Phase 2 can't be tested at all
- Random sampling can't be visibly demonstrated

Minimum: 1 source + 4 angles in chapter A, 1 source + 4 angles in chapter B. Total: 2 source + 8 angle questions = ~30 minutes of MCP inserts (you already have the template from `2019-S-Q11`).

### 5. Reorder: Phase 0 and Phase 1 in parallel, not sequential

They share zero files. Phase 1 is 30–60 minutes of pasted SQL. Phase 0 is 3–5 hours of code + config. Run them in parallel; Phase 2 starts when both finish.

### 6. Fix Section 4 cheat sheet errors before any Phase 2+ code

- `practice_sessions.status`: `('active','completed','abandoned')` — NOT `paused`
- `angle_questions`: 5 letters allowed, `display_order` 1–5 (we use 4)
- `attempts`: document the XOR CHECK
- `source_questions.status`: `('draft','active','archived')`
- `bookmarks_check`, `mistakes_check`: document the XOR CHECK between source_question_group_id and angle_question_id
- Unique constraints exist on `bookmarks` and `mistakes` BUT use NULLS DISTINCT — call this out explicitly

### 7. Phase 2 needs an explicit `getAvailableQuestionCount` Server Action

The "כרגע יש N שאלות זמינות לפרק שבחרת" subtitle changes reactively as the user toggles chapters/subtopics. Options:
- Server Action returning the count, called via `useTransition` on change
- Pass `selected_chapters` via searchParams and re-render Server Component (slower, requires URL churn)

Pick the action approach; bake it into Phase 2 scope.

### 8. Pin the random-sampling implementation strategy

Plan says "random-samples." Implementation candidate: `SELECT id FROM source_questions WHERE chapter_id = ANY($1) AND ... ORDER BY random() LIMIT $2`. This is fine for low row counts. Document it; otherwise the implementer will reach for `TABLESAMPLE` or other surprises.

### 9. Add explicit `dynamic = 'force-dynamic'` (or path-segment) decision to Phase 3

`/practice/play?session=X&idx=N` and Next 16 Router Cache will not play nicely. Decide now: path segment `/practice/play/[idx]` or force-dynamic. Recommend path segment — survives shared-link scenarios better and is naturally cache-keyed.

---

## Part 6 — Three questions to send back to the PM

### Q1 — NULLS DISTINCT fix scope

The `bookmarks` and `mistakes` unique indexes are broken (NULLS DISTINCT default makes ON CONFLICT a no-op for our schema). Three options:

(a) Phase 0 migration that adds `NULLS NOT DISTINCT` to both indexes (Postgres 17 supports it; ~10-line migration)
(b) Phase 0 migration that drops + recreates as two partial unique indexes per `question_type` (cleaner long-term, ~20 lines)
(c) Defer; handle in application code with SELECT-then-update in a transaction (works but bug-prone)

Which do you want? I recommend (b) — partial indexes survive future schema changes better.

### Q2 — RLS for historical reads

`source_questions` RLS hides archived/non-current rows from authenticated reads. This breaks Phase 4 summary aggregation, Phase 5 bookmarks/mistakes list, and Phase 6 mid-session resume if admin archives a question. Three options:

(a) Add a `SECURITY DEFINER` aggregation/lookup RPC per use case (most invasive, Hardening Rule #5 applies)
(b) Widen the RLS policy to allow read of archived questions when joined via `attempts`/`bookmarks`/`mistakes` ownership (medium complexity)
(c) Just accept that admin archival mid-session breaks the user's session; document and move on (cheapest)

For an MVP I'd recommend (c) plus a passing toast `"השאלה הזו הוסרה זמנית מהמערכת"` — admins shouldn't archive mid-day. But this is a product call.

### Q3 — Phase 3 timer-state ownership

Where does `question_started_at` live? Client measures via `performance.now()` and sends `duration_seconds` in `submitAttempt` payload, or server stores `current_question_started_at` on `practice_sessions` and updates on each `advanceToNext`?

Client measurement is simpler (one column saved); server storage is more accurate (resistant to client clock drift, tab freeze, refresh). Plan defers but doesn't pick. Which?

---

## Appendix — verification artifacts

DB state confirmed live via Supabase MCP (project `yxwggfvhpvszcigkztol`, Postgres 17.6.1.111):

- `practice_sessions.status` CHECK: `'active','completed','abandoned'` (NO `paused`)
- `attempts_check`: XOR enforced between source_question_id / angle_question_id by question_type
- `bookmarks_check`, `mistakes_check`: same XOR pattern between source_question_group_id / angle_question_id
- `bookmarks` unique key: `(user_id, question_type, source_question_group_id, angle_question_id)` with `indnullsnotdistinct = false`
- `mistakes` unique key: same shape, same `indnullsnotdistinct = false`
- `source_questions` RLS: `(status='active' AND is_current=true AND has_active_subscription())`
- `angle_questions`/`angle_choices`/`source_choices` RLS: same filter via JOIN to source_questions
- `chapters`/`subtopics` RLS: any authenticated user can SELECT
- `has_active_subscription()` is `STABLE SECURITY DEFINER` — safe inside RLS
- No partial unique on `attempts` for idempotency
- `angle_letter` CHECK allows `'א','ב','ג','ד','ה'` (5 letters)
- `angle_questions.display_order` CHECK: 1–5
- `practice_sessions.angles_per_source` CHECK: 0–5

Slice 1 patterns verified in code:
- Subscription gate: [lib/auth/subscription-gate.ts](lib/auth/subscription-gate.ts) — page-level, returns user+subscription
- Layout-level fetch + gate: [app/(app)/layout.tsx:55-104](app/(app)/layout.tsx:55) — Promise.all, x-pathname header from middleware
- Server Action shapes: [app/(auth)/_actions.ts:31-53](app/(auth)/_actions.ts:31)
- Fail-recovery (signOut + clearStaleAuthCookies): [app/(auth)/_actions.ts:115-120, 301-303, 313-314, 342-343, 643-644](app/(auth)/_actions.ts:115)
- Structured logging prefix: `[profile]`, `[billing]` ([app/(auth)/_actions.ts:175, 187](app/(auth)/_actions.ts:175), [app/(app)/_actions.ts:69, 80](app/(app)/_actions.ts:69))
- `revalidatePath("/", "layout")` after auth/sub mutations: 4 callsites in Slice 1
