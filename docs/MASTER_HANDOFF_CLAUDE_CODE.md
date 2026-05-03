# LawPass — Master Handoff for Claude Code

> **קרא את כל המסמך הזה לפני כל פעולה.**
> **כל chat חדש איתך מתחיל מהמסמך הזה + ה-SPEC המלא.**

---

## 1. רקע

**LawPass** — פלטפורמת הכנה לבחינת לשכת עורכי הדין בישראל.

- **Stage:** MVP, ימים ראשונים. לא קיים קוד עדיין.
- **משתמשים יעד:** סטודנטים למשפטים בישראל. UI עברית, RTL.
- **מודל:** Subscription (3 חודשים / 6 חודשים) דרך Tranzila.
- **Scale יעד:** 5K MAU, ~24M שורות ב-`attempts` בשיא.

---

## 2. Stack — Locked

| רכיב | טכנולוגיה |
|------|-----------|
| Framework | **Next.js 14 (App Router)** |
| Language | **TypeScript strict** |
| UI | **shadcn/ui** + **Tailwind CSS 3** |
| Forms | React Hook Form + Zod |
| Direction | **RTL** (`dir="rtl"` על `<html>`) |
| Icons | Lucide React |
| Editor | TipTap (Slice 5) |
| Charts | Recharts |
| DB | **Supabase Postgres 15** |
| Auth | **Supabase Auth** (Email + OTP, Google OAuth) |
| Hosting | **Vercel** |
| Email | Resend |
| Payment | **Tranzila** (Slice 4) |
| Monitoring | Sentry (Slice 7) |
| Package Manager | **pnpm** |
| Git | GitHub Flow (feature branches → main) |

**אסור** להחליף רכיבים בלי אישור מ-PM.

---

## 3. 🔴 חמשת חוקי ה-Hardening — לא מתעלמים מהם

כל קוד שתכתוב חייב לציית ל-5 הכללים האלה. אם יש קונפליקט — תעצור ותשאל.

### חוק #1 — Supavisor Transaction Mode בלבד ב-Production
- `DATABASE_URL` חייב להצביע ל-`pooler.supabase.com:6543` (Transaction Mode).
- **אסור** `db.PROJECT.supabase.co:5432` (Direct) ב-Production.
- ב-CI: לחסום build אם `DATABASE_URL` לא מכיל `pooler.supabase.com`.
- מותר Direct רק ל-migrations מקומיים.
- **SPEC: 9.4.4**

### חוק #2 — `(SELECT auth.uid())` בכל RLS Policy
```sql
-- ❌ אסור:
CREATE POLICY ... USING (user_id = auth.uid());

-- ✅ חובה:
CREATE POLICY ... USING (user_id = (SELECT auth.uid()));
```
- שיפור פי 10-20 בביצועים על 24M שורות.
- חובה גם B-tree index על כל עמודה ב-RLS USING/CHECK.
- **SPEC: 8.9**

### חוק #3 — 3-Way Handshake + Idempotency ב-Tranzila Webhooks
- Signature verification (HMAC-SHA256).
- IP allowlist ל-Tranzila.
- Direct verification API call back to Tranzila.
- `webhook_idempotency_log` table — מונע double processing.
- **SPEC: 9.7.1** (ייושם ב-Slice 4)

### חוק #4 — ICU Collation `he-IL` על שדות עברית
```sql
CREATE COLLATION he_il (provider = icu, locale = 'he-IL');
-- שימוש: name TEXT COLLATE he_il
```
- חובה על כל שדה טקסט בעברית למיון יציב.
- **SPEC: 8.8**

### חוק #5 — Materialized Views ל-Admin Dashboard מ-Day 1
- אסור לחשב KPIs ב-real-time על 24M שורות.
- Cron של refresh על MViews.
- **SPEC: 8.8.1**

---

## 4. סגנון קוד

- **TypeScript strict** — `"strict": true`, אין `any` בלי הצדקה.
- **async/await** — לא `.then()` chains.
- **Server Components by default**, Client Components רק כשצריך (`"use client"`).
- **Server Actions** לכל mutation. API Routes רק ל-webhooks.
- **RLS-first** — אין logic של "מי יכול לראות מה" ב-application layer בלבד. RLS חייב לאכוף.
- **Validation עם Zod** בכל Server Action / API Route — input + output.
- **שמות:**
  - Files: `kebab-case.ts`
  - Components: `PascalCase.tsx`
  - Functions/vars: `camelCase`
  - DB tables: `snake_case`
- **Imports מסודרים:** external → internal → relative.
- **No console.log** ב-Production code. השתמש ב-Sentry / structured logging.
- **Errors:** זרוק `Error` ספציפיים, אל תבליע (`catch {}` ריק = אסור).

---

## 5. מבנה תיקיות (פרק 9.2 ב-SPEC)

```
/app
  /(auth)           # signup, login, otp, forgot-password
  /(app)            # dashboard, practice, exam, my-content
  /(marketing)      # landing, pricing, about
  /api
    /webhooks/tranzila
  layout.tsx        # RTL root
/components
  /ui               # shadcn primitives
  /features         # feature-specific components
/lib
  /supabase
    server.ts       # createServerClient
    client.ts       # createBrowserClient
    admin.ts        # createAdminClient (service role)
  /validators       # Zod schemas
  /utils
/db
  /migrations       # SQL migrations
  /seed             # seed scripts
/types
```

---

## 6. Definition of Done — לכל Slice

לפני שאתה מודיע "סיימתי":

