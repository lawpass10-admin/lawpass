import { cn } from "@/lib/utils";

/**
 * Landing-page section wrapper.
 *
 * Slice 16 / Decision 3 — centralizes the landing's max-width
 * (1320px per handoff `--container-landing`) and horizontal
 * padding so every section (header, hero, method, plans, faq,
 * footer) gets a consistent inner column without scattering the
 * `max-w-[1320px] mx-auto px-6` triplet across components.
 *
 * `as` lets callers swap the outer element where semantics matter
 * (e.g. <header>, <section>, <footer>). The wrapper itself stays
 * style-neutral aside from the centered column — outer sections
 * own their own background / padding.
 */
type MarketingSectionProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "header" | "footer" | "main" | "nav";
  innerClassName?: string;
};

export function MarketingSection({
  as: Tag = "section",
  className,
  innerClassName,
  children,
  ...rest
}: MarketingSectionProps) {
  return (
    <Tag className={className} {...rest}>
      <div
        className={cn(
          "mx-auto w-full max-w-[1320px] px-6",
          innerClassName
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
