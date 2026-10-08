# LawPass — QA flow map

The testable surface of the app, grouped into flows. Each flow is one
invocation of the `qa-flow-tester` agent.

Derived from `proxy.ts` (route guards), `app/(app)/layout.tsx` (profile +
subscription gates), the route tree under `app/`, and the Express routers in
`lawpass_server/routes/`. Anything marked **(unverified)** is inferred from
route/endpoint names and should be confirmed on first contact.

## Before any run

1. Next.js up on `:3000` — `npm run dev`
2. Express up on `:4000` — `npm --prefix lawpass_server run dev`
3. `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` in `app/.env.local`
   (build-time inlined — restart Next dev after changing it)
4. Test accounts seeded — `node scripts/create-qa-testers.mjs`

The frontend is **hard Express-only** right now (all `[VERIFY-EXPRESS]`
fallbacks commented out). With `:4000` down, nearly every flow fails at the
first mutation. Rule that out before filing a product bug.

## Priority

**P0** — auth and anything that takes money or destroys state. **P1** — the
core study loop. **P2** — content library, admin, marketing.

---

## A. Public / marketing — P2

| # | Flow | Route | Hits |
|---|---|---|---|
| A1 | Landing page renders, CTAs route correctly | `/` | — |
| A2 | Early-access waitlist submit | `/early-access` | `POST /api/early-access/waitlist` |
| A3 | Legal stubs | `/privacy`, `/accessibility` | — |
| A4 | Anonymous access guard: every non-public path 307s to `/login` | any | `proxy.ts` |

`PUBLIC_PATHS` = `/`, `/login`, `/signup`, `/verify-email`, `/forgot-password`,
`/reset-password`, `/onboarding/complete-profile`, `/early-access`, `/privacy`,
`/accessibility`. Anything else, unauthenticated, must redirect.

**Worth breaking:** A2 is the only unauthenticated write in the app (anon
Supabase key, RLS-inserted). Duplicate email must return silent success — the
membership of the waitlist is deliberately opaque. Malformed email, very long
input, and rapid double-submit.

## B. Auth — P0

| # | Flow | Route | Hits |
|---|---|---|---|
| B1 | Signup (email + password) | `/signup` | `POST /api/auth/signup` then `/verify-email` |
| B2 | Verify email OTP | `/verify-email` | `POST /api/auth/verify-otp` |
| B3 | Resend OTP | `/verify-email` | `POST /api/auth/resend-otp` |
| B4 | Login | `/login` | `POST /api/auth/signin` |
| B5 | Logout | sidebar / account | `POST /api/auth/signout` |
| B6 | Forgot password (request link) | `/forgot-password` | `POST /api/auth/request-password-reset` |
| B7 | Set new password | `/reset-password` | `POST /api/auth/reset-password` |
| B8 | Google OAuth — existing user | `/auth/google` then `/auth/callback` | Next.js only (PKCE), no Express |
| B9 | Google OAuth — new user | then `/onboarding/complete-profile` | `POST /api/auth/complete-google-signup` |
| B10 | Auth bounce: logged-in user opens `/login` etc. lands on `/dashboard` | | `proxy.ts` |

Happy paths B1–B9 were manually verified 2026-08-01. **The untested surface is
the negative and interruption paths**, which is exactly what this agent is for:

- wrong password; unverified-account login (its own branch — the server returns
  a null session, and the wrapper must no-op rather than half-authenticate)
- expired / already-used / wrong OTP; OTP resend throttling
- duplicate email at signup; weak password rejection
- **session survival**: after login, hard-refresh and hit a protected route —
  the wrapper does `setSession()` *then* navigates, so a race here is invisible
  until reload
- after logout, back-button to a protected route must bounce to `/login`
- B8 vs B9 divergence: only profile-less users should reach `/onboarding`

## C. Subscription and billing — P0

| # | Flow | Route |
|---|---|---|
| C1 | Pricing page, plan selection | `/pricing` |
| C2 | Checkout screen | `/checkout` |
| C3 | Subscription gate: non-subscriber sent to `/pricing` from any gated route | `app/(app)/layout.tsx` |
| C4 | Exempt prefixes stay reachable when unsubscribed | `/pricing`, `/checkout`, `/onboarding`, `/account`, `/admin` |

Checkout is a **Tranzila placeholder** — the agent stops at any card field and
reports that it stopped. Do not enter payment details, real or invented.

**Worth breaking:** C3 with an *expired* subscription, not just a missing one
(`is_current`, `status=active`, `ends_at > now` are all checked). Expiry
mid-session while a gated page is open.

## D. Dashboard — P1

| # | Flow | Hits |
|---|---|---|
| D1 | Dashboard first paint | `GET /api/dashboard/overview`, `/kpi`, `/trend`, `/hero` |
| D2 | Subject / topic breakdown | part of `GET /api/dashboard/overview` (was `/subject-stats` + `/topic-stats`) |
| D3 | Hero "resume" card continues the last session | leads into practice/exam play |
| D4 | Sidebar bookmark + mistake counts | Next.js page query |

