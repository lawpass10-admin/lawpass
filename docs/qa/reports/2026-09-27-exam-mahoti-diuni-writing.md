# QA Report — 2026-09-27 — browser QA pass

**Environment:** Next 16.2.4 (Turbopack) `:3000`, Express `:4000`,
`NEXT_PUBLIC_API_BASE_URL` set. Account `qa1@lawpass.com` (QA tester, 6-month
plan). Playwright-style browser automation, **localhost only**.

**Groups covered:** A (public), B (auth), C (gates), D (dashboard), F (exam
simulation, partial), G (custom exam), H (mahoti), I (diuni), J1–J2
(writing-task reads), and `/exam-archive`.
**Not covered:** J3–J6 (AI grading — real spend), N (admin, skipped by
request), K/L writes, F5–F7 (submit-final, exit, window conflict).

---

## Context that reframes everything below

**`/exam` has no entry point anywhere in the UI.** There is no `href="/exam"`
in any component. The sidebar is five items
(`components/app/app-sidebar.tsx`), and `/bookmarks`, `/mistakes`, `/notes`
are explicitly commented out at lines 103–105. `/practice` *is* still linked
(dashboard hero/mastery/trend cards, bookmarks and mistakes pages), but the
40-question timed simulation is reachable only by typing the URL.

So the live, navigable study surface is: **dashboard → writing-task, mahoti,
diuni, exam-archive**. Findings on `/exam` are real but sit on an orphaned
surface; findings on mahoti/diuni sit on the primary path. The severities
below reflect that.

**Open question for the team, still unanswered:** are `/exam` and `/practice`
deprecated? The decision was taken to fix #2 and #4 rather than delete them,
so the code now assumes `/exam` is live — but nothing links to it, so a
candidate cannot reach the simulation at all. That gap is untouched by any of
the fixes below.

---

## 🔴 Blocker

### 1. Mahoti and Diuni discard an entire sitting on reload — **FIXED AND VERIFIED**

**Flows:** H `/mahoti`, I `/diuni` — both on the primary navigable path.

**Steps** Start the paper (התחל בחינה), answer Q1, reload.

| | mahoti | diuni |
|---|---|---|
| timer before | `159:13` | `99:55` |
| after reload | `160:00` | `100:00` |
| answers | all cleared | all cleared |
| state | back to התחל בחינה | back to התחל בחינה |

**Evidence** Zero requests to `:4000` during play. No `localStorage` /
`sessionStorage` key for either feature. By design:
`submitMahotiAttempt(questionId, given[])` and `submitDiuniAttempt` file the
**whole sitting in one call at the end** — there is no incremental save path.

`MahotiWorkspace`'s own docstring says this is deliberate — *"no session, no
timer, no window token, no server writes… the selected letter is local state
and disappears on reload"*. That intent has since drifted: there **is** a
160-minute timer, and the sitting **is** scored and listed in the archive. A
deliberate choice for an unscored reading screen is a data-loss bug on a
scored, timed exam.

**Impact** 160- and 100-minute papers. One refresh, back-button, crash or OS
restart discards everything, silently and unrecoverably.

**Fixed (mitigation):** `NavigationGuard` — which already existed and handles
in-app links, `beforeunload` and the Back button — is now wired into both
workspaces, armed while `examStarted && attempt === null`. Every exit now asks
first, and it disarms once the sitting is filed so the solution stays
reachable.

**Fixed (persistence):** `lib/sittings/progress.ts` keeps the answers and the
clock in localStorage, restored on mount and cleared once the sitting is
filed. The clock is stored as an ABSOLUTE DEADLINE, not a remaining count —
storing "158 minutes left" would hand back the time the page was closed,
which is finding #2's defect in a different costume.

**Verified in the browser:** answered, reloaded, and the sitting came back
with the answer selected and the clock at `149:41`, matching the stored
deadline exactly. The ~10 minutes the page was shut were charged, not
refunded.

---

## 🟠 Majors

### 2. Exam simulation: the timer rewinds on refresh — **FIXED AND VERIFIED**

**Flow:** F `/exam/play/[idx]` — **orphaned surface** (see context above).
Downgraded from blocker for that reason; the defect itself is confirmed.

Remaining time went **97:08 → 97:57 across 57s of real time**; two earlier
reloads both restored to exactly `98:22`. After 30+ minutes of real elapsed
time the session still showed `98:13` of 100:00.

**Mechanism** (`supabase/migrations/20260516000001_exam_phase5_atomic_actions.sql`):

