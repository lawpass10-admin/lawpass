import Link from "next/link";

/**
 * Shared site footer used by /(auth)/layout.tsx and the /pricing screen.
 *
 * Extracted from (auth)/layout.tsx in Phase 6 commit 2. The links currently
 * point at "#" placeholders — SPEC mentions תקנון / פרטיות / צרו קשר as
 * required pages but they're not implemented yet (later-slice work).
 */
export function SiteFooter() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p>
        © LawPass 2026 ·{" "}
        <Link href="#" className="hover:text-foreground hover:underline">
          תקנון
        </Link>{" "}
        ·{" "}
        <Link href="#" className="hover:text-foreground hover:underline">
          פרטיות
        </Link>{" "}
        ·{" "}
        <Link href="#" className="hover:text-foreground hover:underline">
          צרו קשר
        </Link>
      </p>
    </footer>
  );
}
