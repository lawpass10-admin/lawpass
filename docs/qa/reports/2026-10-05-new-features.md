# QA Report — 2026-10-05 — new features since the 10-01 pass

**Scope:** only what was added or changed since
`2026-10-01-security-and-new-features.md`. 45 source files, excluding the ~675
generated ingestion JSON files, which are content rather than code.

The five new surfaces:

| | added | what it is |
|---|---|---|
| SMS campaign tool | 10-05 | `lawpass_server/lib/sms/*`, bulk marketing SMS via SMS4Free |
| Open-question grade counts | 10-05 | migration `20261005000001` + grading server code |
| Mahoti / Diuni exam publication | 10-04 | migrations `20261004000001/2`, draft→prod gating |
| Study-material per-subject pages | 10-04/05 | `/mahoti/study-material`, `/diuni/study-material` |
| LLM spend alarm | 10-04 | `lib/billing/llm-*`, `api/cron/llm-spend-alarm` |

**Method:** static review. **No SMS was sent** and no live send was attempted —
`SMS_PROVIDER` stays `mock` and the user runs live sends himself. No account
created, no form submitted, no database probed.

**Status:** finding 1 is fixed (and grew: see under it). Findings 2–8 are
untouched and awaiting triage.

**Suite state after the fix:** `npx vitest run` → **257 passed, 7 failed**,
exit 1. The 7 are finding 2's `matchMedia` failures, unchanged and unrelated;
the fix added 7 passing tests and no failures.

---

## 🟠 High

### 1. `?set=` opens any paper, published or not, yours or not — OWASP A01 (IDOR) — **FIXED**

> **Fix:** `lib/db/paper-visibility.ts` (new), applied to **four** readers, not
> the two originally reported — `getMahotiSet`, `getDiuniSet`,
> `getMahotiReview`, `getDiuniReview` — plus the four pages that call them.
> Covered by `tests/paper-visibility.test.ts` (7 cases). Application code only,
> no migration. See "What the fix turned out to cover" below.

`lib/db/mahoti.ts:204` and `lib/db/diuni.ts:148`. `getMahotiSet(questionId)`
has two branches, and only one of them is filtered:

```ts
const { data, error } = questionId
  ? await base.eq("question_id", questionId).maybeSingle<Row>()   // ← no filters
  : await base
      .eq("exam_status", "prod")      // ← the default branch is correct
      .is("built_for", null)
      .order("exam_number", { ascending: true })
      .limit(1).maybeSingle<Row>();
```

The id is user-supplied — `app/(app)/mahoti/page.tsx:30` reads it straight from
`searchParams` — and the whole function runs on `createAdminClient()`, the
service role, so RLS does not apply either.

So any subscribed candidate visiting `/mahoti?set=<question_id>` can open:

- **an unpublished draft paper**, which is precisely what the `exam_status`
  column added on 10-04 exists to prevent; and
- **another candidate's custom exam**, where `built_for` is someone else's id.

`/diuni?set=` is identical.

**What limits it:** they need a real `question_id` (a UUID), so this is not
brute-forceable. But that is secrecy, not authorization — a custom paper's id
appears in its owner's own URL, which is shareable, and the publication gate is
meant to hold regardless of who knows an id.

**Why it was missed:** the comment on the default branch reasons carefully about
exactly this risk — *"Without the filters, the first exam any candidate built
for themselves, or any draft a generation run had just inserted, would silently
become the default paper served to everyone else."* That reasoning was applied
to the branch that needed it least. The by-id branch is the one a URL reaches.

### What the fix turned out to cover

Writing it surfaced **two more problems in the same family**, both in the
review readers, and both worse than the one reported:

**1a. `getMahotiReview` / `getDiuniReview` had the same by-id hole — with the
answers attached.** `getMahotiSet` runs its rows through `stripAnswers`; the
review readers do not, by design, because a review *is* the explanations and
the correct choice. So the unfiltered by-id branch there handed out the answer
key to any paper named in `?set=`. The review pages reach it: `review/page.tsx:65`
passes `attempt?.questionId ?? set`, and `set` is a search param.

**1b. The review readers' DEFAULT branch was unfiltered too — a live bug with
no crafted URL needed.** They answered with `created_at DESC LIMIT 1`: the most
recently *created* row in the table, regardless of `exam_status` or
`built_for`. So the moment anyone generated a draft, or any candidate built a
custom exam, that paper's review became the review served to every candidate
who opened `/mahoti/review` without a `?set=`.

**1c. And the default branches disagreed with each other.** `getMahotiSet`
moved to `exam_number ASC` when publication landed (`20261004000001`); the
review readers stayed on `created_at DESC`. Those select *different papers*,
so a candidate with no `?set=` could read one paper's review beside another
paper's questions, with nothing on screen suggesting a mismatch. The
docstring still claimed the two agreed.

