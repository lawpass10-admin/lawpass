# lawpass_server

Standalone **Node.js + Express** backend for LawPass. It hosts the API /
endpoint logic extracted from the Next.js server actions and talks to the
same **Supabase** database. The Next.js app remains the frontend.

> Status: **All domains migrated** — Practice, Auth, Exam, Notes,
> Bookmarks, Mistakes, QA, Admin, Account, Dashboard, and Early-access.
> What remains are the read-only aggregations still owned by the other
> domains' Next.js pages (see "Notes on the port"), plus rewiring the
> frontend to call this server.

## Architecture

```
lawpass_server/
  app.js                     # Express bootstrap: cors, json, logging, mount /api, error handling
  config/
    env.js                   # loads + validates env (fails fast)
    supabase.js              # client factory: anon / clientForToken (RLS) / admin (service-role)
  middleware/
    auth.js                  # Bearer token → req.user + req.supabase (RLS-scoped)
    require-subscription.js  # active-subscription gate (mirrors subscription-gate.ts)
    require-tester.js        # profiles.is_qa_tester gate (QA report submit)
    require-admin.js         # profiles.is_admin gate (mirrors admin-gate.ts)
    upload.js                # multer memory upload for the QA screenshot
    validate.js              # Zod body validation → req.valid
    async-handler.js         # forwards async errors to the error handler
    error-handler.js         # 404 + terminal 500 handler
  constants/
    profile.js               # institution/specialization/plan id lists (from lib/profile, lib/billing)
  lib/
    dashboard/               # pure dashboard helpers (date-windows, focus-chapter, on-track)
  validators/
    practice.js, auth.js     # Zod schemas (ported from lib/validators/*)
  db/
    practice.js              # DB query helpers (ported from lib/db/practice.ts)
  controllers/
    practice.controller.js   # endpoint logic (ported from the practice _actions.ts files)
    auth.controller.js       # endpoint logic (ported from (auth)/_actions.ts)
  routes/
    index.js                 # mounts domain routers under /api
    practice.routes.js       # /api/practice/*
    auth.routes.js           # /api/auth/*
```

## Auth model (RLS-first — Hardening Rule #2)

The frontend sends the user's **Supabase access token** as
`Authorization: Bearer <token>`. `authenticate` verifies it and builds a
Supabase client scoped to that token, so every query runs under the
user's identity and `(SELECT auth.uid())` RLS policies apply exactly as
they did in the Next.js SSR client. The service-role client
(`adminClient`) is reserved for admin/webhook paths.

## Endpoints (Practice)

Base: `/api/practice` · all responses are `{ ok, ... }` (parity with the
former server actions).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/available-count` | auth + sub | reactive availability count for the builder |
| POST | `/sessions` | auth + sub | create a practice session (3-pass sampling) |
| POST | `/sessions/abandon` | auth + sub | abandon the active session |
| POST | `/sessions/review` | auth + sub | single-question review session |
| POST | `/sessions/batch-review` | auth + sub | batch review from bookmarks/mistakes |
| POST | `/attempts` | auth | submit an answer |
| POST | `/advance` | auth | advance to next question / summary |
| POST | `/bookmark/toggle` | auth | toggle bookmark for the current question |
| POST | `/sessions/exit` | auth | manual exit (complete/abandon) |
| POST | `/notes` | auth | upsert a note |
| DELETE | `/notes` | auth | delete a note |

### Endpoints (Auth)

Base: `/api/auth`. Session-establishing endpoints **return the Supabase
session** (`{ access_token, refresh_token, ... }`) in the body — the
frontend stores it and sends `access_token` as the Bearer header on
subsequent requests (there are no server-held cookies).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/signup` | public | email+password signup → OTP email |
| POST | `/verify-otp` | public | verify signup OTP, create profile, **returns session** |
| POST | `/resend-otp` | public | resend signup OTP |
| POST | `/signin` | public | password login, **returns session** |
| POST | `/request-password-reset` | public | fire-and-forget reset OTP |
| POST | `/reset-password` | public | verify recovery OTP + set new password |
| POST | `/complete-google-signup` | auth | post-OAuth profile completion |
| POST | `/signout` | auth | revoke the session |

**Google OAuth initiation + callback stay in Next.js.** `/auth/google`
and `/auth/callback` are a browser PKCE redirect handshake tied to the
frontend's cookies and the Supabase redirect URL allow-list — moving them
would break the working flow. Only the post-OAuth profile step is here.

### Endpoints (Exam)

