# QA + Security Report — 2026-10-01

**Scope:** continuation of the 2026-09-27 pass, over everything added since
(study material, NDA acceptance, public contact form, feedback + screenshot
upload, no-copy, dashboard charts, marketing rebuild), plus an OWASP Top 10
review of the new and adjacent surfaces.

**Method:** static review of 89 changed files; `tsc --noEmit` clean; `eslint`
0 errors / 16 warnings; `vitest` 252 passed. Browser pass limited to
UNAUTHENTICATED pages — no account was created, no form submitted, and the
database was not probed (per the working agreement).

**Nothing in this report has been fixed.** It is a list to triage.

---

## 🔴 Critical

### 1. Any logged-in user can make themselves an admin — OWASP A01 — **FIXED IN REPO, NOT YET APPLIED**

> **Fix:** `supabase/migrations/20261001000009_profiles_column_privileges.sql`
> plus the two `is_qa_tester` call sites. The table-wide UPDATE/INSERT/DELETE
> grant on `profiles` is revoked and replaced with
> `GRANT UPDATE (full_name, exam_date_planned)`; `is_qa_tester` moves to the
> `admin_set_qa_tester` SECURITY DEFINER RPC, which re-checks `is_admin()` in
> the database. **The migration has not been run against the database** — see
> "Applying the fix" at the end of this report.

`profiles.is_admin` is an ordinary column on a table where every authenticated
user holds table-wide UPDATE on their own row.

- `20260503000014_fix_default_privileges.sql:18`
  `GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;`
  — table-wide, no column list.
- `20260503000003_profiles.sql:40`

```sql
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);
```

RLS is row-level. It cannot restrict which COLUMNS are written, and no
column-level GRANT or REVOKE exists anywhere in `supabase/migrations`.

So a signed-in user, with the publishable key and their own JWT — both present
in the browser — can send:

```
PATCH /rest/v1/profiles?id=eq.<their own id>
{"is_admin": true}
```

`public.is_admin()` reads that column, so the escalation is immediate and it
unlocks every admin policy in the schema:

| Consequence | Mechanism |
|---|---|
| Read every user's name, phone, gender, birth date, email | `admins_view_all_profiles` |
| Modify any other user's profile | `admins_update_all_profiles` |
| **Grant themselves a paid subscription** | `admins_full_access_subscriptions` is `FOR ALL` |
| Read every exam session and attempt in the system | `admins_view_exam_sessions`, `admins_view_all_attempts` |
| Edit question banks, rubrics, study material | the `*_admins_update` / `study_material_admins_all` family |
| Reach `/admin` | `requireAdmin()` reads the same flag |
| Disable the copy deterrent | bypass is `is_qa_tester or is_admin` |

`is_qa_tester` and `is_test_account` are writable by the same route.

This is the single highest-value finding in the pass. Everything else that
mentions "admin" below is downstream of it.

**Note:** `subscriptions` and `payments` are *not* directly writable — they have
SELECT-only user policies. They are reachable only *through* this escalation.

---

## 🟠 High

### 2. The mock payment action has no production guard — A04 — **FIXED**

> **Fix:** `lib/billing/mock-checkout.ts` (new), guarding
> `grantMockSubscriptionAction` and the `/checkout` page. Production refuses
> unless `ALLOW_MOCK_CHECKOUT=true`; development is unaffected. Covered by
> `tests/mock-checkout.test.ts` (5 cases). **This one is code, not SQL — it
> ships with the next deploy and needs no migration.**
>
> **Consequence to decide on:** `/pricing` still links to `/checkout`
> (`pricing-screen.tsx:141`), so in production that CTA now leads to a 404.
> Nothing routes users to `/pricing` today — it is reachable from the account
> screen and by URL — and the honest fix is Tranzila, so the button was never
> going to work correctly either way. Left alone rather than redesigning the
> pricing page; see finding 5.