**Worth breaking:** the 24h staleness rule on the resumable hero session; a
brand-new account with zero data (every aggregate must degrade to empty/zero,
not error); killing Express mid-load — `queries.ts` used to fall back silently
and now **throws**, so the failure should be loud and visible.

## E. Practice (תרגול) — P1

| # | Flow | Route | Hits |
|---|---|---|---|
| E1 | Builder: pick filters, see available count, start | `/practice` | `POST /api/practice/available-count`, `/sessions` |
| E2 | Play: answer, advance | `/practice/play/[idx]` | `POST /api/practice/attempts`, `/advance` |
| E3 | Bookmark toggle mid-question | `/practice/play/[idx]` | `POST /api/practice/bookmark/toggle` |
| E4 | Note save / delete mid-question | `/practice/play/[idx]` | `POST` / `DELETE /api/practice/notes` |
| E5 | Exit session | | `POST /api/practice/sessions/exit` |
| E6 | Resume prompt — continue or abandon | `/practice/resume` | `POST /api/practice/sessions/abandon` |
| E7 | Summary | `/practice/summary` | page query |
| E8 | Review session from a mistake / bookmark row | | `POST /api/practice/sessions/review` |
| E9 | Batch review (multi-select) | | `POST /api/practice/sessions/batch-review` |

**Worth breaking:** filter combinations yielding zero questions; double-click on
an answer (duplicate attempt row?); refresh mid-question and compare the `[idx]`
in the URL against the server-side position; back-button to an already-answered
index; starting a second session while one is active.

## F. Exam simulation (סימולציה) — P0

| # | Flow | Route | Hits |
|---|---|---|---|
| F1 | Intro then start exam | `/exam` | `POST /api/exam/sessions`, `/claim-window` |
| F2 | Answer / skip | `/exam/play/[idx]` | `POST /api/exam/attempts`, `/skip` |
| F3 | Pause / resume | | `POST /api/exam/pause`, `/resume` |
| F4 | Bookmark toggle | | `POST /api/exam/bookmark/toggle` |
| F5 | Submit final, then results | `/exam/results/[id]` | `POST /api/exam/submit-final` |
| F6 | Exit / abandon | | `POST /api/exam/exit`, `/sessions/abandon` |
| F7 | **Second-window conflict** | second tab on `/exam/play` | `POST /api/exam/claim-window` |
| F8 | Exam archive + archived auto-advance | `/exam-archive` | page query |

The highest-risk area in the app. Gameplay wrappers cast the Express response
to the old server-action shape — parity was ported, never proven.

**Worth breaking:** timer behaviour across pause, refresh, resume; the window
token when the same exam is opened in two tabs (and when the first tab is closed
without exiting); double-submit on `submit-final`; submitting with unanswered
questions; letting the timer expire while paused; network drop during
`submit-final` (the atomic RPC either committed or it didn't — the UI must not
claim both).

## G. Custom exam (שאלון מותאם אישית) — P1

| # | Flow | Hits |
|---|---|---|
| G1 | Load selectable question pool | `GET /api/custom-exam/pool?subject=<subject>` |
| G2 | Build exam from selected questions | `POST /api/custom-exam` |

Entry point confirmed 2026-09-27: the **dashboard subject cards** (מטלת כתיבה /
דין דיוני / דין מהותי) each fire `GET /api/custom-exam/pool?subject=…` on load —
this is the first browser-visible Express call in the app, so it doubles as the
quickest proof that the API path is wired and CORS is working.

**Worth breaking:** empty selection, one question, an implausibly large
selection, an unknown `subject` value.

## H. Mahoti — דיון מהותי — P1

| # | Flow | Route | Hits |
|---|---|---|---|
| H1 | Intro, start sitting | `/mahoti-start` then `/mahoti` | page query |
| H2 | Answer a question | `/mahoti` | `POST /api/mahoti/questions/:id/attempts` |
| H3 | Results | `/mahoti/results` | `GET /api/mahoti/attempts` |
| H4 | Review | `/mahoti/review` | |

The paper itself is served by Next.js; only filing and scoring go to Express.

## I. Diuni — דין דיוני — P1

Same shape as H, questions grounded in `verdict_list`.

| # | Flow | Route | Hits |
|---|---|---|---|
| I1 | Intro, start | `/diuni-start` then `/diuni` | page query |
| I2 | Answer | `/diuni` | `POST /api/diuni/questions/:id/attempts` |
| I3 | Results | `/diuni/results` | `GET /api/diuni/attempts` |
| I4 | Review | `/diuni/review` | |

## J. Writing task (מטלת כתיבה) — P1

