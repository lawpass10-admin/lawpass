import type { Metadata } from "next";
import { Assistant, Heebo } from "next/font/google";
import { cookies } from "next/headers";

import { A11yWidget } from "@/app/_components/a11y-widget";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildHtmlClassString, readPrefs } from "@/lib/a11y/cookie";
import { cn } from "@/lib/utils";

import "./globals.css";

// Slice 4.X Phase 10a — dual-font setup per design handoff.
// Heebo for headings (400-900, the prototype uses 800 for h1 + 500 for
// eyebrow; full range loaded so any future heading variant resolves).
// Assistant for body (300-700). Both are exposed as CSS variables and
// can be referenced via Tailwind utilities (`font-sans` → Assistant,
// `font-heebo` → Heebo via `--font-heebo`).
const assistant = Assistant({
  variable: "--font-sans",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  // Slice 46 — added 300 so the landing's hero subline (weight: 300 in the
  // design CSS) renders at its intended thinness. The rest of the app
  // continues to use 400/500/600/700/800/900 unchanged.
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LawPass",
  description: "Israeli Bar Exam Preparation Platform",
};

/**
 * Slice 51 — async root layout for the accessibility-widget cookie pattern.
 *
 * Per Gemini Deep Research §"Persistence and Next.js 16 SSR Hydration
 * Strategies", a11y prefs MUST live in a cookie (not localStorage) so the
 * server can read them BEFORE rendering HTML and inject the matching
 * `lp-a11y-*` classes on `<html>` / `<body>` for a FOUC-free first paint.
 *
 * Layering:
 *   - `cookies()` from `next/headers` is async; the layout is now async
 *     (verified no client-only assumptions during Slice-51 discovery).
 *   - `buildHtmlClassString` emits typography classes (`text-l`, `text-xl`)
 *     for `<html>` (so `font-size: 125%` etc. cascade through `rem`-sized
 *     children), and contrast / font / line / motion classes for `<body>`
 *     (so `:not(.a11yWidget *)` selectors can land at the page-content
 *     level). The CSS module enforces which class belongs on which
 *     element; here we just split by key.
 *   - `<A11yWidget initialPrefs={...}>` mounts AFTER the toaster so its
 *     React-Portal target (`document.body`) exists by the time the
 *     client island runs.
 */

const HTML_CLASS_KEYS = new Set(["text-l", "text-xl"]);

function splitClasses(full: string): { html: string; body: string } {
  if (!full) return { html: "", body: "" };
  const tokens = full.split(" ");
  const htmlClasses: string[] = [];
  const bodyClasses: string[] = [];
  for (const tok of tokens) {
    const key = tok.replace(/^lp-a11y-/, "");
    if (HTML_CLASS_KEYS.has(key)) htmlClasses.push(tok);
    else bodyClasses.push(tok);
  }
  return { html: htmlClasses.join(" "), body: bodyClasses.join(" ") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const a11yPrefs = readPrefs(cookieStore);
  const a11yClassString = buildHtmlClassString(a11yPrefs);
  const { html: htmlA11yClasses, body: bodyA11yClasses } =
    splitClasses(a11yClassString);

  return (
    <html
      lang="he"
      dir="rtl"
      className={cn(
        "h-full antialiased",
        assistant.variable,
        heebo.variable,
        htmlA11yClasses
      )}
    >
      <body className={cn("min-h-full flex flex-col font-sans", bodyA11yClasses)}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <A11yWidget initialPrefs={a11yPrefs} />
      </body>
    </html>
  );
}
