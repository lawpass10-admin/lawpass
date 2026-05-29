import Image from "next/image";

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

      <div className="mt-10 inline-flex items-center gap-3 text-sm text-white/55">
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