`app/(app)/_actions.ts:51` `grantMockSubscriptionAction` calls
`grant_mock_subscription`, which inserts an active subscription for the caller.
There is no charge, and no `NODE_ENV` / feature-flag guard anywhere in the path.

It is honestly marked `TODO(slice-4)` as a Slice-1 placeholder, and Tranzila is
known not to be wired. The finding is not that it is mock — it is that **nothing
stops it shipping**. A Server Action is a public POST endpoint; any registered
user can invoke it directly.

### 3. Study material is paywalled only in app code — A01 — **FIXED IN REPO, NOT YET APPLIED**

> **Fix:** `supabase/migrations/20261001000011_study_material_subscription_gate.sql`.
> The view gains `AND (public.is_admin() OR public.has_active_subscription())`.
> No application code changed. **Operator decision, 2026-10-01: enforce now**,
> accepting that accounts without a subscription lose study material today —
> the same thing that already happens to them on exam and practice content.
> **Not yet run** — see "Applying the fix" at the end.

`study_material_public` (20260928000002, re-created 20260930000001) is granted
to `authenticated` with no subscription predicate:

```sql
GRANT SELECT ON public.study_material_public TO authenticated;
```

The view is deliberately RLS-bypassing (no `security_invoker`), which is correct
for hiding `original_text`. But the *paywall* then rests entirely on the
`redirect("/pricing")` in `app/(app)/layout.tsx`. Any authenticated session can
`GET /rest/v1/study_material_public` and pull the whole library.

Compare `exam_sessions` and `attempts`, whose policies both call
`has_active_subscription()`. CLAUDE.md's own rule — *"RLS-first: authorization is
enforced in the database, not only in app code"* — is met there and missed here.

### 4. Users can rewrite their own exam results and timer — A01 / A04 — **FIXED IN REPO, NOT YET APPLIED**

> **Fix:** `supabase/migrations/20261001000010_exam_integrity_column_privileges.sql`.
> No application code changed — every existing write already stays inside the
> granted columns. `final_score`, `passed`, `questions_correct`,
> `questions_answered`, `started_at`, `paused_at`, `completed_at` and
> `total_paused_seconds` are no longer writable from a user session, and
> `attempts` loses UPDATE and DELETE entirely. **Not yet run** — see
> "Applying the fix" at the end.

```sql
CREATE POLICY "users_own_exam_sessions" ON exam_sessions
  FOR ALL USING ((SELECT auth.uid()) = user_id AND public.has_active_subscription());
```

`FOR ALL` plus the table-wide GRANT means the owner can PATCH any column:

- `final_score`, `passed`, `questions_correct` — forge a passing result
- `started_at` — **this defeats the wall-clock timer fixed on 09-27.** That fix
  deliberately moved authority from the stored counter to `started_at`; that
  column is writable by the person being timed.
- `active_window_token` — defeats the F7 second-window lock
- `status` — reopen a completed sitting

`attempts` has the same shape, so answer history and every dashboard statistic
derived from it can be rewritten.

Mostly self-cheating, but it also corrupts admin analytics and the materialized
views, and for an exam-prep product the integrity of a score is the product.

### 5. The paywall switch leaves new users in a working shell with no data

`SUBSCRIPTION_GATE_ENABLED = false` in both `lib/auth/subscription-gate.ts:30`
and `lawpass_server/middleware/require-subscription.js:16`, so signup now routes
to `/dashboard` instead of `/pricing`. RLS was deliberately *not* changed.

The team documented the consequence at `subscription-gate.ts:24-28`:
*"a user with no subscription reaches the screens but the content queries return
zero rows."*

That is the current new-user experience: the app opens, and practice, exam,
attempts and bookmarks all return nothing, with no explanation on screen. Either
the gate goes back on, or RLS needs an early-access path, or the empty states
need to say what happened.

Flagged as a product-state decision rather than a code defect — but it is what a
new registration does today.

---

## 🟡 Medium

### 6. NDA acceptance is client-asserted and can be omitted — A04

For a consent record built across four migrations, the server never establishes
that the box was ticked.