- [ ] קוד עובד מקומית (`pnpm dev`)
- [ ] TypeScript עובר בלי שגיאות (`pnpm tsc --noEmit`)
- [ ] ESLint עובר (`pnpm lint`)
- [ ] RLS פעיל על כל טבלה חדשה + policies תואמות חוק #2
- [ ] Migration קובץ נוצר ב-`/db/migrations`
- [ ] `DATABASE_URL` ב-Production עובר וידוא pooler
- [ ] Deploy ל-Vercel הצליח
- [ ] Screenshot של ה-feature עובד ב-Production

---

## 7. עקרונות עבודה איתי (yoav, founder, non-developer)

- **אני לא מפתח.** אל תניח שאני מבין git/npm/SQL. הסבר בקצרה כשנדרש.
- **אני אפעיל אותך דרך Claude Code Desktop.** לא אכתוב קוד ידנית.
- **אני אאשר שלב-שלב.** אל תזניק 3 slices קדימה.
- **כשאתה לא בטוח — תעצור ותשאל.** עדיף לעצור מאשר לכתוב משהו ש-PM יחזיר.
- **לא לעשות shortcuts.** אם SPEC אומר X, עושים X. גם אם זה יותר עבודה.

---

## 8. הפניה ל-SPEC המלא

ה-SPEC ב-`SPEC.md` (7,477 שורות, v1.3). הפרקים החשובים ביותר:

| פרק | נושא |
|-----|------|
| 7 | UI Specs — מה לבנות בכל מסך |
| 8 | DB Schema — טבלאות + indexes + RLS |
| 9 | API & Backend Architecture |
| 10 | Tech Stack & Environments |
| 12 | Security & Privacy |
| 19 | **Architecture Appendix — Top 5 Risks + Production Readiness** |

**בכל ספק טכני — תפתח את ה-SPEC לפני שאתה מציע פתרון.**

---

## 9. תוכנית 8 ה-Slices

| # | Slice | מה בפנים |
|---|-------|----------|
| 0 | **Setup** | Next.js + Supabase + Vercel + DB schema. (אנחנו כאן) |
| 1 | Foundation + Auth | Signup (מגדר + תאריך לידה) + Login + OTP + Onboarding + Sidebar |
| 2 | Core Practice Loop | Pre-practice → Question → 360° → Results |
| 3 | Exam Mode | 40 שאלות / 100 דקות / בלי Sidebar |
| 4 | Subscription + Payment | Tranzila + 3-way handshake + idempotency |
| 5 | המאגר שלי | Bookmarks + Notes (TipTap) + Mistakes + Feedback |
| 6 | Admin Panel | Bulk Upload + question mgmt + feedback viewer |
| 7 | Polish | Analytics + Emails + Error states + Production Readiness |

**עיקרון:** Slice N+1 מתחיל רק אחרי ש-Slice N הושלם ואושר.

---

## 10. Slice 0 — מה לעשות עכשיו

### צעד 1 — Init Next.js project
```bash
pnpm create next-app@latest lawpass --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint
cd lawpass
```

### צעד 2 — RTL setup
- `app/layout.tsx`: `<html lang="he" dir="rtl">`
- Tailwind: וידוא RTL plugin אם נדרש.

### צעד 3 — shadcn/ui init
```bash
pnpm dlx shadcn@latest init
```

### צעד 4 — Supabase client setup
- התקן: `pnpm add @supabase/supabase-js @supabase/ssr`
- צור: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`
- `.env.local` עם:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL` ← **חייב pooler.supabase.com:6543**

### צעד 5 — DB Schema (פרק 8 ב-SPEC)
צור migration ראשונית עם:
- ICU collation `he_il`
- כל הטבלאות מפרק 8 (users, profiles, chapters, subtopics, questions, attempts, sessions, subscriptions, bookmarks, notes, feedback, webhook_idempotency_log)
- RLS enabled על כולן
- Policies לפי חוק #2 (`(SELECT auth.uid())`)
- Indexes על כל עמודה ב-RLS
- Materialized views ל-admin dashboard (8.8.1)

### צעד 6 — Hello World page
`app/page.tsx` — דף פשוט: כותרת "LawPass" + status check ל-Supabase (קריאה לטבלה ריקה לוודא חיבור).

### צעד 7 — Connect to GitHub + Vercel
- `git init`, push ל-repo `lawpass` הקיים.
- Import ל-Vercel.
- Env vars ב-Vercel (זהה ל-`.env.local` חוץ מ-`DATABASE_URL` שחייב להיות pooler).
- CI guard: build script שחוסם אם `DATABASE_URL` לא pooler.

### Definition of Done של Slice 0:
- [ ] `lawpass.vercel.app` (או דומה) חי ומציג "LawPass"
- [ ] Supabase מחובר — Hello World מצליח לקרוא מה-DB
- [ ] DB schema של פרק 8 קיים, RLS פעיל, policies תואמות חוק #2
- [ ] `DATABASE_URL` בייצור מאומת pooler
- [ ] Push ל-`main` → deploy אוטומטי

---

## 11. כללי תקשורת

- **דווח אחרי כל שלב גדול** (לא אחרי כל פקודה).
- **תראה לי קוד לפני שאתה מריץ migrations הרסניים** (DROP, ALTER שמוחק נתונים).
- **כשאתה תקוע** — תגיד "תקוע על X, מה הכיוון?" במקום לנסות 5 פתרונות.
- **תיעוד shortcuts** — אם עשית workaround, תכתוב `// TODO:` עם הסבר.

בהצלחה.
