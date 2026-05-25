import type { Metadata } from "next";
import { Assistant, Heebo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LawPass",
  description: "Israeli Bar Exam Preparation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={cn("h-full antialiased", assistant.variable, heebo.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
