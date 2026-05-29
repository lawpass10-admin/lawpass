"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  FAQ_EYEBROW,
  FAQ_ITEMS,
  FAQ_QUOTE_SUBTITLE,
  FAQ_QUOTE_TITLE,
} from "./landing-copy";
import { MarketingSection } from "./marketing-section";

/**
 * Slice 16 / Phase L6 — schema.org FAQPage JSON-LD.
 *
 * Stringified once at module load (FAQ_ITEMS is a `readonly` const)
 * so we don't pay JSON.stringify on every accordion click. The
 * markup lives inside the section because crawlers read it from the
 * SSR HTML; React's Client/Server boundary doesn't matter to Google.
 *
 * Listed before the JSX so the structured data sits at the top of
 * the section's DOM — easier for tools like Rich Results Test to
 * pick up.
 */
const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
});

/**
 * FAQ section — left column with the character portrait + quote
 * bubble, right column with a single-open accordion.
 *
 * Slice 16 / Phase L3. Click on a closed item to open it; clicking
 * the open one toggles it shut (so the state can land on "all
 * closed"). The grid-template-rows 0fr ↔ 1fr trick gives a
 * smoothly animatable height without measuring DOM.
 *
 * Character image: 600px wide source (`/landing/faq-character.png`),
 * compressed during the L3 build (sips -Z 600). Surrounded by a
 * dashed gold ring that rotates infinitely (`.faq-ring-rotate`,
 * see app/globals.css; disabled under prefers-reduced-motion).
 *
 * Slice 16 / Phase L6 — emits a schema.org FAQPage JSON-LD block
 * alongside the accordion for Google rich-results eligibility.
 */
export function LandingFaq() {
  // -1 = nothing open. The "single-open" rule is enforced by setting
  // `open` to a single index rather than tracking an array of bools.
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="bg-white py-20 md:py-28">
      {/*
        FAQPage structured data — emitted server-side via SSR so
        crawlers find it on first render. dangerouslySetInnerHTML
        is required because React would otherwise HTML-escape the
        JSON braces, breaking the schema validator.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }}
      />
      <MarketingSection
        as="div"
        innerClassName="px-4 grid grid-cols-1 items-start gap-x-20 gap-y-12 md:px-8 lg:grid-cols-[1fr_1.2fr]"
      >
        {/* Left column — heading + character */}
        <div className="relative">
          <div className="mb-10">
            <div className="mb-[22px] inline-flex items-center gap-3 text-sm font-medium tracking-[0.01em] text-[var(--color-gold-deep)]">
              <span
                aria-hidden="true"
                className="block h-[1.5px] w-7 shrink-0 bg-[var(--color-gold)]"
              />
              <span>{FAQ_EYEBROW}</span>
            </div>
            <h2 className="font-extrabold leading-[1.08] tracking-[-0.01em] text-[clamp(36px,4vw,56px)] text-[var(--color-navy-ink)]">
              כל מה שרציתם לדעת,{" "}
              <span className="text-[var(--color-gold-deep)]">
                לפני שנכנסים.
              </span>
            </h2>
          </div>

          {/* Character block: square aspect, max-w-[420px] caps it
              on large screens; mx-auto centers it on mobile so the
              quote bubble (positioned at inset-inline-end: -40 on
              desktop, but clamped to 0 on mobile via the Tailwind
              breakpoint below) doesn't overflow the viewport. */}
          <div className="relative mx-auto mt-10 aspect-square w-full max-w-[420px]">
            {/* Rotating dashed ring (24s loop) */}
            <div
              aria-hidden="true"
              className="faq-ring-rotate absolute rounded-full border-[1.5px] border-dashed"
              style={{
                inset: -14,
                borderColor: "rgba(201, 161, 73, 0.5)",
              }}
            />
            {/* Tinted circle backing the portrait */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(30, 58, 138, 0.07), rgba(30, 58, 138, 0.02) 70%, transparent 80%), linear-gradient(135deg, #F5F1E4 0%, #FAF7EC 60%, #F0EAD5 100%)",
                boxShadow: "inset 0 -20px 60px rgba(201, 161, 73, 0.10)",
              }}
            >
              <Image
                src="/landing/faq-character.png"
                alt="ד״ר שרון נאור"
                width={600}
                height={900}
                className="absolute inset-0 block h-[110%] w-full object-cover object-top"
                style={{
                  filter: "drop-shadow(0 10px 20px rgba(15, 31, 79, 0.10))",
                }}
              />
              {/* Inner gold hairline ring */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full border"
                style={{
                  inset: 6,
                  borderColor: "rgba(201, 161, 73, 0.25)",
                }}
              />
            </div>

            {/* Quote bubble.
                Mobile (<768px): bubble sits at inset-inline-end: 0 so
                it stays inside the character square — preventing a
                horizontal-scroll trigger on 375/390px viewports.
                md+: restores the prototype's -40 outward overhang. */}
            <div
              className="absolute bottom-6 max-w-[280px] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white px-[22px] pb-4 pt-[18px] shadow-[var(--shadow-md)] end-0 md:end-[-40px]"
            >
              <div
                aria-hidden="true"
                className="absolute top-[-14px] flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-gold)] text-2xl font-bold leading-none text-[var(--color-navy-ink)]"
                style={{ insetInlineStart: 20 }}
              >
                ״
              </div>
              <div className="text-[16px] font-bold leading-[1.3] text-[var(--color-navy-ink)]">
                {FAQ_QUOTE_TITLE}
              </div>
              <div className="mt-1.5 text-[13.5px] font-normal leading-[1.45] text-[var(--ink-3)]">
                {FAQ_QUOTE_SUBTITLE}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — accordion */}
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={cn(
                  "overflow-hidden rounded-[var(--radius-card)] border transition-[border-color,background] duration-200",
                  isOpen
                    ? "border-[var(--color-navy)] bg-white shadow-[var(--shadow-sm)]"
                    : "border-[var(--color-line)] bg-[var(--color-paper)]"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 border-none bg-transparent px-7 py-6 text-start text-[17px] font-semibold text-[var(--color-navy-ink)]"
                >
                  <span className="relative flex-1 pb-1">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-[-2px] h-0.5 rounded-sm transition-[background,width] duration-200",
                        isOpen
                          ? "w-[52px] bg-[var(--color-gold)]"
                          : "w-[38px] bg-[rgba(201,161,73,0.55)]"
                      )}
                      style={{ insetInlineStart: 0 }}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background,color,border-color] duration-300",
                      isOpen
                        ? "rotate-180 border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-navy-ink)]"
                        : "border-[var(--color-line)] bg-white text-[var(--color-navy)]"
                    )}
                  >
                    <svg viewBox="0 0 20 20" width="16" height="16">
                      <path
                        d="M5 8l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {/* Animatable height: grid-template-rows 0fr → 1fr */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div
                    className={cn(
                      "overflow-hidden text-[15.5px] leading-[1.65] text-[var(--ink-3)]",
                      isOpen ? "px-7 pb-6" : "px-7"
                    )}
                  >
                    {item.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </MarketingSection>
    </section>
  );
}