Base: `/api/exam` · all endpoints are auth + subscription gated. Gameplay
actions are thin wrappers over SECURITY DEFINER RPCs (atomic time math +
single-window token validation). Error fields are **codes** (e.g.
`session_not_found`, `window_conflict`, `exam_pool_insufficient`) that the
frontend maps to Hebrew.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sessions` | mint a 40-question session (mode: procedural/substantive/combined) |
| POST | `/sessions/abandon` | soft-cancel in-flight session |
| POST | `/attempts` | record/overwrite an answer |
| POST | `/skip` | skip a question |
| POST | `/pause` | pause the timer |
| POST | `/resume` | resume a paused session |
| POST | `/bookmark/toggle` | toggle bookmark |
| POST | `/submit-final` | score + finalize → results URL |
| POST | `/exit` | save (pause) & exit to dashboard |
| POST | `/claim-window` | claim the single active window (multi-tab guard) |

### Endpoints (Notes)

Base: `/api/notes` · auth only (RLS enforces subscription). These are the
**centralized notes-bank** actions, which write/read by stored identity
`(question_type, source_question_group_id, angle_position)`. (The
practice-play editor's session-relative note save/delete lives separately
under `/api/practice/notes`.)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/save` | upsert a note by identity (bank editor) |
| POST | `/load` | lazily load a note by identity → `{ note \| null }` |

### Endpoints (Bookmarks)

Base: `/api/bookmarks` · auth + subscription gated. The bookmarks *list*
read and the play-time bookmark toggle live elsewhere (page query in
`db/practice.js`, and `/api/practice/bookmark/toggle` /
`/api/exam/bookmark/toggle`); this domain is just the list-page removal.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/remove` | delete a bookmark by id (RLS-guarded) |

### Endpoints (Mistakes)

Base: `/api/mistakes` · auth + subscription gated. The list read lives in
`db/practice.js` (`getUserMistakes`); this domain is the list-page removal.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/remove` | soft-remove a mistake (`manually_removed = true`, not DELETE) |

### Endpoints (QA)

Base: `/api/qa`. The submit endpoint is **tester-gated**
(`profiles.is_qa_tester`) and the status endpoint is **admin-gated**
(`profiles.is_admin`); both gates read the caller's own profile via the
RLS client, with RLS on `qa_reports` as the load-bearing boundary.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/reports` | auth + tester | submit a QA report (**multipart/form-data**; optional `screenshot` file) |
| POST | `/status` | auth + admin | move a report open/in_progress/resolved (writes `admin_actions_log`) |

`/reports` is the only **multipart** endpoint: the text fields ride
alongside an optional `screenshot` image (PNG/JPEG/WebP, ≤ 5 MiB). The
row is INSERTed first; the file then uploads to the `qa-screenshots`
bucket at `${userId}/${reportId}.${ext}` and the `screenshot_path` is
patched via the service-role client (the bucket policy already scoped the
upload to the tester's own folder). A screenshot failure never fails the
report — the row is preserved and logged for the admin to reconcile. The
endpoint deliberately touches **only** `qa_reports` + the bucket, so the
widget can submit during an active exam without disturbing the timer /
window-token / auto-submit.

The QA admin **read** surfaces (`listQaReports`, `getQaReportDetail`,
`countOpenQaReports`, `resolveChapterForQuestion`) stay as Next.js
admin-page queries for now, consistent with the other domains' read
paths.

### Endpoints (Admin)

Base: `/api/admin` · every endpoint is **admin-gated**
(`profiles.is_admin`, via the `requireAdmin` middleware). Each successful
mutation writes one `admin_actions_log` row (`admin_id` always from the
authenticated admin, never a payload field). `revalidatePath` was dropped.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/profile/name` | update a user's `full_name` |
| POST | `/password-reset` | send the target user a password-recovery email (service-role Auth Admin API) |
| POST | `/force-signout` | revoke a user's sessions (deletes `auth.sessions`; refuses self) |
| POST | `/qa-tester` | toggle `profiles.is_qa_tester` |
| POST | `/content/source` | edit the whitelisted text/array fields of a `source_questions` row |
| POST | `/content/angle` | edit the whitelisted text/array fields of an `angle_questions` row |

The QA-report **status** action lives with the qa domain
(`POST /api/qa/status`) since it targets a report, not a user.
`force-signout` and `password-reset` use the **service-role** client
(the `auth` schema / Auth Admin API are unreachable under RLS); every
other admin write runs under the admin's RLS client. The content
endpoints validate against a strict field **whitelist**, so a forged
payload can't touch `question_text` / `chapter_id` / `status` / choices.

The admin **read** surfaces (users list + detail, dashboard stats,
chapter/question listings, QA list/detail) stay as Next.js admin-page
queries for now, consistent with the other domains' read paths.

### Endpoints (Account)

Base: `/api/account` · auth only. The write is scoped to the caller's own
profile by the `users_update_own_profile` RLS policy (`auth.uid() = id`).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/profile` | update the user's own `full_name` + `exam_date_planned` |

`exam_date_planned` accepts `null` (clearable from the UI) and otherwise
must be a first-of-month `YYYY-MM-01` date. The account **read** (the
profile page's initial load + subscription status) stays a Next.js page
query.

### Endpoints (Dashboard)

Base: `/api/dashboard` · all **GET**, auth + subscription gated (mirrors
the dashboard page's `requireActiveSubscription`; RLS is defense-in-depth).
Read-only analytics aggregates — each returns `{ ok: true, <name> }`.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/kpi` | KPI cards: attempts/accuracy/durations/exam scores/counts + 7-day sparkline + 12-week bars |
| GET | `/mastery` | per-chapter accuracy rows (ordered by `display_order`, incl. zero-attempt chapters) |
| GET | `/status` | header-strip status pill + focus chapter (derives mastery internally, then evaluates) |
| GET | `/trend` | 12-week Sunday–Saturday accuracy trend + personal-high + streak |
| GET | `/hero` | resumable practice session for the hero card, or `null` if none/stale (>24h) |

