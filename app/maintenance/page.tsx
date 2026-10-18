import Image from "next/image";

/**
 * /maintenance — what everyone except an admin sees while the app is locked.
 *
 * Reached only by a redirect from proxy.ts, which sends anyone here when
 * `app_settings.login_locked` is true and they are not an admin. Listed in
 * that file's PUBLIC_PATHS and LOCKDOWN_ALLOWED_PATHS, or the redirect loops.
 *
 * NO GATE OF ITS OWN and no database read: the one page that must render when
 * everything else is refusing to is not the page to make conditional. A user
 * who reaches it while the app is open simply sees a maintenance notice,
 * which is a far cheaper mistake than a redirect loop.
 *
 * `force-dynamic` so it is never served from a cache that outlives the
 * maintenance window.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "LawPass — בתחזוקה",
  // Keep it out of search results; this is a temporary state, not a page.
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--color-navy-deep, #16233f)" }}
    >
      <Image
        src="/lawpass-logo-v4.png"
        alt="LawPass"
        width={180}
        height={60}
        priority
        className="mb-8 h-auto w-[180px] object-contain"
      />

      <h1 className="font-heebo text-2xl font-extrabold text-white sm:text-3xl">
        המערכת בתחזוקה כרגע
      </h1>

      <p className="mt-3 max-w-md font-heebo text-base leading-relaxed text-white/75">
        אנחנו מבצעים עבודות תחזוקה קצרות. נסו שוב בעוד מעט — החשבון שלכם
        וכל ההתקדמות שלכם שמורים.
      </p>

      <p className="mt-8 font-heebo text-sm text-white/55">
        לשאלות דחופות אפשר לפנות אלינו בוואטסאפ{" "}
        {/* bdi: a Latin/digit run inside RTL text otherwise renders with the
            leading digit at the wrong end.
            whitespace-nowrap: at 375px it was breaking as "054-" / "2040110",
            which is both unreadable and un-tappable.
            A wa.me link, not tel: — this is the WhatsApp number from the SMS
            campaign, and contacting them is the only thing this page offers. */}
        <a
          href="https://wa.me/972542040110"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#C9A149] underline-offset-4 hover:underline"
        >
          <bdi className="whitespace-nowrap">054-2040110</bdi>
        </a>
      </p>
    </main>
  );
}
