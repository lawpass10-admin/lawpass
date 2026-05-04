import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
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
    </div>
  );
}
