import Link from "next/link";

import { DraftsList } from "./_components/drafts-list";

/**
 * /drafts — הטיוטות שלי: every scratch page the candidate has saved.
 *
 * The shell is a Server Component; the list fetches itself on the client,
 * because it reads through the Express API with the browser's Supabase bearer
 * token (lib/api/drafts.ts). That is the opposite arrangement from
 * /exam-archive, which reads server-side — the difference is that archive
 * entries need tables a student cannot read directly, and a draft is a row the
 * student owns and RLS already scopes to them.
 *
 * NO requireActiveSubscription(), unlike every other (app) page. Drafts are the
 * student's own writing: the save path refuses to gate it, and a reader that
 * gated would let someone write notes they are not allowed to read back.
 * /drafts is listed in the layout's SUBSCRIPTION_EXEMPT_PREFIXES for the same
 * reason — without that, the layout would bounce a lapsed student to /pricing
 * before this page ever ran.
 */
export default function DraftsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <nav className="flex items-center gap-2 font-heebo text-sm" aria-label="פירורי לחם">
          <Link href="/dashboard" className="hover:underline" style={{ color: "var(--color-gold-deep)" }}>
            דשבורד
          </Link>
          <span aria-hidden style={{ color: "var(--color-ink-muted)" }}>
            ›
          </span>
          <span style={{ color: "var(--color-ink-dim)" }}>הטיוטות שלי</span>
        </nav>
        <h1
          className="font-heebo font-extrabold tracking-tight"
          style={{ fontSize: "clamp(24px, 2.1vw, 32px)", color: "var(--color-navy-ink)", lineHeight: 1.15 }}
        >
          הטיוטות שלי
        </h1>
        <p className="font-heebo" style={{ fontSize: 15, color: "var(--color-ink-dim)" }}>
          כל מה ששמרת בדף הטיוטה, מהחדש לישן. הכותרת היא המשפט הראשון של הטיוטה.
        </p>
      </header>

      <DraftsList />
    </div>
  );
}