| # | Flow | Route | Hits |
|---|---|---|---|
| J1 | Subject picker | `/writing-task` | `GET /api/open-questions/subjects`, `/` |
| J2 | Open a question | `/writing-task/[id]` | `GET /api/open-questions/:id` |
| J3 | Submit a typed answer | | `POST /api/open-questions/:id/answers` |
| J4 | **Upload handwriting** | | `POST /api/open-questions/:id/handwriting` |
| J5 | Results + model solution | `/writing-task/results/[answerId]` | `GET /api/open-questions/answers/:id`, `/solution` |
| J6 | Request regrade | | `POST /api/open-questions/answers/:id/regrade` |

J4 is a **file upload** (Cloudinary) and J3/J6 involve **AI grading** — slow,
non-deterministic, and costly. Budget for latency, test oversized and
wrong-type uploads, and note that regrade may spend real AI credits.

## K. Content library — P2

| # | Flow | Route | Hits |
|---|---|---|---|
| K1 | Notes list + TipTap editor save/load | `/notes` | `POST /api/notes/save`, `/load` |
| K2 | Bookmarks list + remove | `/bookmarks` | `POST /api/bookmarks/remove` |
| K3 | Mistakes list + soft-remove | `/mistakes` | `POST /api/mistakes/remove` |
| K4 | Statistics page | `/statistics` | page query **(unverified)** |

**Worth breaking:** K3 is a *soft* remove (`manually_removed=true`) — a later
mistake on the same question must be able to resurface it. K1 rich-text edge
cases: paste (against the copy-protection provider), very long Hebrew notes,
concurrent edits in two tabs.

## L. Account — P2

| # | Flow | Route | Hits |
|---|---|---|---|
| L1 | Edit full name + planned exam date | `/account` | `POST /api/account/profile` |

Hard Express-only (one of the two pilot domains — no server-action fallback
exists at all). **Worth breaking:** clearing the exam date (nullable), a date in
the past, names with RTL/LTR mixing.

## M. QA feature itself — P2

| # | Flow | Route | Hits |
|---|---|---|---|
| M1 | Floating QA widget visible only for `is_qa_tester` | any page | gate check |
| M2 | Submit a bug report **with a screenshot** | widget | `POST /api/qa/reports` (multipart) |
| M3 | Admin triage list + detail | `/admin/qa`, `/admin/qa/[id]` | page query |
| M4 | Admin sets report status | `/admin/qa/[id]` | `POST /api/qa/status` |

M2 is the only multipart endpoint. **Worth breaking:** a screenshot over 5 MiB
(must surface the Hebrew size error), no screenshot at all, submitting from a
page with no question context, and screenshot-upload failure — which by design
must *not* fail the report.

## N. Admin — P2

| # | Flow | Route | Hits |
|---|---|---|---|
| N1 | Users list + detail | `/admin/users`, `/admin/users/[userId]` | page query |
| N2 | Edit a user's name | | `POST /api/admin/profile/name` |
| N3 | Send password reset | | `POST /api/admin/password-reset` |
| N4 | Force sign-out | | `POST /api/admin/force-signout` |
| N5 | Toggle QA-tester flag | | `POST /api/admin/qa-tester` |
| N6 | Chapter / question browser | `/admin/chapters/[chapterId]/questions/[questionId]` | page query |
| N7 | Edit question source | | `POST /api/admin/content/source` |
| N8 | Edit question angle | | `POST /api/admin/content/angle` |

**Destructive against real rows — seeded test users only.** N4 must refuse
self-signout. N2–N8 all write `admin_actions` audit rows; content edits log only
`fields_changed`, never full text. A non-admin hitting these must get 403
`"forbidden"`, not a silent redirect.

## O. Cross-cutting — run against several flows, not standalone

| # | Concern |
|---|---|
| O1 | **RTL / Hebrew**: direction, mirrored controls, numerals, dates, mixed LTR |
| O2 | **Copy protection** (`no-copy-bypass-provider`) doesn't break paste into notes or password managers |
| O3 | **Session expiry mid-flow** — token refresh, and the revoked-refresh-token branch in the layout's try/catch |
| O4 | **Express down mid-flow** — the failure must be visible, never silent |
| O5 | **Refresh / back / forward** at every step of a stateful flow |
| O6 | **Double-submit** on every mutation button |
| O7 | Debug `console.log` leakage (`[auth]`, `[api →]`, `[api ←]`) — these exist today and violate the no-console rule |
| O8 | Email: unsubscribe route `/api/email/unsubscribe`, re-engagement cron `/api/cron/reengagement` (needs `CRON_SECRET`) |

---

## Suggested order

1. **B** (auth) — everything else needs a session
2. **C** (subscription gate) — everything else needs it open
3. **F** (exam) — highest risk, least verified
4. **E** (practice), **D** (dashboard)
5. **H**, **I**, **J**, **G** — the newer exam formats
6. **K**, **L**, **M**, **N**, **A**
7. **O** folded into each of the above