```sql
v_elapsed := LEAST(600, GREATEST(0,
  EXTRACT(EPOCH FROM (NOW() - v_session.last_activity_at))::int
));
v_new_time := LEAST(total_duration_seconds, time_used_seconds + v_elapsed);
```

Time accrues **only when an RPC runs**, and each accrual is capped at 600
seconds. So (a) a refresh reads a stale `time_used_seconds` and the clock
appears to rewind, and (b) any gap longer than 10 minutes is charged as 10
minutes. A candidate spacing interactions >10 minutes apart can stretch a
100-minute exam over hours.

The 600 cap is plausibly deliberate (not charging someone whose laptop slept),
which is exactly why the fix is a judgement call rather than a correction.

**Fixed** in `supabase/migrations/20260927000001_exam_wallclock_timer.sql`
(applied 2026-09-27) plus `lib/exam/remaining.ts` on the read path. Elapsed is
now `(NOW() - started_at) - total_paused_seconds - live_pause`, the 600s cap
is gone, and the page derives its opening clock from `started_at` instead of
the stored `time_used_seconds`.

**Verified in the browser after the migration:**

| | |
|---|---|
| before reload | `63:56` |
| after reload | `62:41` |
| real time elapsed | 74s |
| clock consumed | 75s |
| **drift** | **−1s** |

The resume also demonstrated the cap fix: a session with **zero answers
filed** came back showing ~36 minutes consumed, matching wall time. Under the
old model it would have read ~`100:00`.

**Correctly working, for the record:** pause/resume in isolation — an 87s
pause cycle deducted 18s, and a 69s pause moved the clock 0s. The 9m33s jump
seen earlier was the server reconciling a long idle against the 600s cap, not
a pause bug.

### 3. `admin/page.tsx` was the only admin page without `requireAdmin()` — **fixed**

Its own layout documents the convention (pages re-call the gate because the
Router Cache can replay layout segments, and page and layout render
concurrently). Every other admin page complied; `/admin` did not.

*Not exploitable as found* — a non-admin `fetch('/admin')` returns 200/94 KB,
but the body is only the loading shell (no heading, no table rows), and
browser navigation bounces to `/dashboard` correctly. A defense-in-depth gap,
now closed.

**Fixed:** `await requireAdmin();` added at the top of `AdminHomePage`.

### 4. `/exam-archive` claims "all your exams" but omits exam simulations — **FIXED**

The page reads *"כאן מרוכזים כל המבחנים שהגשת"*. `lib/db/exam-archive.ts`
reads exactly three tables — `mahoti_answers`, `diuni_answers`,
`open_question_answers` — and never `exam_sessions`. A completed 40-question
simulation appears nowhere.

**Fixed:** a fourth **סימולציה** tab, reading completed `exam_sessions` and
linking to `/exam/results/<id>`. That read is the only one in
`lib/db/exam-archive.ts` with an explicit user-id filter, deliberately —
`admins_view_exam_sessions` grants admins SELECT over every row, so without
it an admin's own archive would list the whole cohort's sittings.

Verified rendering (four tabs, correct per-subject empty states). NOT yet
seen with a populated row — that needs a completed 40-question simulation.

### 5. A built custom exam is unreachable once you navigate away — **FIXED AND VERIFIED**

After building, `/mahoti-start` listed only the curated paper. The new exam
existed (`?set=e857ff37…`) but appeared in no listing — the URL was the only
handle on it.

**Fixed:** `listMyCustomMahotiSets` / `listMyCustomDiuniSets` (filtering
`built_for = userId` where the curated list filters `IS NULL`), surfaced as a
**"השאלונים שבניתי"** section on both start pages. These tables are read with
the service-role client because they are admin-only under RLS, so the
`built_for` filter IS the authorization. `PaperChoice` also gained an optional
`heading`, or the new section rendered a second identical "בחירת המבחן".

**Verified:** both sections render, and the previously-unreachable
`מבחן דין מהותי מותאם אישית` is now listed.

---

## 🟡 Minors (all open)

- `פרטיות` in the shared footer links to `#` though `/privacy` returns 200.
  `components/shared/site-footer.tsx`'s comment ("not implemented yet") is
  stale. `תקנון` and `צרו קשר` are legitimately unbuilt.
- `/accessibility` (הצהרת נגישות) is reachable by URL but linked from nowhere
  — not the footer, not the accessibility widget's 18-toggle panel.
- `GET /api/open-questions/subjects` took ~25s on first load with no timeout,
  error state or retry; the picker shows `טוען נושאים…` indefinitely if it
  fails. Re-measure against a production build before sizing.
