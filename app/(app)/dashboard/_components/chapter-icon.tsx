/**
 * Slice 4.X Phase 13 — Per-chapter SVG icons for the mastery row.
 *
 * Six fixed chapter codes, six bespoke glyphs (courthouse / gavel /
 * magnifier / document / scales / globe) drawn straight from the
 * handoff prototype. The icon container itself (38×38 rounded square
 * with status-tinted bg) is owned by the row in `mastery-card.tsx`;
 * this component only renders the inner SVG.
 *
 * Unknown chapter codes fall back to a neutral book glyph so a future
 * chapter doesn't break rendering.
 */

const COMMON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
  className: "size-5",
};

function CourthouseIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M4 20h16M5 20V10l7-5 7 5v10"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M8 20v-6h8v6M10 14v6M14 14v6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M14 4l6 6M16 6l-9 9-3 4 4-3 9-9z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M4 21h8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MagnifierCheckIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <circle cx={10.5} cy={10.5} r={6} stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M20 20l-4.5-4.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M8 10.5l2 2 3-3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M6 3h9l4 4v14H6z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M15 3v4h4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6M9 15h6M9 18h4"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScalesIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M12 3v18M5 18h14"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M5 8l-2 5h4z M12 5l-2 5h4z M19 8l-2 5h4z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path
        d="M7 6l5-2 5 2"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.6} />
      <ellipse cx={12} cy={12} rx={4} ry={9} stroke="currentColor" strokeWidth={1.4} />
      <path d="M3 12h18" stroke="currentColor" strokeWidth={1.4} />
    </svg>
  );
}

function BookFallbackIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M5 4h11a3 3 0 013 3v13H7a2 2 0 01-2-2V4z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M5 18h14" stroke="currentColor" strokeWidth={1.4} />
    </svg>
  );
}

const ICON_BY_CODE: Record<string, () => React.JSX.Element> = {
  civil_proc: CourthouseIcon,
  criminal_proc: GavelIcon,
  evidence: MagnifierCheckIcon,
  execution: DocumentIcon,
  insolvency_arbitration: ScalesIcon,
  constitutional_intl: GlobeIcon,
};

export function ChapterIcon({ code }: { code: string }) {
  const Icon = ICON_BY_CODE[code] ?? BookFallbackIcon;
  return <Icon />;
}
