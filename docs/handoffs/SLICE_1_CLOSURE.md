# Slice 1 Closure — Foundation + Auth

**TL;DR.** Slice 1 shipped a complete authentication foundation: email + Google OAuth signup, OTP verification, profile creation, login, password reset, a placeholder pricing/checkout flow that grants mock 3- or 6-month subscriptions, and an authenticated app shell with a sidebar, dashboard, and 5 placeholder routes for Slice 2+. Production runs at `https://law-pass.com` with custom SMTP, custom domain, and verified OAuth. The codebase follows 5 Hardening Rules (all PASS or N/A foundation-OK), and the closure audit identified 1 P0 + 7 P1 items, of which P0 + 3 P1 are resolved on `main`; the remaining 4 P1 are queued as **Wave 2 infrastructure work that should land before any Slice 2 feature code**.

---

## 1. Overview

- **Scope.** Slice 1 = Foundation + Auth, per `docs/SPEC_final.md`. The user-visible deliverables: a working email signup wizard, email OTP verification, Google OAuth, login, password reset, a basic pricing screen, a placeholder checkout that grants a mock subscription, and an authenticated app shell.
- **Date range.** May 3 → May 8, 2026.
- **Production URLs.**
  - **Primary**: `https://law-pass.com` (custom domain, apex)
  - **Fallback**: `https://lawpass.vercel.app` (Vercel default; `www.law-pass.com` 308-redirects to apex)
- **Final commit on `main`.** `dcac6f3` — `fix(auth): verifyOtpAction orphan-user bug + sister fail-recovery gaps`.
- **Status.** Shipped, in production, all flows verified end-to-end by PM after each commit. Email signup → OTP → /pricing → /checkout → /dashboard works. Google OAuth → /onboarding/complete-profile → /pricing → /checkout → /dashboard works. Login + reset-password work. Subscription gating fires on every protected route via per-page helper.

---

## 2. The 7 Phases — what got built

### Phase 1 — Project Foundation

Bootstrapped the Next.js 16.2.4 + React 19.2 + TypeScript 5 project with Tailwind v4, shadcn/ui (Base UI variants), `@supabase/ssr` v0.10, Zod v4, react-hook-form, sonner toasts, lucide-react icons. Added the Heebo font for Hebrew display. Set `<html lang="he" dir="rtl">` globally in `app/layout.tsx`. Configured `pnpm` with overrides to dedupe Zod versions across the tree.

Established route groups: `app/(marketing)/` for the public landing, `app/(auth)/` for unauthenticated forms, `app/(app)/` for authenticated routes, `app/auth/` for OAuth route handlers (separate from `(auth)/` form routes by design — different middleware exclusion rules). Added `proxy.ts` middleware that handles auth-state-aware redirects.

Hardening Rule #1 enforced via `scripts/check-db-url.sh` wired into `pnpm build`: build fails if `DATABASE_URL` is set but doesn't contain `pooler.supabase.com`. Switched dev script to webpack (`next dev --webpack`) to work around a Turbopack memory leak on M1 16GB machines (commit `a2081f9`); production build still uses Turbopack (Next 16 default).

**Key files**: `app/layout.tsx:24` (RTL setup), `proxy.ts`, `scripts/check-db-url.sh`, `package.json:43-47` (zod override), `lib/supabase/server.ts` (SSR client), `lib/supabase/admin.ts` (admin client — usage tightly restricted).

**Key commits**: `66ef77b` initial scaffold → `fdad841` Slice 0 → `1700b86` Phase 1+2 (deps + route groups + middleware) → `a2081f9` webpack dev mode.

### Phase 2 — DB Schema + Security

Built the full Supabase schema in 14 sequenced migrations (`20260503000001` through `20260503000014`). Tables: `profiles`, `subscriptions`, `payments`, `chapters`, `subtopics`, `source_questions`, `source_choices`, `angle_questions`, `angle_choices`, `attempts`, `practice_sessions`, `exam_sessions`, `bookmarks`, `mistakes`, `question_notes`, `question_feedback`, `webhook_idempotency_log`, `admin_actions_log`. Enabled `pgcrypto`, `uuid-ossp`, `pg_trgm`, `btree_gist`, `pg_stat_statements`. RLS auto-enabled on every new public table via `rls_auto_enable()` event trigger.

**Hardening Rule #2** (always wrap `(SELECT auth.uid())` in policies) enforced from the first policy onward — verified live across all 36 policies. **Hardening Rule #4** (ICU he-IL collation) applied to every Hebrew TEXT column via the `hebrew` ICU alias. **Hardening Rule #5** (MViews locked down) applied to `mv_admin_dashboard_metrics`, `mv_question_difficulty`, `mv_user_chapter_stats` — anon=false, authenticated=false, service_role=true.

Helper functions: `is_admin()`, `has_active_subscription()`, `complete_user_profile(...)`, `grant_mock_subscription(p_plan_type TEXT)`. All SECURITY DEFINER with `SET search_path = public, pg_temp`. All check `auth.uid() IS NULL` defensively.