- Terminology: sidebar **דין מהותי** vs card/heading **דיון מהותי** on the
  same screen.
- `/mahoti/review` 1066 KB and `/diuni/review` 1242 KB of HTML on an account
  with zero attempts (vs 35 KB for the results pages).
- `NaN` leaks into a user-facing Hebrew error when `total` is missing on
  `POST /api/custom-exam`: *"יש לבחור בדיוק NaN שאלות"*
  (`lawpass_server/db/custom-exam.js:119`). Unreachable through the app's own
  client, which always sends `total`.

---

## Retracted

- **Custom-exam double-submit.** Two `POST /api/custom-exam` appeared in the
  log for one click, but `handleBuild` is correctly guarded
  (`if (!exact || building) return`, with `building` held true through the
  navigation). The second POST was this tester's own malformed probe against
  the same endpoint from the same page. Not a defect.
- **No dashboard resume card for an abandoned exam.** Correct by design:
  `getHeroLastSession` queries `practice_sessions` only.

---

## Passed

- **Auth:** login, session survival across a hard refresh, logout bounce,
  auth-bounce (`/login` → `/dashboard` when authed), anonymous guard (every
  non-public path 307s to `/login`).
- **Gates:** subscription gate and its exempt prefixes; admin gate holds
  (no data served to a non-admin); QA-tester gate shows the widget.
- **Exam:** session creation, answer filing, exclusive `aria-pressed`,
  answer-change filing a second attempt, no correctness leak mid-exam,
  **answer persistence across reload**, pause/resume.
- **Custom exam:** server-side count validation is genuinely independent of
  the client — a malformed direct POST was rejected. Build → 40 questions,
  51 laws.
- **Archive:** renders, three tabs with counts, correct subject-specific
  Hebrew empty states, and it re-runs `requireActiveSubscription()` at page
  level (the convention #3 was missing).
- **Writing-task:** subject picker → question list → question page; Hebrew
  subject names URL-encode correctly.
- **Cross-cutting:** RTL correct (`lang=he dir=rtl`), 26 authenticated routes
  render with no error boundary, strong per-question a11y labels
  (`שאלה 2, לא נענתה`), no console errors on the main flows.

## Changes made in this pass

| File | Change |
|---|---|
| `app/(app)/admin/page.tsx` | `await requireAdmin()` + why-comment |
| `app/(app)/mahoti/_components/mahoti-workspace.tsx` | `NavigationGuard`; restore/persist/clear answers |
| `app/(app)/diuni/_components/diuni-workspace.tsx` | same |
| `lib/sittings/progress.ts` | NEW — versioned, try/catch-wrapped localStorage for answers + clock |
| `app/(app)/mahoti/_components/exam-timer-bar.tsx` | optional `sitting` prop; restores/persists the deadline |
| `supabase/migrations/20260927000001_exam_wallclock_timer.sql` | NEW — wall-clock exam timing (applied) |
| `lib/exam/remaining.ts` | NEW — JS mirror of `exam_elapsed_seconds` |
| `lib/db/exam.ts`, `lawpass_server/db/exam.js` | select + map `total_paused_seconds` |
| `app/(app)/exam/play/_components/exam-question.tsx`, `.../[idx]/page.tsx` | clock seeded from `started_at` |
| `lib/db/exam-archive.ts`, `.../archive-tabs.tsx` | fourth סימולציה tab |
| `lib/db/mahoti.ts`, `lib/db/diuni.ts` | `listMyCustom*Sets` |
| `.../exam-start/exam-start-page.tsx`, `paper-choice.tsx` | custom-papers section + optional heading |
| `app/(app)/mahoti-start/page.tsx`, `diuni-start/page.tsx` | fetch and pass `customSets` |
| `tests/exam-actions.test.ts` | fixture gained `total_paused_seconds: 0` |

`npx tsc --noEmit` exit 0 · `npx eslint` exit 0 on every changed file ·
`npx vitest run` **228 passed, 0 failed** (the 6 "No test suite found" files
under `lawpass_server/lib/**` are pre-existing).

Findings 1, 2 and 5 were additionally exercised in a real browser against the
running app; see each for the measurements.

## Data left behind

- One **active** exam session `b04f5b75-5a8c-4e25-8bc5-88a6a575c34f`
  (דיוני בלבד, Q1 answered, never submitted or exited).
- One **custom exam** `e857ff37-4e68-41d8-8a5d-5715966cdc64`
  (מבחן דין מהותי מותאם אישית, 40 questions) — unreachable via the UI, see #5.
- Mahoti and diuni: nothing persisted — that is finding #1.