### How it was fixed

A shared `lib/db/paper-visibility.ts`, because `mahoti.ts` and `diuni.ts` are
deliberate mirrors and a rule written twice becomes two rules — these same two
files already drifted on an index direction (finding 6).

- `visibleToViewerFilter(viewerId)` returns the PostgREST expression
  `and(exam_status.eq.prod,built_for.is.null),built_for.eq.<viewer>`, applied
  with `.or()` alongside `.eq("question_id", id)`. The database never returns
  an unauthorised row, rather than the row being discarded after the fact.
- `DEFAULT_PAPER_ORDER` is shared by all four readers, so the set and the
  review can no longer disagree about which paper is the default.
- `viewerId` is a **required** parameter, so the compiler — not a reviewer —
  proved every call site was updated. It throws rather than falling back to
  "published only" if a caller passes something that is not UUID-shaped: a
  missing argument becoming a quietly looser query is the exact failure being
  fixed. The guard is also what keeps the interpolated value from breaking out
  of the `or(...)` expression, and the tests cover that.

These reads use the service role (both tables are admin-only under RLS), so
this filter is not defence in depth — it is the only defence, which is why it
is expressed once and why the argument is mandatory.

---

### 2. The test suite is red — 7 failures, all from today's chart change

`npm test` exits **1**. Every failure is in `tests/topic-charts-rubric.test.tsx`,
and the cause is one line:

```
TypeError: window.matchMedia is not a function
  ❯ getSnapshot            hooks/use-mobile.ts:13
  ❯ useIsMobile            hooks/use-mobile.ts:21
  ❯ TopicCharts            app/(app)/dashboard/_components/topic-charts.tsx:383
```

`topic-charts.tsx` gained a `useIsMobile()` call today (10-05 08:48). jsdom does
not implement `window.matchMedia`, and `tests/setup.ts` has no stub for it, so
the component throws on render and all seven of its tests die.

**This is not a production bug.** `hooks/use-mobile.ts` is correctly written —
it uses `useSyncExternalStore` *with* a `getServerSnapshot` returning `false`,
so SSR is safe, and real browsers have `matchMedia`. I checked that
specifically before reporting it.

What it costs is coverage and signal:

- the dashboard's chart logic — rubric marks, point scales, the pie/bar split —
  is now **untested**, and that is a component with real arithmetic in it;
- `exam-progress-strip.tsx` (also changed today) and `components/ui/sidebar.tsx`
  use the same hook, so the next test touching either hits the same wall;
- a red suite stops being informative. The next genuine regression lands in a
  run that was already failing.

**Shape of a fix:** about five lines in `tests/setup.ts` — a `matchMedia` stub
returning `{ matches: false, addEventListener, removeEventListener }`. The seven
tests should then pass unchanged, since nothing about the chart's behaviour
changed, only its layout branch.

### 3. The new grading feature shipped with an empty test file

`lawpass_server/db/open-question-grade-counts.test.js` was added on 10-05 at
11:59, beside the grade-counting code it is named for, and contains **no
tests** — vitest reports `No test suite found in file`. It now sits with the
six pre-existing empty stubs under `lawpass_server/lib/**`, bringing that
count to seven.

A named test file with nothing in it is worse than no file: it reads, in a
directory listing and in a review, as "this is covered".

---

## 🟡 Medium

### 4. The SMS opt-out promise has nothing behind it

Every message ends with `להסרה השיבו הסר` — *reply "הסר" to be removed* —
appended automatically by `buildBody` (`campaign.js:106`) so it cannot be
dropped by accident. Good. But:

- **Nothing reads replies.** There is no inbound webhook, no polling, no
  `lib/sms` code that touches an incoming message. Searched the whole repo.
- **The sent log is per-campaign.** `readSentNumbers` keys on `campaignId`
  (`campaign.js:127`), so it prevents double-sending *within one campaign* and
  starts empty for the next one. Someone who asked to be removed after
  campaign A is a fresh name in campaign B.
- **There is no suppression list** of any kind — no file, no table, no flag.

`lib/sms/README.md:166-167` already says this out loud: *"someone also needs to
**read** the 'הסר' replies and take them off the next list."* So it is a known
manual step, not an oversight — which is why this is Medium and not High. The
gap is that nothing in the tool enforces, prompts for, or even records that
step, while `campaign.js:12` correctly notes that getting this wrong is
*"how a campaign ends up on the wrong side of the Anti-Spam Law"* with damages
assessed per message.

**Shape of a fix:** a `suppression.txt` read by `loadRecipients` and subtracted
into its own bucket beside `duplicates` and `invalid`, so the preview prints
"12 suppressed" before every run. About fifteen lines, and it makes the manual
step visible instead of remembered.

### 5. A one-character config change silently removes the opt-out line

```js
const optOut = String(config.optOutLine ?? 'להסרה השיבו "הסר".').trim();
if (!optOut) return message;          // ← no opt-out line at all
```

