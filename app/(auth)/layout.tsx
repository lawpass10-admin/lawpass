import Image from "next/image";
import Link from "next/link";

/**
 * The frame every auth screen sits in — login, signup, verify-email,
 * forgot-password, reset-password, complete-profile.
 *
 * Branded to match the landing page rather than to the app's paper-and-navy
 * interior: deep navy ground, the landing logo, and a gold hairline over a
 * near-white card. Someone arriving from a landing CTA should not feel the
 * design change under them at the moment they are deciding whether to trust
 * the product with an address and a password.
 *
 * The shell lives in the LAYOUT, not in each form, so the six screens are
 * branded once and cannot drift apart. The forms below it render a plain
 * <Card>, which the `[&_[data-slot=card]]` rules here restyle in place — no
 * form had to be rewritten to get the new look, and a screen added later gets
 * it for free.
 *
 * Contrast: all body text stays on the light card. The navy carries the logo
 * and the footer only, both of which are given explicit light colours here
 * rather than inheriting the app's muted-foreground (which is tuned for a
 * light ground and would read as grey-on-navy).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{
        // A single soft navy wash rather than a flat fill: the lighter band
        // behind the card lifts it off the ground without a heavy shadow.
        background:
          "radial-gradient(120% 80% at 50% 0%, var(--color-navy) 0%, var(--color-navy-deep) 45%, var(--color-navy-ink) 100%)",
      }}
    >
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14"
      >
        <Link href="/" aria-label="LawPass — לדף הבית">
          <Image
            src="/landing/lawpass-logo-landing.png"
            alt="LawPass"
            width={195}
            height={113}
            priority
            className="mb-8 block h-[clamp(56px,7vw,80px)] w-auto"
          />
        </Link>

        {/*
          The card restyle. Written as descendant rules on the shell instead of
          as props on each <Card> so that login, signup and the four password
          screens are covered by one declaration:
            - a light paper surface (the forms' labels and inputs are built for
              a light ground, and inverting them would mean touching all six);
            - a gold hairline along the top edge, the landing's accent;
            - a deep, wide shadow so the card reads as floating on the navy.
        */}
        <div
          className={[
            "w-full max-w-md",
            "[&_[data-slot=card]]:relative [&_[data-slot=card]]:overflow-hidden",
            "[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-0",
            "[&_[data-slot=card]]:bg-[var(--color-paper)]",
            "[&_[data-slot=card]]:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]",
            // The gold rule. A pseudo-element on the card itself, so it hugs
            // the rounded corners instead of being a separate stacked div.
            "[&_[data-slot=card]]:before:absolute [&_[data-slot=card]]:before:inset-x-0",
            "[&_[data-slot=card]]:before:top-0 [&_[data-slot=card]]:before:h-1",
            "[&_[data-slot=card]]:before:bg-[linear-gradient(90deg,var(--color-gold-deep),var(--color-gold),var(--color-gold-deep))]",
            "[&_[data-slot=card]]:before:content-['']",
            // The heading sits directly under the rule and carries the navy.
            "[&_[data-slot=card-title]]:font-heebo",
            "[&_[data-slot=card-title]]:text-[22px]",
            "[&_[data-slot=card-title]]:font-extrabold",
            "[&_[data-slot=card-title]]:tracking-tight",
            "[&_[data-slot=card-title]]:text-[var(--color-navy-ink)]",
          ].join(" ")}
        >
          {children}
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}

/**
 * The site footer, in the light-on-navy colours this shell needs.
 *
 * A copy of components/shared/site-footer.tsx rather than a prop on it: that
 * component is also used by /pricing, on a light ground, and giving it a
 * variant for one caller is more moving parts than eleven words of markup.
 */
function AuthFooter() {
  const linkClass = "transition-colors hover:text-[var(--color-gold)]";

  return (
    <footer
      className="border-t py-6 text-center text-sm"
      style={{
        borderColor: "rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.66)",
      }}
    >
      <p>
        © LawPass 2026 ·{" "}
        <Link href="#" className={linkClass}>
          תקנון
        </Link>{" "}
        ·{" "}
        <Link href="#" className={linkClass}>
          פרטיות
        </Link>{" "}
        ·{" "}
        <Link href="#" className={linkClass}>
          צרו קשר
        </Link>
      </p>
    </footer>
  );
}
