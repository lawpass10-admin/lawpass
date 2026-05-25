# Slice 4 — Dashboard Analytics: Discovery

> Read-only investigation. Phases NOT proposed here. PM picks scope after
> reading this; phase plan follows.
>
> All file refs are clickable from this doc.

---

## A. Current dashboard state

`app/(app)/dashboard/page.tsx` is a single Server Component (~225 LOC). The
SHELL already mirrors the target wireframe; what's missing is data + a few
new widgets.

### Widgets rendered today

| # | Section | Status | Source |
|---|---|---|---|
| 1 | Greeting card (greeting + name + "יום שלישי · 5 במאי 2026") | **Live data** | `getHebrewGreeting()` from `lib/greetings.ts`; `profile.full_name`; `Intl.DateTimeFormat("he-IL", …)` (two calls, manual " · " separator) |
| 2 | Subscription card — days remaining + plan label | **Live data** | `subscription.ends_at` (countdown), `subscription.plan_type` mapped via in-file `PLAN_LABELS` (`3_months` / `6_months`) |
| 3 | Exam date card — days remaining OR "קבע תאריך בחינה" CTA → `/account` | **Live data + branch on null** | `profile.exam_date_planned` (nullable) |
| 4 | 4 KPI cards (שאלות שתורגלו / אחוז הצלחה / זמן ממוצע לשאלה / סימולציות) | **Empty placeholders** (`"—"` + "התחל לתרגל" subcopy) | `KPI_CARDS` const — static |
| 5 | "מגמת הצלחה" trend card | **Empty state copy + `<TrendingUp>` icon** | static |
| 6 | "שליטה לפי פרק" mastery card | **Empty state copy** | static |

### Queries fired today

