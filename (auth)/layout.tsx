import { SiteFooter } from "@/components/shared/site-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Slice 51 — id="main-content" added so the a11y widget's universal
          skip-link target exists on /login + /signup + /reset-* etc.
          Previously only the landing + legal pages had this id. */}
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