**Key migrations**: `20260503000003_profiles.sql`, `20260503000006_subscriptions.sql`, `20260503000010_materialized_views.sql`, `20260503000011_security_hardening.sql`, `20260503000013_lock_mviews.sql`, `20260503000014_fix_default_privileges.sql`.

**Key commit**: `c5518e1` (lock down MViews + fix grants).

### Phase 3 — Email Signup Wizard

Built the 3-step signup wizard in `app/(auth)/signup/_components/signup-form.tsx`. Step 1: email + password + confirmPassword. Step 2: full_name + phone + gender + birth_date. Step 3: exam_date_planned (optional) + terms_accepted. Per-step Zod schemas in `lib/validators/auth.ts`: `signupStep1Schema`, `signupStep2Schema`, `signupStep3Schema` validate the relevant subset before allowing `Next`; `signupSchema` validates the full payload on final submit.

Field-level validators: `passwordSchema` (min 8 + uppercase + lowercase + digit, per SPEC §6.1), `phoneSchema` (Israeli mobile `^05\d{8}$`), `birthDateSchema` (≥18 years), `examDatePlannedSchema` (`YYYY-MM-01`, `.nullish()` after the May 8 hotfix). `signUpAction` writes to `auth.users.raw_user_meta_data` via `signUp({ options: { data: { ... } } })`; verifyOtpAction reads it back.

**Key files**: `app/(auth)/signup/page.tsx`, `app/(auth)/signup/_components/signup-form.tsx`, `lib/validators/auth.ts`, `app/(auth)/_actions.ts:198-232` (signUpAction).

**Key commits**: `626c011` validators → `61ba0c7` Server Actions → `c71e600` 3-step wizard → `1a4c79c` RadioGroup/Checkbox controlled-from-first-render fix.

### Phase 4 — OTP Email Verification

Built `/verify-email` with the 6-digit OTP form (`app/(auth)/verify-email/_components/otp-form.tsx`), a 60-second resend cooldown enforced via the `lawpass_otp_resend_lock` HttpOnly cookie, and best-effort UI attempt counter. `verifyOtpAction` (`app/(auth)/_actions.ts:268-345`) calls `supabase.auth.verifyOtp({ type: 'email' })`, re-validates `auth.users.user_metadata` against `userMetadataSchema`, and calls the SECURITY DEFINER `complete_user_profile(...)` RPC to create the profiles row.

