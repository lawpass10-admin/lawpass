import type { Metadata } from "next";
import Image from "next/image";

import { EarlyAccessForm } from "./_components/early-access-form";

/**
 * /early-access — Slice 43 waitlist email-capture page.
 *
 * Public, bare, indexable-NO. The landing CTAs (hero primary + plan 3mo + plan
 * 6mo, to be wired in the landing rebuild slice) point at this URL with
 * `?source=hero|plan-3mo|plan-6mo`. Direct visits have no source.
 *
 * Intentionally NOT wrapped in the marketing header/footer chrome — this is
 * the funnel destination, not a content page. The page renders just the logo,
 * a headline, a sub-line, and the form.
 *
 * `searchParams.source` flows through to `<EarlyAccessForm>` as a hidden
 * payload sent to the server action, NOT placed on a URL or form-element
 * attribute that would round-trip back. Single-shot funnel attribution.
 *
 * No auth gate — public path. `noindex,nofollow` keeps it out of search so
 * `/early-access` doesn't compete with the landing for the same intent.
 */
export const metadata: Metadata = {
  title: "LawPass — הצטרפו לרשימת ההמתנה",
  description: "אנחנו פותחים גישה בהדרגה. השאירו אימייל ונעדכן אתכם ראשונים.",
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

type SearchParams = Promise<{ source?: string | string[] }>;

function firstString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolved = (await searchParams) ?? {};
  const source = firstString(resolved.source);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
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

      <h1
        className="font-heebo mt-10 text-3xl font-extrabold sm:text-4xl"
        style={{ color: "rgba(255,255,255,0.96)" }}
      >
        אנחנו פותחים גישה בהדרגה.
      </h1>

      <p
        className="font-heebo mt-4 max-w-md text-base leading-relaxed sm:text-lg"
        style={{ color: "rgba(255,255,255,0.72)" }}
      >
        השאירו אימייל ונעדכן אתכם ראשונים.
      </p>

      {/* The form takes its full width up to ~440px so the input + button row
          stays comfortable on mobile and doesn't stretch beyond the headline
          column on desktop. */}
      <div className="mt-10 w-full max-w-md">
        <EarlyAccessForm source={source} />
      </div>
    </main>
  );
}
