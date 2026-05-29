import Image from "next/image";
import Link from "next/link";

/**
 * Temporary "האתר בהקמה" screen.
 *
 * Wired into app/(marketing)/page.tsx in place of the full landing
 * while a client is reviewing the design offline (see
 * LawPass-לעיון.html in the repo root). All landing-* components
 * stay in the repo and are unchanged — they're just not rendered.
 *
 * To restore the landing, revert the commit that wired this in:
 *
 *     git revert <coming-soon-commit-sha>
 *     git push origin main
 *
 * Vercel will rebuild + redeploy in ~2-3 minutes.
 *
 * Brand: navy-ink background, gold separator. No nav, no CTAs, no
 * analytics. The Hebrew copy is small + direct — anonymous visitors
 * to law-pass.com should see this and understand the site isn't
 * down, it's just paused.
 */
export function ComingSoon() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center"
      style={{ backgroundColor: "var(--color-navy-ink)" }}
    >
      <Image
        src="/landing/lawpass-logo-landing.png"
        alt="LawPass"
        width={195}
        height={113}
        priority
        className="block h-[clamp(64px,8vw,96px)] w-auto"
      />

      <h1 className="mt-10 text-3xl font-extrabold text-white sm:text-4xl">
        האתר בהקמה.
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
        נשוב בקרוב עם פלטפורמת ההכנה למבחני ההסמכה של לשכת עורכי הדין.
      </p>

      {/*
        Auth CTAs. The landing is paused but /signup + /login stay
        functional under the proxy (PUBLIC_PATHS), so users who
        already have an account or want to register early can still
        reach the auth flow. Both styled to match the landing's
        primary/ghost pattern — gold pill for the brighter action,
        white outline for the secondary.
      */}
      <div className="mt-10 flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-md sm:flex-row sm:justify-center">
        <Link
          href="/signup"
          className="inline-flex h-12 items-center justify-center rounded-full px-7 text-base font-bold transition-[filter,transform] duration-200 hover:brightness-105 hover:-translate-y-0.5 sm:h-11"
          style={{
            background:
              "linear-gradient(135deg, #E8C97A 0%, #D4AC57 55%, #C9A149 100%)",
            color: "var(--color-navy-ink)",
            boxShadow:
              "0 8px 22px -8px rgba(201, 161, 73, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
          }}
        >
          הרשמה
        </Link>
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-7 text-base font-semibold text-white transition-colors duration-200 hover:border-white/60 hover:bg-white/5 sm:h-11"
        >
          התחברות
        </Link>
      </div>

      <div className="mt-8 inline-flex items-center gap-3 text-sm text-white/55">
        <span
          aria-hidden="true"
          className="block h-px w-8"
          style={{ backgroundColor: "var(--color-gold)" }}
        />
        <span>נשמע ממך בקרוב</span>
      </div>
    </div>
  );
}