The RPC itself is in migration `20260504000003_complete_user_profile_rpc.sql` — derives `user_id` from `(SELECT auth.uid())` (Hardening Rule #2 even inside the function), uses `ON CONFLICT (id) DO NOTHING` for idempotency. Fail-recovery: if the RPC fails, the action signs the user out and clears all `sb-*` cookies via `clearStaleAuthCookies()` so the user retries from a clean state. The May 8 orphan-user bug exposed two more error branches that needed the same recovery — fixed at `dcac6f3`.

**Key files**: `app/(auth)/verify-email/page.tsx`, `app/(auth)/verify-email/_components/otp-form.tsx`, `app/(auth)/_actions.ts:268-345`, `supabase/migrations/20260504000003_complete_user_profile_rpc.sql`.

**Key commits**: `bead66a` OTP form → `aba211f` complete_user_profile RPC + fail-recovery → `9c193cd` INSERT-and-handle-23505 fix → `b7df59c` restore EXECUTE on is_admin → `dcac6f3` orphan-user hotfix.

### Phase 5 — Login + Password Recovery

Built `/login`, `/forgot-password`, `/reset-password`. `signInAction` returns a generic "פרטי ההתחברות שגויים" on any auth error (anti-enumeration, SPEC §6.4) but redirects to `/verify-email?email=…` if the credentials are valid but `email_not_confirmed` (lets unverified users recover). `requestPasswordResetAction` is fire-and-forget (errors swallowed for anti-enumeration) and always redirects to `/reset-password?email=...`. `resetPasswordAction` uses `verifyOtp({ type: 'recovery' })` for a short-lived recovery session, then `updateUser({ password })`, then `signOut()` so the user re-enters with the new password.

Email masking helper (`maskEmail`) shared between OtpForm and ResetPasswordForm shows `a****@example.com` so the user knows which inbox to check on a possibly-shared screen. The `lawpass_otp_resend_lock` cookie pattern is reused for `resendOtpAction`.

**Key files**: `app/(auth)/login/_components/login-form.tsx`, `app/(auth)/forgot-password/_components/forgot-password-form.tsx`, `app/(auth)/reset-password/_components/reset-password-form.tsx`, `app/(auth)/_actions.ts:380-410` (signIn), `:585-655` (reset).

**Key commits**: `f643fe0` login + pending_verification redirect → `a359d77` forgot-password → `e70e7d9` reset-password → `dcac6f3` resetPasswordAction sister-bug fix.

### Phase 6 — Google OAuth + Onboarding

The OAuth flow had the most architectural churn during Slice 1 (see §4 below for the bug story). Final shape:

- **`/auth/google` route handler** (`app/auth/google/route.ts`) — calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } })` and returns `NextResponse.redirect(googleUrl)`. Same-origin Set-Cookie + Location combination is the reliable way to deliver the PKCE verifier cookie to the browser.
- **`/auth/callback` route handler** (`app/auth/callback/route.ts`) — receives Google's redirect with `?code=...`, calls `exchangeCodeForSession(code)`, redirects `/dashboard` (which then layout-redirects to `/pricing` if no subscription).
- **`/onboarding/complete-profile`** (Server Component + Client Form) — for OAuth users without a profile row. Pre-fills `full_name` from `user_metadata.full_name` / `name` / email-prefix. User can edit. `completeGoogleOAuthSignup` Server Action validates via `oauthCompletionSchema`, calls `complete_user_profile` RPC, returns `{ ok: true, url }` for client-side navigation.
- **`(app)/layout.tsx`** branches on missing-profile: if `app_metadata.providers.includes('google')` redirect to `/onboarding/complete-profile`, else `signOut + redirect /login` (defensive against email-flow orphans, before the Phase 4 fail-recovery existed).

`proxy.ts` matcher excludes both `auth/google` and `auth/callback` to bypass the no-user → wipe-cookies branch, which would clobber the PKCE verifier mid-flow.

**Key files**: `app/auth/google/route.ts`, `app/auth/callback/route.ts`, `app/(auth)/onboarding/complete-profile/page.tsx`, `app/(auth)/onboarding/complete-profile/_components/complete-profile-form.tsx`, `app/(auth)/_actions.ts:472-580` (completeGoogleOAuthSignup), `proxy.ts`.

**Key commits**: `fa4ee5a` Google OAuth start + callback (initial) → `670b426` OAuth completion form → `9ca778f` layout guard refinement → debug session (`944d71d` → `b920d69` → `4fbb5fa` → `d6b4d1e` → `c7f59ec`) → `446da82` editable full_name + visual alignment → `c2b50e6` cleanup (Google account picker + remove diagnostics).

### Phase 7 — App Shell + Pricing + Checkout + Dashboard + Subscription Gate

Built the authenticated app surface area:

- **`AppSidebar`** (`components/app/app-sidebar.tsx`) — collapsible sidebar via shadcn `Sidebar` primitive (Base UI). Header: app name + greeting. Body: 5 nav items (Dashboard, Practice, Exam, Bookmarks, Mistakes, Statistics) with active-state highlighting via `usePathname()`, real-data badges (Bookmarks/Mistakes counts from `(app)/layout.tsx`'s parallel `Promise.all`), subscription card with plan + days-remaining, user dropdown with `/account` and signout. RTL-correct flush-right text alignment.
- **`/pricing`** — Server Component reads active-subscription state, redirects `/dashboard` if user already subscribed (defers SPEC §6.10 upgrade flow to Slice 4). Otherwise renders `PricingScreen` with 2-plan comparison (3 חודשים @ 350₪ vs 6 חודשים @ 1,000₪), BEST VALUE badge on 6-month, dynamic CTA price, 3 trust signals.
- **`/checkout?plan=plan_3m|plan_6m`** — Server Component validates plan, renders placeholder payment form (all inputs `disabled` + `aria-hidden`) with order summary. Submit calls `grantMockSubscriptionAction(planId)` which maps to `'3_months' | '6_months'` and invokes the `grant_mock_subscription(p_plan_type TEXT)` RPC.
- **`/dashboard`** — Greeting + subscription card + exam countdown + 4 KPI empty-state cards + trend chart empty state + chapter-mastery empty state. All real data only; no mocks.
- **5 placeholder routes** — `/practice`, `/exam`, `/bookmarks`, `/mistakes`, `/statistics`. Each is a 4-line async Server Component that calls `requireActiveSubscription()` then renders a 1-line stub.
- **Subscription gate** — `lib/auth/subscription-gate.ts` + `(app)/layout.tsx` parallel-Promise.all check. Layout-level for initial entry; per-page for client-side `<Link>` navigations (Router Cache reuses layout segments).

**Key files**: `components/app/app-sidebar.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/pricing/page.tsx`, `app/(app)/pricing/_components/pricing-screen.tsx`, `app/(app)/checkout/page.tsx`, `app/(app)/checkout/_components/checkout-screen.tsx`, `app/(app)/_actions.ts`, `lib/auth/subscription-gate.ts`, `lib/billing/plans.ts`.

**Key commits**: `e4105f6` /checkout placeholder → `64cabf0` /pricing rebuild → `3c0378a` AppSidebar + placeholder routes → `1e03adb` user dropdown + /account → `653e3e3` dashboard rebuild → `0e3b8ca` sidebar RTL alignment fix → `cbbfa44` sidebar active-state fix → `3f0329c` per-page subscription gate → `2b62477` plan_type bug fix → `81a3946` birth_date 3-Select dropdowns → `4958c7c` partial-selection display fix → `9408139` RadioGroup controlled state.

---

## 3. The 5 Hardening Rules — Compliance Status

| Rule | Statement | Verdict | Evidence |
|---|---|---|---|
| **#1 — Supavisor pooler** | Production `DATABASE_URL` must use the Supavisor pooler hostname (`pooler.supabase.com:6543`), not the direct DB host. | **PASS** | `scripts/check-db-url.sh` greps `DATABASE_URL` for `pooler.supabase.com` and exits non-zero otherwise. Wired into `package.json:7` (`"build": "bash scripts/check-db-url.sh && next build"`). `.env.example` ships the correct pooler URL. |
| **#2 — `(SELECT auth.uid())`** | Every RLS policy referencing `auth.uid()` must wrap it in a subquery (`(SELECT auth.uid())`) so Postgres caches the value once per query rather than calling the SECURITY DEFINER `auth.uid()` function per row. | **PASS** | Live `pg_policies` query against project `yxwggfvhpvszcigkztol` returned 36 policies; every one referencing auth.uid uses the wrapped form. Same pattern enforced inside SECURITY DEFINER functions (`complete_user_profile`, `grant_mock_subscription`, `has_active_subscription`, `is_admin`). |
| **#3 — 3-way handshake idempotency** | Webhooks (Tranzila, Resend) write to `webhook_idempotency_log` with idempotency key as PK before performing side effects, and check the log on every retry. | **N/A foundation-OK** | Tranzila is Slice 4. Foundation table `webhook_idempotency_log` exists (migration `20260503000009`) with PK on `idempotency_key`, RLS enabled, admin-only SELECT. Subscription-write idempotency proven via `ON CONFLICT (user_id) WHERE is_current = TRUE DO NOTHING` on the partial unique index. |
| **#4 — ICU he-IL collation** | Hebrew TEXT columns must use ICU `he-IL` (or alias `hebrew`) collation, not POSIX/libc, so sort and comparison match Hebrew alphabetic order. | **PASS** | All Hebrew TEXT columns (`profiles.full_name`, `chapters.title`, `subtopics.title`, all `source_questions` body fields, all `angle_questions` body fields, `source_choices.choice_text`, `angle_choices.choice_text`, `question_feedback.message`) use `COLLATE "hebrew"`. Live `pg_collation` query: `collprovider = 'i'` (ICU). ASCII-only enum/code columns correctly use `default`. |
| **#5 — MViews locked down** | Materialized views (admin metrics, MV-backed aggregates) must be readable only by `service_role`; never by `anon` or `authenticated`. | **PASS** | Live `has_table_privilege` check returns `anon=false, authenticated=false, service_role=true` for `mv_admin_dashboard_metrics`, `mv_question_difficulty`, `mv_user_chapter_stats`. Migration `20260503000013_lock_mviews.sql` is the source. |

---

## 4. Major Bug Fixes During the Debug Session (May 6-8, 2026)

### 4.1. OAuth PKCE verifier loss in Server Action redirect (P0)

**Symptom.** Google OAuth worked on localhost but failed in production with `AuthPKCECodeVerifierMissingError` on the `/auth/callback` step. Non-deterministic — sometimes succeeded.

**Root cause.** The original `signInWithGoogleAction` Server Action called `redirect(data.url)` to send the user to Google. Vercel's runtime drops `Set-Cookie` headers from Server Action responses that redirect to an external URL. The PKCE verifier cookie that `signInWithOAuth` writes to the cookie store via the SSR client's `setAll` callback was never reaching the browser. The callback then couldn't decrypt the auth code.

**Resolution arc (4 commits).**
1. `944d71d` instrument the callback route with diagnostic logging.
2. `b920d69` first hypothesis (cookie-clear-before-signInWithOAuth taints PKCE) — rejected after diagnostics.
3. `4fbb5fa` instrument `signInWithGoogleAction` + `setAll` catch.
4. `d6b4d1e` first attempt: return URL from action, navigate via `window.location.href` client-side. Helped but still flaky.
5. **`c7f59ec` final fix**: replace the Server Action with the `/auth/google` Route Handler. `NextResponse.redirect(googleUrl)` with the verifier cookie attached via `setAll` is reliable — same-origin Set-Cookie + Location is the standard pattern. Updated both Google buttons (login + signup) to navigate directly to `/auth/google`.

### 4.2. /pricing renders empty after onboarding (P0)

**Symptom.** Email signup → OTP → /pricing white-screened on first paint. Hard refresh restored the plan options. Same on Google OAuth → /onboarding/complete-profile → /pricing.

**Root cause.** Both `verifyOtpAction` and `completeGoogleOAuthSignup` ended with `revalidatePath("/", "layout") + redirect("/dashboard")`. Next.js 16 + Vercel handled this as: action response → RSC redirect → `/dashboard` → `(app)/layout.tsx` sees no subscription → RSC redirect → `/pricing`. The chained RSC redirects raced with the `revalidatePath` flush, leaving `/pricing`'s RSC payload stale on first navigation.

**Fix.** Same pattern as the OAuth fix: convert both actions to return `{ ok: true, url }` and have the form do `window.location.assign(result.url)`. A full page load avoids the chain. Bonus: each action runs the subscription check itself and returns `/pricing` or `/dashboard` directly, skipping the `/dashboard` hop.

**Commits.** `a69ae0b` (completeGoogleOAuthSignup) + `921394f` (verifyOtpAction) + `d6b4d1e` (signInAction earlier).

### 4.3. Subscription gate bypass via client-side `<Link>` (P0)

**Symptom.** Subscription-less user could view content at `/practice`, `/exam`, `/bookmarks`, `/mistakes`, `/statistics` by clicking sidebar `<Link>`s from `/pricing`. `/dashboard` correctly redirected; the others did not.

**Root cause.** Next.js Router Cache reuses the rendered layout segment between client-side `<Link>` navigations to siblings under the same layout. The `(app)/layout.tsx` subscription gate runs only on initial server entry (or hard refresh), not on partial RSC fetches that target just the leaf `page.tsx`.

**Fix.** `lib/auth/subscription-gate.ts` exports `requireActiveSubscription()` — called at the top of every protected page.tsx. Pages re-run on every navigation (unlike layouts), so the gate fires reliably. The layout's gate is kept as defense in depth.

**Commit.** `3f0329c`.

### 4.4. plan_type bug — every checkout granted a 3-month plan (P1)

**Symptom.** User selects 6-month plan on `/pricing`, CTA correctly shows 1000₪, but the resulting subscription row has `plan_type = '3_months'`.

**Root cause.** The original `grant_mock_subscription()` RPC was parameterless and hardcoded `plan_type = '3_months'`. The Server Action passed `plan_6m` but the RPC ignored it. Documented in `lib/billing/plans.ts` as "cosmetic for Phase 6", but the symptom was misleading.

**Fix.** New migration `20260506000001_grant_mock_subscription_takes_plan.sql` drops the parameterless function and creates `grant_mock_subscription(p_plan_type TEXT)` with allowlist validation (`'3_months'` → 90 days, `'6_months'` → 180 days, anything else → 22023 SQLSTATE error). Server Action maps `PlanId` → DB plan_type via a typed const. Deploy-window: ~4 minutes between migration apply and code push, accepted in single-tester staging.

**Commit.** `2b62477`. Sister fix at `490ca20` to `REVOKE EXECUTE FROM PUBLIC, anon` on the new function — Postgres's default-grant-to-PUBLIC was missed in the rewrite.

### 4.5. Birth date 3-Select dropdowns (UX P1)

**Symptom (initial).** Inline Calendar + toggle button in signup Step 2 + onboarding form was clunky on RTL Hebrew + small mobile viewports. PM revised the date-picker plan after seeing it live.

**Fix.** Replaced Calendar with three `<Select>` dropdowns — year (descending, 1940 → today−18), month (Hebrew month names with `String(i+1).padStart(2, "0")` values), day (dynamic based on year+month, with truncation when switching months invalidates the previous day). Removed `react-day-picker` and `date-fns/locale` from these forms; Calendar primitive remains in `components/ui/calendar.tsx` as deferred Slice 7 cleanup.

**Hotfix follow-up.** First implementation used a `composeIso` that returned `""` for partial selections + called `form.trigger("birth_date")` on every onValueChange. Result: picking "year" alone set field.value to `""`, the Select displayed the placeholder, and validation fired prematurely. Fixed by switching to local state per part inside the FormField, committing to `field.onChange` only when all three parts are set, and dropping the manual `form.trigger` call.

**Commits.** `81a3946` initial → `4958c7c` partial-selection display fix.

### 4.6. verifyOtpAction orphan-user bug (P0, May 8 production)

**Symptom.** Production user signed up via email skipping the optional `exam_date_planned`, got OTP, pasted it, saw a generic Hebrew error toast. Refresh kept them logged in but stuck; logout cleared session but Supabase rejected re-signup as duplicate-email. DB had an `auth.users` row with `email_confirmed_at` set but no `public.profiles` row.

**Root cause.** Supabase's auth-service strips null-valued keys from `user_metadata` when persisting to `auth.users.raw_user_meta_data`. `signUpAction` wrote `{ exam_date_planned: null }`; on read-back in `verifyOtpAction`, the key was absent (undefined), not null. `examDatePlannedSchema` was `z.string().regex(...).nullable()` — accepts string|null but rejects undefined. Schema parse failed; action returned `{ ok: false, error }` at the metadata-parse-fail branch — and that branch never called `signOut + clearStaleAuthCookies`, leaving the user authed with no profile row.

**Fix.**
- `lib/validators/auth.ts` — `examDatePlannedSchema` from `.nullable()` to `.nullish()` (= `.nullable().optional()`). Schema now accepts `string | null | undefined`.
- `app/(auth)/_actions.ts` — added `signOut + clearStaleAuthCookies` to two `verifyOtpAction` post-verify error branches: `!userId || !meta` (line 295-301) and `!metaParsed.success` (line 309-315). Both were stranding users.
- Sister fix in `resetPasswordAction` (line 638-647) — same cleanup added on `updateUser` failure inside the recovery session.
- Type narrowing fallout: `metaParsed.data.exam_date_planned ?? null` and `data.exam_date_planned ?? null` at the two `createProfile` callsites (verifyOtpAction line 327 + completeGoogleOAuthSignup line 524) since the schema now permits undefined.

**Commit.** `dcac6f3`.

---

## 5. Pre-Slice-2 Audit Findings

A comprehensive audit ran on May 7 covering 10 categories: Database & Performance, Auth & Authorization, Error Handling & Reliability, Frontend Architecture, UX Edge Cases, Code Quality & Maintainability, Testing & Observability, RTL/Hebrew, Scalability, Hardening Rules Compliance.

Total: **25 findings**.

| Priority | Count | Resolved on `main` | Deferred — Wave 2 | Deferred — Slice 7 polish |
|---|---|---|---|---|
| P0 | 1 | 1 (`490ca20` marketing-page admin client) | 0 | 0 |
| P1 | 7 | 3 (`490ca20` REVOKE on RPC + Promise.all in layout; leaked-password toggle blocked by Supabase Free tier) | 4 (error.tsx + loading.tsx, Sentry, CI, tests) | 0 |
| P2 | 7 | 0 | 0 | 7 (gate-query duplication, FK index on question_feedback.user_id, MView refresh strategy, server-action redirect-pattern inconsistency, react-day-picker/date-fns dead deps, `as unknown as DefaultValues` cast, multi-domain CSRF) |
| P3 | 10 | 0 | 0 | 10 (low-frequency FK indexes, BirthDateSelects duplication, magic-number `60`, mixed bundler dev/build, no `pnpm typecheck` script, edge-runtime opt-in audit, etc.) |

The P1 leaked-password protection toggle is **blocked**, not deferred — it requires upgrading the Supabase project to Pro (currently Free tier). Recommended for Wave 2 if budget allows.

The full audit lives in this conversation's transcript. If Slice 7 needs a structured copy of the P2/P3 list, regenerate from the audit report's "Findings by Category" section.

---

## 6. Architectural Patterns / Conventions Established

### 6.1. Server Action redirect pattern: prefer return-URL over `redirect()`

For any action that establishes a session AND the next page can be a layout-redirect target, do **not** call `redirect()` server-side. Instead return `{ ok: true, url: targetUrl }` and have the client do `window.location.assign(result.url)`. A full page load eliminates the RSC redirect chain that races with `revalidatePath`.

**Canonical examples**: `completeGoogleOAuthSignup` (`app/(auth)/_actions.ts:472-580`), `verifyOtpAction` (`:268-345`), `signInAction` (returns URL only on the `pending_verification` branch via `redirect()` to a known-stable path).

**Still using `redirect()`** (acceptable, none chains through a layout-redirect): `signUpAction`, `requestPasswordResetAction`, `resetPasswordAction`, `signOutAction`, `grantMockSubscriptionAction`. Migrating these to return-URL is Slice 7 polish for pattern consistency.

### 6.2. Per-page subscription gate

Every protected page in `app/(app)/` calls `await requireActiveSubscription()` (from `lib/auth/subscription-gate.ts`) at the top of its async Server Component. The layout-level gate in `(app)/layout.tsx` runs in parallel as defense in depth. Don't rely solely on the layout — Next.js Router Cache reuses layout segments across client-side `<Link>` navigations to siblings.

**Canonical example**: `lib/auth/subscription-gate.ts`. **Pages using it**: dashboard, practice, exam, bookmarks, mistakes, statistics. **Exempt** (per `SUBSCRIPTION_EXEMPT_PREFIXES` in the layout): pricing, checkout, account, onboarding/*.

### 6.3. Fail-recovery on post-auth errors

Every Server Action that successfully establishes an authenticated session AND then performs follow-up operations (RPC, multi-step writes) MUST call `await supabase.auth.signOut()` + `await clearStaleAuthCookies()` on every error branch. Otherwise the user is left authed with the operation half-done — the May 8 orphan-user bug.

**Canonical example**: `verifyOtpAction` after the `dcac6f3` fix — three post-verify error branches all call cleanup.

**Slice 7 idea**: extract a `withFailRecovery(supabase, async () => { ... })` helper that wraps post-auth blocks and uniformly applies cleanup on any error. Inline cleanup is the conservative pattern for now.

### 6.4. Supabase null-stripping in user_metadata

When writing nullable fields to `user_metadata` via `supabase.auth.signUp({ options: { data: { ... } } })`, Supabase's auth-service strips null-valued keys before persisting to `auth.users.raw_user_meta_data`. On read-back, those keys are undefined, not null.

Schemas validating user_metadata read-back must use `.nullish()` (= `.nullable().optional()`), not `.nullable()` alone. **Canonical example**: `examDatePlannedSchema` in `lib/validators/auth.ts:74-93`. Comment block explains the pattern for future contributors.

### 6.5. Date pickers — 3-Select pattern over inline Calendar

For RTL Hebrew apps, the 3-Select pattern (year/month/day) reads more naturally than an inline Calendar and works better on small mobile viewports. Layout: `<div className="flex gap-2">` with three `<Select>` each `flex-1`. Year list descending. Day count dynamic via `daysInMonth(year, month)` helper. Truncate day when switching to a month with fewer days.

**Canonical examples**: `signup-form.tsx` Step 2 birth_date (`:543-650`-ish range) and `complete-profile-form.tsx` birth_date. Currently duplicated — Slice 7 polish to extract `BirthDateSelects` sub-component to `components/forms/`.

### 6.6. PostgREST function ACL convention

Every SECURITY DEFINER function exposed via Supabase's auto-generated REST endpoints (`/rest/v1/rpc/<fn>`) must explicitly:
- `REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC;`
- `REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM anon;`
- `GRANT EXECUTE ON FUNCTION public.<fn>(...) TO authenticated;`

Postgres's default-grant-to-PUBLIC behavior on `CREATE FUNCTION` will otherwise expose the RPC to anonymous callers. The May 7 audit caught one regression of this pattern; the May 7 hotfix migration `20260507000001_revoke_grant_mock_subscription_public.sql` is the canonical example. Apply this template to every new RPC in Slice 2+.

---

## 7. Outstanding Work

### Wave 2 (recommended before / early Slice 2)

1. **Error + loading boundaries.** Add `app/error.tsx` (root), `app/(app)/error.tsx`, `app/(auth)/error.tsx` with Hebrew error messages + retry button. Add `app/loading.tsx` (esp. since `(app)/layout.tsx` does an async `Promise.all`). Effort: ~1 hour.
2. **Sentry integration.** `npx @sentry/wizard`, set `SENTRY_DSN` env var, wire source maps via Vercel build hook. Effort: ~1.5 hours.
3. **CI workflow.** `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile && pnpm tsc --noEmit && pnpm lint && pnpm build` on every PR. Gate merges on green. Effort: ~1.5 hours.
4. **Initial Vitest setup.** Vitest + React Testing Library config. First 5–10 unit tests covering Zod validators (`lib/validators/auth.ts`), `lib/billing/plans.ts` helpers, `requireActiveSubscription` mock-supabase test. Effort: ~3 hours initial; ongoing per-slice maintenance.
5. **Leaked Password Protection toggle (BLOCKED).** Requires upgrading Supabase from Free → Pro tier. PM decision. Once unblocked, one-click toggle in Auth → Policies → "Leaked Password Protection".

**Total Wave 2 effort**: ~7 hours of focused work.

### Slice 7 polish backlog

- **P2 items from audit** (7): subscription-SELECT duplicated 4× → extract single helper; FK index on `question_feedback.user_id`; MView refresh strategy via `pg_cron`; 5 Server Actions still using `redirect()` → migrate to return-URL pattern; `react-day-picker` + `date-fns` dead deps; `as unknown as DefaultValues<...>` cast in 2 forms; multi-domain CSRF / `serverActions.allowedOrigins` documentation.
- **P3 items from audit** (10): low-frequency FK indexes (source_questions.created_by, subscriptions.granted_by_admin, subscriptions.payment_id), `BirthDateSelects` component extraction, magic number `60` → `OTP_RESEND_COOLDOWN_SECONDS` constant, mixed bundler dev/build, no `pnpm typecheck` script, edge-runtime opt-in audit, cookie security explicit options, structured logger migration, stale doc-comment in `auth/google/route.ts:9` (mentions deleted `signInWithGoogleAction`), bundle-size monitoring.
- **RadioGroup uncontrolled→controlled warning** — Base UI internal, requires upstream fix or custom Radio component.

---

## 8. Custom Domain Setup (Reference)

Completed May 8, 2026. Documented for future ops reference.

- **Vercel.** Apex `law-pass.com` is the primary domain. `www.law-pass.com` 308-redirects to apex. SSL provisioned automatically via Let's Encrypt.
- **DNS.** Registrar: GoDaddy. Single A record `@ → 216.198.79.1` (Vercel's anycast IP). No CNAME on apex (Vercel's apex-supporting flatten not needed).
- **Resend (transactional email).** Domain `law-pass.com` verified via Domain Connect from Resend's dashboard (auto-creates SPF, DKIM, return-path TXT/CNAME records on GoDaddy). Verified sender: `noreply@law-pass.com`.
- **Supabase Auth config.** Site URL: `https://law-pass.com`. Additional Redirect URLs: `https://law-pass.com/auth/callback` (also kept `https://lawpass.vercel.app/auth/callback` as fallback for direct Vercel access during testing).
- **Google Cloud Console (OAuth client).** Authorized JavaScript origins: `https://law-pass.com`, `https://lawpass.vercel.app`. Authorized redirect URI: `https://yxwggfvhpvszcigkztol.supabase.co/auth/v1/callback` (Supabase's OAuth handler — Google → Supabase → us).
- **Vercel env vars.** `NEXT_PUBLIC_SITE_URL = https://law-pass.com` (used by `signInWithOAuth`'s `redirectTo`). All other secrets unchanged.
- **Supabase SMTP.** Custom SMTP enabled via Resend. From: `noreply@law-pass.com`. Replaces Supabase's default rate-limited testing-mode sender. Email signup OTP and password-reset OTP now deliver to any address (not just `lawpass10@gmail.com`).

---

## 9. Commit Map — chronological

| Hash | Description |
|---|---|
| `66ef77b` | Initial commit (Create Next App) |
| `fdad841` | Slice 0 — project scaffold, DB schema, Supabase connectivity |
| `4d74c17` | Fix generated types — remove injected plugin hint tag |
| `c5518e1` | Lock down materialized views, fix overly broad grants |
| `1700b86` | Slice 1 Phase 1+2 — deps, shadcn primitives, route groups, proxy.ts |
| `a2081f9` | Switch dev script to webpack (Turbopack memory leak on M1 16GB) |
| `626c011` | Phase 3 file 1 — Zod auth validators |
| `61ba0c7` | Phase 3 file 2 — auth Server Actions |
| `c71e600` | Phase 3 file 3 — /signup 3-step wizard |
| `1a4c79c` | RadioGroup + Checkbox controlled-from-first-render fix |
| `d4b8ebd` | TODO referencing Base UI RadioGroupItem warning |
| `f643fe0` | Phase 3 file 4 — /login form + pending_verification redirect |
| `bead66a` | Phase 3 file 5 — /verify-email OTP form |
| `a8433b1` | Harden auth against stale JWTs + cookie-chunk persistence |
| `9c193cd` | createProfile — drop SELECT-then-INSERT, INSERT + 23505 only |
| `b7df59c` | Restore EXECUTE on is_admin/has_active_subscription for authenticated |
| `aba211f` | Phase 4 — complete_user_profile RPC + fail-recovery |
| `a359d77` | Phase 3 file 6 — /forgot-password form |
| `e70e7d9` | Phase 3 file 7 — /reset-password form |
| `fa4ee5a` | Phase 5 — Google OAuth start + callback route |
| `670b426` | Phase 5 — OAuth completion form + completeGoogleOAuthSignup |
| `9ca778f` | Refine layout guard for OAuth-only redirect |
| `e4105f6` | Phase 6 commit 1 — /checkout placeholder + grantMockSubscriptionAction |
| `64cabf0` | Phase 6 commit 2 — rebuild /pricing with plan comparison |
| `3c0378a` | Phase 7 commit 1 — AppSidebar + placeholder routes |
| `1e03adb` | Phase 7 commit 2 — user dropdown + /account placeholder |
| `653e3e3` | Phase 7 commit 3 — rebuild dashboard with empty states |
| `0e3b8ca` | Sidebar menu items align flush right in RTL |
| `cbbfa44` | Sidebar active state follows actual route |
| `93d42c0` | Align zod + @hookform/resolvers versions for Vercel build |
| `944d71d` | OAuth callback — detailed prod-debug logging |
| `b920d69` | Remove cookie clear before signInWithOAuth (rejected hypothesis) |
| `4fbb5fa` | Instrument setAll catch + signInWithGoogleAction |
| `d6b4d1e` | Return URL from Server Action, navigate client-side |
| `c7f59ec` | Move OAuth start to Route Handler — final OAuth fix |
| `a69ae0b` | Return URL from completeGoogleOAuthSignup |
| `921394f` | Return URL from verifyOtpAction |
| `3f0329c` | Per-page subscription gate fires on client-side navigation |
| `c2b50e6` | Cleanup — Google picker, remove diag logs, drop dead code, tighten phone validator |
| `446da82` | Editable full_name + visual alignment with email signup |
| `2b62477` | grant_mock_subscription accepts plan_type |
| `9408139` | RadioGroup controlled state + reset-password full §6.1 rules |
| `81a3946` | Replace birth_date Calendar with 3-select dropdowns |
| `4958c7c` | birth_date partial-selection display + premature validation |
| `490ca20` | Wave 1 — drop admin client from /, REVOKE anon EXECUTE on RPC, parallelize layout queries |
| `dcac6f3` | verifyOtpAction orphan-user bug + sister fail-recovery gaps |

---

## 10. Slice 2 Recommendation

**Tackle Wave 2 infrastructure (error boundaries + CI + Sentry + initial Vitest) BEFORE writing any Slice 2 feature code.** The ~7 hours of upfront work pays compound dividends across Slice 2's life. Slice 2 will introduce the most complex code in the repo to date — practice/exam timer state, exam pause/resume, retry semantics, performance-sensitive query paths. Without test coverage and observability, regressions will be invisible until manual QA. Without error boundaries, the first transient DB hiccup ships an English-only Next.js error page to a Hebrew-speaking user.

The Slice 2 spec lives in `docs/SPEC_final.md` (search for "Slice 2: Practice"). Don't duplicate it here. Open the spec, do the Wave 2 work first, then start on Slice 2 with confidence that broken commits will be caught by CI and broken behavior will be caught by tests.

**Last commit on `main`: `dcac6f3`. Production: `https://law-pass.com`. Next milestone: Slice 2 — Practice mode.**