> **First read-heavy domain ported.** Unlike the other domains (whose
> read aggregations stay in Next.js), the dashboard is *entirely* reads,
> so it was moved wholesale. All Israel-timezone date math + the
> focus-chapter / on-track logic live as pure helpers under
> `lib/dashboard/`. Read failures degrade to empty/zero/null (the
> dashboard renders empty state rather than erroring). The `/status`
> handler fetches mastery then derives the pill in one request — the
> React `cache()` request-dedup the Next.js page relied on isn't needed
> server-side.

### Endpoints (Early-access)

Base: `/api/early-access` · **public** (no auth). The waitlist page is
anonymous, so this is the only endpoint that uses the **anon** client
(publishable key) — the `waitlist_signups_anon_insert` RLS policy
authorizes the write.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/waitlist` | capture a waitlist email (`{ email, source? }`) |

Unlike every other endpoint, the response is a **typed token union** the
frontend switches on, always at HTTP 200: `{ ok: true }`, or
`{ ok: false, error: "invalid_email" \| "transient" }`. A duplicate email
(PG `23505`) is a **silent success** — the same thank-you state as a fresh
signup, which keeps waitlist membership opaque to unauthenticated callers.
Because of that union, validation is done inside the controller rather
than via the `validateBody` middleware (which would 400 with a Hebrew
string). Malformed JSON still hits the global error handler as a 500.

`GET /health` is an unauthenticated liveness probe.

## Configuration & secrets

**Config is consolidated into ONE file** shared with the Next.js app:
`app/.env.local` (i.e. `../.env.local` from here). There is no separate
server `.env` — both servers read that single file. Secrets live only in
it, never in code. `config/env.js` resolves the env file in priority
order:

1. `LAWPASS_ENV_PATH` — explicit path. In **production**, keep the env
   file OUTSIDE the repo and point this at it, e.g.
   `LAWPASS_ENV_PATH=/etc/lawpass/server.env node app.js`.
2. `<server>/../.env.local` — the consolidated single source (`app/.env.local`).
3. `<server>/../.env` — fallback (legacy).
4. `<server>/.env` — fallback (legacy server-local).

The first file that exists wins; the resolved path is logged at startup
(never the values). Required vars are validated on boot (fail-fast).
`.env.local` is gitignored; the committed template is `app/.env.example`.

## Run

```bash
# One-time: create the shared env file at the repo root (app/).
cd app
cp .env.example .env.local   # fill in Supabase keys + DB URLs (both servers read this)

# Then start the server:
cd lawpass_server
npm install
npm run dev                  # node --watch app.js  → http://localhost:4000
```

## Frontend client (wiring)

The Next.js app calls this server through a thin browser client at
`app/lib/api/` — **env-gated** so production is unaffected until the
server is deployed:

- `NEXT_PUBLIC_API_BASE_URL` set (local dev = `http://localhost:4000`) →
  the client hits this API; unset (Vercel/prod) → it falls back to the
  in-app server actions.
- `lib/api/client.ts` attaches the Supabase access token as
  `Authorization: Bearer …` (read from the browser session).
- Per-domain wrappers (`lib/api/<domain>.ts`) mirror each action's
  signature + `{ ok, … }` return, so components only swap their import.
- `NEXT_PUBLIC_*` is inlined at build time → **restart `pnpm dev`** after
  changing the var. `CORS_ORIGINS` must include the calling origin.

Wired so far: **early-access, account** (pilot). Remaining domains follow
the same pattern; **auth is last** (its actions establish the session, so
the client must `setSession()` with the tokens the server returns).

## Notes on the port

- `revalidatePath` (Next cache hint) was dropped — no server-side
  equivalent; the frontend refetches after a mutation.
- The subscription `redirect("/pricing")` became a `403 { code: "no_subscription" }`
  the frontend can act on.
- Business outcomes keep the `{ ok:false, error }` shape at HTTP 200
  (matching action semantics); only auth (401/403), validation (400),
  and unexpected failures (500) use error status codes.
- Most read-only aggregations still owned by the Next.js frontend
  (`getSummary`, `getResumableSessionForUser`, sidebar counts,
  `getChaptersWithQuestionCount`) are **not** yet moved — they can follow
  in a later pass. The **dashboard** is the exception: being an entirely
  read-only domain, it was ported wholesale as GET endpoints under
  `/api/dashboard` (see that section).