- `app/(auth)/_actions.ts:150-151` — `nda_accepted_at` and `nda_version` are
  `.optional()` in the Zod schema.
- `:406-408` — on the OTP path they are read from client-supplied signup
  metadata, not generated server-side.
- `20261001000003:82` — the RPC rejects only a *half* pair; `(NULL, NULL)` is
  accepted and writes a profile with no NDA record.

So a caller invoking the action directly can register with no acceptance at all,
or assert any timestamp and version string. Two other paths (`:294-298`,
`:632-637`) do stamp `new Date()` server-side — the inconsistency is itself
worth resolving.

The version is also never checked against `NDA_VERSION`.

### 7. The contact form's email cap is a self-DoS — A04

Two limits, and an attacker gets between them:

- Per-IP (3/hour) keys on `x-forwarded-for`, which the action's own comment
  notes is spoofable. Rotating the header bypasses it entirely.
- The global cap counts *all* `notified_at` in the last hour and stops emailing
  at 20.

So ~20 requests an hour — trivial with a rotating header — permanently suppress
notification of every genuine contact message. The rows are still stored, which
is the right design, but the team only learns of messages by email, so support
goes silent with nothing on screen to indicate it. Meanwhile the table grows
without bound.

### 8. Latent stored XSS in notes — A03

`app/(app)/notes/_components/note-row.tsx:206` renders DB-sourced HTML through
`dangerouslySetInnerHTML`, and there is **no HTML sanitizer in `package.json`**
(no DOMPurify, sanitize-html or equivalent).

Today this is self-XSS only: `question_notes` is per-user and the note is
rendered only to its author. That containment is an invariant nothing enforces —
the first admin screen, shared note or export that renders another user's note
turns it into account takeover. Worth sanitizing before that happens rather
than after.

---

## 🔵 Low / minor

9. **`20261001000005` writes consent for accounts that never gave it** — every
   row with no acceptance gets `nda_accepted_at = now()`. The migration
   documents this as a deliberate operator decision and adds
   `nda_acceptance_method = 'admin_backfill'` to keep it legible, which is the
   right handling. Raised only so the legal exposure is a conscious one.
   Separately, the version is hardcoded `'1.0'` and can drift from
   `NDA_VERSION`.
10. **No upload quota or DELETE policy** on `feedback-screenshots`. Any
    authenticated user can fill their folder with 5 MB images indefinitely.
11. **Non-constant-time secret comparison** at
    `app/api/cron/reengagement/route.ts:79` (`===` on `CRON_SECRET`). Largely
    theoretical over HTTP; noted because the unsubscribe path next to it does
    use an HMAC verify.
12. **6 test files contain no tests** and report as FAIL —
    `lawpass_server/lib/ai/*` and `lib/marking/*` are untested. Pre-existing,
    carried over from 09-27.

    **CORRECTED 2026-10-05:** this originally said "the run still exits 0 — CI
    stays green". That was wrong. `npx vitest run` exits **1**; the earlier
    reading came from running it through a `grep` pipeline, which reports
    grep's exit code rather than vitest's. So CI has been correctly failing on
    these, not silently passing them.
14. **A locked surface says "empty", not "locked"** — NEW, found while fixing
    finding 3, and it applies to every paid surface, not just study material.
    When content is withheld for want of a subscription, the index renders
    *"אין עדיין חומר לימוד זמין"* ("no study material is available yet") and a
    direct link 404s. Both tell the user the content does not exist, when in
    fact it exists and is locked. This is already the behaviour on exam and
    practice content and predates today's work — finding 3's migration just
    extends it to a third surface.

    Not fixed, because the right copy depends on a product answer I do not
    have: with `SUBSCRIPTION_GATE_ENABLED = false` and Tranzila unwired, there
    is nowhere useful to send someone who wants to subscribe. Worth settling
    alongside finding 5, since they are the same question.