Only two:
1. `requireActiveSubscription()` ([lib/auth/subscription-gate.ts:21](lib/auth/subscription-gate.ts:21)) — returns `{ user, subscription: { id, plan_type, ends_at } }`. Re-runs the auth + subscription gate (the layout's gate is bypassed by Router Cache on sibling nav, hence the duplicate).
2. `supabase.from("profiles").select("full_name, exam_date_planned").eq("id", user.id).maybeSingle()`

**Zero analytics queries today.** The trend chart, KPI cards, and mastery card are all static placeholders.

### Responsive behavior

Plain Tailwind breakpoints:
- Greeting card: full-width
- Subscription + Exam row: `grid gap-4 md:grid-cols-2` (stack on mobile)
- KPI row: `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4`
- Trend + Mastery: full-width, single column

No mobile-specific component — same DOM, classes shift at breakpoints.

---

## B. Target widgets — gap analysis

| # | Target widget | Today | Closest reuse | New query? |
|---|---|---|---|---|
| 1 | Greeting "בוקר טוב, [name]" | ✅ **already live** | `getHebrewGreeting()` + greeting card pattern in `dashboard/page.tsx` | none |
| 2 | Days-to-exam countdown | ✅ **already live** | `daysUntil(examDate)` helper in `dashboard/page.tsx` | none |
| 3 | "אתה במסלול" status pill | ❌ doesn't exist | Pass/fail pill pattern in [exam-results.tsx:106](app/(app)/exam/results/_components/exam-results.tsx:106) (`rounded-full px-4 py-1.5 emerald-100/destructive`) | **NEW** — needs rule logic + data. See §G.2 |
| 4 | "התמקד היום ב-[chapter]" recommendation | ❌ doesn't exist | No prior art for "focus chapter" in codebase | **NEW** — see §G.3 for algo options |
| 5 | Top actions: סימולציית בחינה + תרגול | ⚠️ partially (sidebar links exist, no dashboard CTA row) | `Button` (`@/components/ui/button`); `buttonVariants` already used at [dashboard/page.tsx:166](app/(app)/dashboard/page.tsx:166) | none — pure routing to `/exam` and `/practice` |
| 6 | KPI: שאלות שתורגלו (with source/angle breakdown) | ⚠️ placeholder card exists | Reuse the existing KPI card pattern (`Card` w/ `text-3xl text-muted-foreground` value); breakdown can mirror [exam-results.tsx:127-138](app/(app)/exam/results/_components/exam-results.tsx:127) (big number + smaller sub) | **NEW** — aggregate over `attempts` table |
| 7 | KPI: אחוז הצלחה + WoW delta | ⚠️ placeholder card exists | Same card pattern. Delta arrow has no prior art | **NEW** — needs date window (this week vs last week) |
| 8 | KPI: זמן ממוצע לשאלה | ⚠️ placeholder card exists | Same card pattern | **NEW** — `AVG(duration_seconds)` over `attempts` |
| 9 | KPI: סימולציות count + avg score | ⚠️ placeholder card exists | Same card pattern | **NEW** — aggregate over `exam_sessions WHERE status='completed'` |
| 10 | "שליטה לפי פרק" — 6 horizontal bars + חולשה badge + תרגל CTA | ⚠️ empty-state card exists | Bar pattern: [exam-results.tsx:161-169](app/(app)/exam/results/_components/exam-results.tsx:161); badge pattern: see §C. Deep link: §E — works today | **NEW** — per-chapter accuracy aggregate |
| 11 | "מגמת הצלחה" line chart (12 weeks) + personal high + streak | ⚠️ empty-state card exists | NO line-chart prior art in the codebase. Bars only. | **NEW** — weekly bucketing query; charting library decision required |

Summary: **5 of 11 widgets are partially live** (cards exist, data missing). **3 are fully greenfield** (status pill, focus recommendation, line chart). The shell matches the wireframe well; almost all the work is in data + 3 new visual elements.

---

## C. Available libraries / components

### Chart library — **none installed**

```
$ grep recharts/chart.js/victory/d3/nivo/tremor/visx in package.json
(nothing)
```

The 4 OKLCH chart slots `--chart-1` .. `--chart-5` are defined in [app/globals.css:69-73](app/globals.css:69) (currently all neutral grays — would need tuning if used). A library choice is a **decision item** for Slice 4. Options:

| Option | Notes |
|---|---|
| **recharts** | Most common pick in Tailwind/shadcn projects; SSR-friendly; ~80kb gzipped. Has a `LineChart`, `BarChart`, `ResponsiveContainer`. Probably overkill for what we need. |
| **Hand-roll SVG/CSS** | The codebase already does this — see [exam-results.tsx:161](app/(app)/exam/results/_components/exam-results.tsx:161) (horizontal bars) and [intro-content.tsx:69](app/(app)/exam/_components/intro-content.tsx:69). Adequate for bar charts. For a 12-point line chart, hand-rolled SVG is straightforward (~50 LOC). |
| **visx** | Modular d3 wrappers. More work but smallest bundle if you pick narrow modules. |

For one line chart + a row of bar charts, hand-rolled SVG is the lowest-cost path and fits the existing visual language. If we expect to add more chart types later, recharts pays for itself.

### Card / KPI primitive — `Card` exists, no `KpiCard`

[components/ui/card.tsx](components/ui/card.tsx): `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`. Supports `size="sm"` via `data-size`. Has `bg-card text-card-foreground ring-1 ring-foreground/10 rounded-xl`. **No KPI-specific variant** — but the existing dashboard already composes a KPI from these (CardHeader+CardContent+big number) so a reusable `<KpiCard>` wrapper is a small win, not strictly required.

### Design tokens (Tailwind v4 + shadcn/tailwind.css)

[app/globals.css:50-117](app/globals.css:50). OKLCH-only color tokens for light + dark:

- Backgrounds / fg: `--background --foreground --card --card-foreground --popover --popover-foreground --muted --muted-foreground --accent --accent-foreground`
- Brand / interaction: `--primary --primary-foreground --secondary --secondary-foreground --ring --border --input --destructive`
- 5 chart slots: `--chart-1` .. `--chart-5` (currently all neutral grays — needs review for real charts)
- Sidebar tokens (10x): `--sidebar*`
- Radius scale: `--radius-sm/md/lg/xl/2xl/3xl/4xl` derived from `--radius`
- Animations: `--keyframes timerPulse` (one custom kf, used for the exam timer; pattern reusable)

No gradient tokens. The mockup's "amber gradient" (if any) would be inline `bg-gradient-to-r from-amber-X to-amber-Y` or a new token.

Accent color in the existing app: **amber-500** (`bg-amber-500`) is the de-facto highlight (exam result bars, progress strip cells, badges). Emerald-100/700 for "good" states. Destructive (red) for "bad".

### Badge — pattern, not a primitive

Used in 5+ places. Exact pattern, dual-color examples from [mistake-row.tsx:115-125](app/(app)/mistakes/_components/mistake-row.tsx:115):

```tsx
<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/75">…</span>
<span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">…</span>
<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">…</span>
```

A "חולשה" weakness badge would naturally use `bg-destructive/15 text-destructive` or `bg-amber-100 text-amber-700` (matches existing visual vocabulary). Extracting a `<Badge variant="…">` would be a small refactor — worth doing in Slice 4 if 3+ new instances are needed.

### Progress bar — pattern, not a primitive

Used in [exam-results.tsx:161-169](app/(app)/exam/results/_components/exam-results.tsx:161) and [intro-content.tsx:69-77](app/(app)/exam/_components/intro-content.tsx:69):

```tsx
<div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-label="…">
  <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
</div>
```

Drop-in for the "שליטה לפי פרק" row visual. Same extraction question as Badge.

### Other UI in `components/ui/`

`alert, avatar, button, calendar, card, checkbox, dropdown-menu, form, input, label, radio-group, select, separator, sheet, sidebar, skeleton, sonner, tooltip`. **No `tabs`, `dialog`, `accordion`, `popover`, `progress`, `badge`, `chart`.** Skeleton + Sonner (toasts) are useful for loading + delta notifications.

`Button`: uses `@base-ui/react/button` + `cva`. Variants: `default | outline | secondary | ghost | destructive | link`. Sizes: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`. Active-press translate-y-px microinteraction baked in.

---

## D. Query patterns

### Where queries live

| File | Owns |
|---|---|
| [lib/db/practice.ts](lib/db/practice.ts) | Practice flow + bookmarks/mistakes lists (~1200 LOC). Pure DB helpers; caller-side `requireActiveSubscription()`. |
| [lib/db/exam.ts](lib/db/exam.ts) | Exam flow + sampling + per-position status (~930 LOC). Same pattern. |
| `lib/db/dashboard.ts` | **DOES NOT EXIST** — will need to be created. |

### Server-side vs RPC

**Pattern is server-side composition via PostgREST**, NOT RPC. The most analytics-heavy existing function is `getSummary` in [lib/db/practice.ts:594-755](lib/db/practice.ts:594): bucket per (chapter, subtopic) via in-process Map after batched `.in()` selects. `getExamResultsAggregate` in [lib/db/exam.ts:892-928](lib/db/exam.ts:892) does the same. **No RPCs called from these helpers**; the only RPC in the project is `grant_mock_subscription` (billing).

For Slice 4 totals, the same shape works fine at expected scale (≤thousands of `attempts` rows per user; we just batch-select and aggregate in TS). Worth measuring once before deciding to push aggregation into a Postgres view/RPC.

### Date-windowed queries — **no existing pattern**

Nothing in the codebase queries by "last N days" or "this week". `attempts.attempted_at` is the column to filter on (TIMESTAMPTZ; indexed by `(user_id, attempted_at)`? — need to confirm in schema). New helpers will need:
- start-of-week boundary (Sunday in Israel? Monday? — PM decision)
- "last 12 weeks" → 12 `WHERE attempted_at >= startOfWeek - i*7d` buckets, fetched in one `.gte(…)` + in-memory bucketing (avoids 12 round trips)
- WoW delta = ratio of (this-week accuracy) ÷ (last-week accuracy)

### RLS posture

All `lib/db/*` helpers use the SSR client with RLS enforced. `attempts`, `practice_sessions`, `exam_sessions`, `bookmarks`, `mistakes` are all filtered by `user_id` via RLS — no extra `.eq("user_id", …)` strictly required, but the helpers add it defensively. Slice 4 dashboard queries inherit this — same pattern, no admin client.

---

## E. Practice deep-linking with chapter filter

**Yes — supported today.** [lib/urls.ts:91-117](lib/urls.ts:91) defines `practiceSetupUrl(prefill?: PrefillInput)`; [lib/urls.ts:132-182](lib/urls.ts:132) parses with `parsePracticeSetupPrefill(params)`.

### Param convention (UUIDs, not codes)

```
/practice?chapters=<uuid>[,<uuid>...][&subtopic=<uuid>][&count=N][&angles=N][&time=N]
```

- `chapters`: comma-separated UUIDs, validated via UUID regex
- `subtopic`: single UUID — only honored when `chapters.length === 1`
- `count`: must be in `{1, 2, 5, 10, 20, 50}` (matches form choices)
- `angles`: integer in `[0, 4]`
- `time`: integer in `[60, 300]` seconds

The dashboard "תרגל" CTA cannot pass the chapter **code** (`civil_proc`); it must resolve to the chapter UUID first. Two options:

1. **Resolve UUID server-side in the dashboard query** (the per-chapter aggregate already JOINs `chapters` — just include `id` in the SELECT, build the link there).
2. **Add a code→UUID convenience to `lib/urls.ts`**: helper that accepts a code and the chapters list, returns the right URL.

Option 1 is the smallest change and matches the existing data flow.

### What WORKS for "תרגל" CTA today

- ✅ Pre-selecting a single chapter via `?chapters=<uuid>`
- ✅ Optionally pre-setting `count`, `angles`, `time`
- ⚠️ Bypassing the setup form entirely (auto-start practice on click) → **does not exist**. Today: dashboard CTA lands on `/practice` with prefilled form; user clicks submit.

If PM wants one-click "תרגל" → straight into the practice session (skip the setup form), that needs a new flow (probably a server action that creates a practice_session with sensible defaults + redirects to `/practice/play/0`).

---

## F. Edge cases

### F.1 — New user, 0 attempts

Today: the dashboard renders fine. Subscription + greeting + (optionally) exam date are populated. KPIs show `"—"` with subcopy "התחל לתרגל". Trend chart and mastery card show empty-state copy.

For Slice 4: same treatment for new widgets:
- KPIs: keep `"—"` + "התחל לתרגל" copy when totals are 0
- WoW delta: hide entirely (no prior week to compare)
- Mastery bars: show 6 chapter rows at 0% with subdued color + "התחל לתרגל" subcopy, OR just keep the existing empty-state card. **Decision needed: which is less depressing for a fresh user?**
- Trend chart: keep empty-state copy; don't render a flat-line chart at 0%
- Status pill ("אתה במסלול"): probably "התחלת המסע" or hide

### F.2 — Practice attempts only, no exams

Most KPIs populate (questions, %, time). "Simulations" KPI shows 0 → reuse same empty treatment as `"—"`. Status pill rule must tolerate this: an on-track learner who only practices is still on-track.

### F.3 — Single completed exam, 0 weeks of trend data

The "מגמת הצלחה" chart at 1 data point is meaningless. Options:
- Hide chart until ≥2 weeks of data exist; show a "המידע יוצג לאחר 2 שבועות" placeholder
- Show a single dot with no line

Same for WoW delta — needs ≥2 weeks before it makes sense; show the absolute number, hide the delta until then.

### F.4 — Mid-exam-flight

Hot bug if the dashboard is reachable during an active exam. Today the sidebar isn't even rendered on `/exam/play/*` (per the `x-pathname` middleware logic), but the user could open `/dashboard` in another tab. Aggregate queries would include partial in-flight attempts. **Decision**: should KPIs reflect in-flight exam attempts or only finalized ones? (`attempts.exam_session_id IS NOT NULL AND exam_sessions.status='completed'` to exclude in-flight; same call for practice sessions).

### F.5 — Stale exam_date_planned (date is in the past)

`daysUntil()` returns `max(0, …)` so the countdown will show "0 ימים" forever once the date passes. That's already the existing behavior, but the dashboard doesn't surface "your exam was X days ago — set a new one". Cheap to add a banner; PM call.

---

## G. PM configuration decisions

### G.1 — Exam date source

**Recommendation: per-user setting (already exists).**

`public.profiles.exam_date_planned` is nullable DATE — already used by `dashboard/page.tsx` and editable from `/account`. No new infra needed. Used by:

- [app/(app)/dashboard/page.tsx:95-111](app/(app)/dashboard/page.tsx:95) (countdown render)
- [app/(app)/layout.tsx:58](app/(app)/layout.tsx:58) (layout-side load)
- [lib/validators/auth.ts](lib/validators/auth.ts) (sign-up + onboarding validators)

Slice 4 should keep using this. Other options (env var / config table / hardcoded) make less sense — different students take the exam at different times, and the user already controls it from /account.

### G.2 — "אתה במסלול" rule

**No prior art — fully greenfield.** Two reasonable rules, both implementable in a pure helper in `lib/dashboard/on-track.ts`:

| Option | Rule | Pros | Cons |
|---|---|---|---|
| **A. Activity-based** | "On-track" iff user has ≥N practice attempts in the last 7 days (e.g. N=20 or N=50, calibrated per plan length) | Easy to explain; rewards consistency; no exam-date dependency | Doesn't reflect quality, only volume |
| **B. Burn-down based** | "On-track" iff current pace would have user reach Y questions/exams by `exam_date_planned`. Needs target Y (per plan) | Aligned with the exam goal | More moving parts; needs PM-set targets per plan_type; breaks if `exam_date_planned` is null |
| **C. Accuracy-based** | "On-track" iff user's last-week accuracy ≥ 60% (passing threshold) | Mirrors the exam pass threshold (24/40 = 60%) | Doesn't reward effort; punishes early learners |

PM should pick one (or a composite). Storage: pure computation from existing data, no new schema needed for any option. Rule lives in a helper called from the dashboard server component.

### G.3 — "התמקד היום ב-X" algorithm

**No prior art.** Three reasonable algorithms, all computable from the per-chapter accuracy aggregate that widget #10 already needs:

| Option | Rule | Pros | Cons |
|---|---|---|---|
| **A. Lowest accuracy chapter** | Pick the chapter with min(correct/total) among chapters with ≥N attempts | Direct "fix your weakness" framing; uses existing data | Stable across days (only changes when accuracy shifts); can feel repetitive |
| **B. Most-mistakes chapter** | Pick chapter with most mistakes in the last 7 days (`mistakes` table has `last_mistake_at`) | Recency-weighted; rotates as user practices | Mistakes table also has angle-mode entries — needs careful aggregation |
| **C. Rotation** | Daily rotation through 6 chapters seeded by user_id + today's date | Predictable variety; user sees every chapter weekly | Doesn't adapt to performance |
| **D. Composite** | Weakness-weighted lottery (lower accuracy → higher pick probability) seeded by date | Adaptive AND varied | More logic; harder to explain in copy |

For an MVP "focus today" recommendation, **option A is the simplest correct choice**. Option D is the right long-term answer but probably not first-version material. PM should pick.

---

## Other notes worth flagging

- **`app/(app)/statistics/page.tsx`** is a one-line placeholder mentioning "Slice 5 — אנליטיקה בסיסית בלבד ב-MVP". Slice 4 supersedes that route's planned content; we may want to either redirect `/statistics → /dashboard` or fold the statistics route into Slice 4's scope.

- **Existing trend chart copy** says "עוד לא תרגלת. התחל את הסשן הראשון שלך כדי לראות את ההתקדמות שלך כאן" — Slice 4 should preserve this copy for the 0-data state.

- **Hebrew RTL formatting** — there's an `Intl.DateTimeFormat("he-IL", { weekday: "long" })` pattern already; reuse it for week labels on the trend chart. Comma-vs-bullet separator quirk documented at [dashboard/page.tsx:65-79](app/(app)/dashboard/page.tsx:65).

- **Sidebar nav routes** today: `/dashboard`, `/practice`, `/exam`, `/bookmarks`, `/mistakes`, `/statistics`, `/account`. The dashboard CTAs "סימולציית בחינה" + "תרגול" duplicate sidebar links — visual prominence is the value, not new navigation.

- **Timezone caveat** ([lib/greetings.ts:6-12](lib/greetings.ts:6)) — server-side `new Date()` returns Frankfurt time, not Israel. Already a known TODO. WoW boundaries and "last 7 days" cutoffs will inherit this same drift; flag for Slice 4 if precision matters.

- **No "manage exam date" UX on dashboard** — today, if `exam_date_planned` is null, dashboard sends user to `/account`. Inline edit (modal, popover) would be a Slice 4 ergonomic win; the existing account form lives at `/account` — patterns already exist for date input via the `Calendar` UI primitive.

- **Caching** — neither route uses Next.js `revalidate` / `revalidateTag`. The whole dashboard is rendered fresh on every request (the layout's auth gate would be reused if not for the `Router Cache` workaround). Slice 4 should consider whether the trend chart query (potentially expensive) is worth a per-user revalidation tag.