`campaign.js:108`. The `??` default only covers a *missing* key. Setting
`"optOutLine": ""` in `campaign.json` — or to a space — sends a bare marketing
message with no way to refuse, with no warning anywhere in the preview.

The docstring says the line is appended separately "so it cannot be edited away
by accident". That is true of editing the *message*, which is the case it was
written for. It is not true of the config key next to it.

Given the stated per-message exposure, refusing to send with an empty
`optOutLine` would be a better default than honouring it.

---

## 🔵 Low

6. **Index direction drift between the two publication migrations.**
   `mahoti_questions_prod_idx` is `(exam_number DESC)`;
   `diuni_questions_prod_idx` is `(exam_number)` ascending. Every query in both
   DALs orders ascending. Postgres scans an index backwards at no real cost, so
   this is cosmetic — but the two migrations are otherwise line-for-line
   identical, so it reads as copy/paste drift rather than a decision.

7. **Non-constant-time `CRON_SECRET` comparison, now in two places.**
   `api/cron/llm-spend-alarm/route.ts:77` repeats the `===` comparison already
   noted at `api/cron/reengagement/route.ts:79` in the 10-01 report (finding
   11). Still largely theoretical over HTTP; worth one shared helper if either
   is ever touched.

8. **Correction to the 10-01 report.** Finding 12 there said the empty test
   files "report as FAIL, and the run still exits 0 — CI stays green". The
   second half is wrong: `npx vitest run` exits **1**. The earlier reading came
   from running vitest through a `grep` pipeline, which reports grep's exit
   code, not vitest's. The practical consequence runs the other way from what
   that finding implied — CI has been correctly failing, not silently passing.
   The 10-01 report has been corrected in place.

---

## Checked and found sound

Recorded so these are not re-audited:

- **`20261005000001_open_question_grades_counts.sql` is textbook.** `SELECT`
  only to `authenticated`; all writes through `record_open_question_grade`,
  `SECURITY DEFINER` with `SET search_path`, `EXECUTE` revoked from `PUBLIC`
  and granted to `service_role` alone — not even to `authenticated`; RLS
  enabled with own-row and admin policies; a B-tree index on the column the
  policy uses, per hardening rule #2. This is the shape the 10-01 findings were
  pushing toward, arrived at independently.
- **The publication CHECK constraints are right.** `prod` requires an
  `exam_number`; a custom paper (`built_for IS NOT NULL`) can never be `prod`;
  `exam_number` is unique among `prod` rows via a partial index. The
  constraints make the bad states unrepresentable rather than merely unlikely.
- **Every *listing* path filters correctly** — `exam_status = 'prod'` and
  `built_for IS NULL` in `listMahotiSets`, `listDiuniSets` and their
  summary variants; `built_for = userId` in the custom lists. Finding 1 is the
  by-id read only.
- **The 10-01 study-material subscription gate survived the 10-04/05 rework.**
  `lib/db/study-material.ts` still reads `study_material_public` (the gated
  view) on the caller's own client, not the service role, and both new
  per-subject pages call `requireActiveSubscription()`.
- **The SMS safety model is well built.** Preview is the default and `--send`
  is required; `SMS_PROVIDER=mock` blocks a send even with `--send`;
  `campaignId` is validated against path traversal before becoming a filename;
  the bulk confirmation asks for the recipient *count* rather than y/N,
  deliberately "something a reflex cannot produce"; the sent log is appended
  line-by-line so a killed run is resumable; phone numbers are masked
  (`054-***-4567`) everywhere they are printed. The provider is chosen
  explicitly by `SMS_PROVIDER` and "never inferred from credentials happening
  to exist".
- **Phone normalisation handles the three real-world manglings** — human
  dashes, Excel's text-cell apostrophe, and Excel eating the leading zero —
  and rejects landlines at load rather than at send. I traced the
  international-prefix and 9-digit paths; both land correctly or return null.
- **`llm-spend-alarm` cron is guarded** — `Bearer $CRON_SECRET`, and it fails
  closed when the secret is unset (`!secret ||`). Registered in `vercel.json`
  at 07:00.

---

## Still not covered

- **`proxy.ts`** — flagged at the end of the 10-01 report and still unreviewed.
  It changed on 10-01 at 11:37, it is the anonymous-access guard (flow A4) and
  the auth bounce (B10), and it sits at the repo root outside the directories
  both passes scanned. This is the oldest open gap.
- **J3–J6**, the writing-task AI grading *behaviour*. The new grade-counting
  code is reviewed above, but exercising the grader costs real model spend.
- **K / L writes**, **F5–F7**, **N** admin — unchanged since 09-27.
- **Everything behind a login.** Both of the last two passes were
  unauthenticated; I still have no QA credentials, and creating an account
  writes to the live database.