15. **Dead Express fallbacks** — `apiEnabled` and the `*Action` fallbacks in
    `lib/api/{auth,bookmarks,mistakes,notes,qa}.ts` are unused (eslint
    warnings). The Server-Action fallback is wired out, so a dead `:4000` has no
    backstop, matching the known `[VERIFY-EXPRESS]` state.

---

## Checked and found sound

Worth recording so it is not re-audited:

- **Contact form honeypot** — correctly hidden in a 1px clipped absolute
  container, `tabindex="-1"`, and labelled for screen readers. Verified in the
  browser; the field is not visible and not focusable.
- **Email rendering** — `lib/email/layout.ts` escapes every interpolation via
  `escapeHtml`, so the contact notification cannot carry injected HTML.
- **Screenshot upload path** — server-constructed as
  `${user.id}/${crypto.randomUUID()}.${ext}` with the extension derived from a
  validated MIME type. No traversal, and the bucket policy enforces the folder.
- **`submit_general_comment`** — `SECURITY DEFINER` with
  `SET search_path = public, pg_temp`, count and insert in one statement, table
  GRANT revoked so the RPC is the only write path. Correctly built.
- **Cron and unsubscribe routes** — `CRON_SECRET` bearer check that fails closed;
  HMAC token verification on unsubscribe.
- **`study_material_public` column design** — `original_text` is absent from the
  view, so the copyrighted source cannot leak through it however the query is
  written. (The missing piece is *who* may read the view — finding 3.)
- **`NoCopyApp`** — scoped correctly, exempts fields and `.allow-copy`, and its
  own docstring states it is a deterrent and not a control. No overclaim.
- **New legal pages** — `/terms` and `/privacy` render, no console errors, and
  the privacy text does disclose IP collection as `20261001000007` promised.

---

## Still not covered

**`proxy.ts` changed on 2026-10-01 at 11:37 and has NOT been reviewed.** It
sits at the repo root, outside the directories this pass scanned, and it is
the anonymous-access guard — flow A4, "every non-public path 307s to /login",
and the auth bounce in B10. A file of that job changing on the same day as the
NDA and marketing work deserves its own look; it is the one known gap in the
security half of this report.

Unchanged from 09-27, plus the new features:

- **J3–J6** writing-task AI grading — real model spend.
- **K / L writes**, **F5–F7** (submit-final, exit, second-window), **N** admin.
- **Everything behind a login in the new features** — the study-material readers,
  the feedback widget and its upload, the NDA signup flow end to end, and the
  dashboard charts. This pass was unauthenticated: I have no test credentials
  this session, and creating an account writes to the live database.

Send me a QA login and I can take the authenticated half.

---

## Applying the fixes for findings 1, 3 and 4

All three migrations are written but **have not been run** — they change
privileges on the production database, and per the working agreement that is
yours to run. Apply them in order:

```bash
node scripts/apply-sql.mjs supabase/migrations/20261001000009_profiles_column_privileges.sql
node scripts/apply-sql.mjs supabase/migrations/20261001000010_exam_integrity_column_privileges.sql
node scripts/apply-sql.mjs supabase/migrations/20261001000011_study_material_subscription_gate.sql
```

**Finding 2 needs no migration** — it is application code and takes effect on
the next deploy. If early-access accounts are currently being given access by
walking them through the mock checkout, set `ALLOW_MOCK_CHECKOUT=true` in the
Vercel project **before** deploying, or that route closes. Nothing in the UI
points at `/checkout` today, so most likely nothing needs setting.

**Finding 3's migration is the one with a visible effect on users today.**
Accounts with no active subscription will see the study-material index as empty
and a direct document link as 404. Reversing it is one command — re-running
`20260930000001_study_material_publication_gate.sql` restores the previous
view definition.

### What it changes

| | before | after |
|---|---|---|
| `authenticated` on `profiles` | `SELECT, INSERT, UPDATE, DELETE` table-wide | `SELECT` + `UPDATE (full_name, exam_date_planned)` |
| `is_qa_tester` writes | direct UPDATE from an admin's session | `admin_set_qa_tester()` RPC, `is_admin()` checked in-database |
| `is_admin`, `is_test_account`, NDA and terms columns | writable by the row's owner | not writable from any user session |

### What to test after applying

Five checks, four of which should keep working:

1. **Account screen** — change your full name and planned exam date, save.
2. **Admin → user detail** — edit another user's name, save.
3. **Admin → QA tester toggle** — grant and revoke; the audit row should still
   show `from → to`.
4. **Register a new account** — the profile row is still created
   (`complete_user_profile` is SECURITY DEFINER and is unaffected).
5. **The exploit, which should now fail.** In the browser console of a
   signed-in non-admin:

```js
const { error } = await window.supabase
  .from("profiles").update({ is_admin: true }).eq("id", "<your own id>");
console.log(error);   // expect: permission denied for table profiles (42501)
```

If check 1 or 2 breaks, a column is missing from the grant on line 78 of the
migration — adding it is a one-line change. If check 5 still succeeds, the
migration did not apply.

### What finding 4's migration changes

| | before | after |
|---|---|---|
| `authenticated` on `exam_sessions` | `SELECT, INSERT, UPDATE, DELETE` table-wide | `SELECT`, `INSERT` (7 start-of-exam columns), `UPDATE (status, last_activity_at, active_window_token)` |
| `authenticated` on `attempts` | `SELECT, INSERT, UPDATE, DELETE` table-wide | `SELECT` + `INSERT` (11 practice-answer columns). **No UPDATE, no DELETE** |
| `total_duration_seconds` | any integer | `CHECK BETWEEN 60 AND 21600` |

All five functions that write `exam_sessions` — `increment_exam_session_counters`,
`submit_exam_answer`, `bump_exam_session_time` (pause), `resume_exam_session`,
`submit_final_exam` — and all three that write `attempts` are `SECURITY DEFINER`
and run with their owner's privileges, so gameplay is untouched. That was
verified before the grants were narrowed; it is the whole reason this fix needs
no application change.

### What to test after applying finding 4's migration

1. **Start an exam** → session is created, 100:00 on the clock.
2. **Answer, skip, bookmark** → all still file.
3. **Pause and resume** → the clock banks the pause (this is `bump_exam_session_time`).
4. **Submit final** → results page shows a score.
5. **Abandon**, and **open a second tab** → claim-window still takes over.
6. **Answer a practice question** → still files (this is the `attempts` INSERT grant).
7. **The exploit, which should now fail:**

```js
await window.supabase.from("exam_sessions")
  .update({ final_score: 40, passed: true }).eq("id", "<your session>");
// expect: permission denied for table exam_sessions (42501)
```

If 1–6 all work and 7 is refused, the fix is in. If any of 1–6 breaks, a column
is missing from one of the two grant lists and it is a one-line addition.

### What to test after applying finding 3's migration

1. **As an account WITH an active subscription** — `/study-material` lists the
   documents and a document opens.
2. **As an admin without a subscription** — same, still works. The view has an
   `is_admin()` exemption precisely so an admin does not open the
   candidate-facing page and find it blank.
3. **As an account WITHOUT a subscription** — the index shows the empty state
   and a direct `/study-material/<id>` link 404s. **This is the intended new
   behaviour**, not a regression.
4. **Nothing else moves** — the only two readers of the view are
   `listStudyMaterial` and `getStudyMaterial` in `lib/db/study-material.ts`,
   and nothing in the app reads the base table, so the blast radius is those
   two pages.

### Why column grants rather than a stricter policy

RLS cannot restrict columns — it decides rows. `WITH CHECK` cannot help either,
because it has no access to the row's previous values, so there is no way to
express "`is_admin` must not change" in a policy. Postgres column privileges
are the only mechanism that applies here, and they are checked independently of
RLS.

The grant is an allowlist rather than a blocklist, so **every column added to
`profiles` from now on is non-writable by users until someone adds it to that
line deliberately**. A new sensitive flag is safe the day it is created; a new
editable field costs a one-line migration.

