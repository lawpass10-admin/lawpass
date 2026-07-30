/**
 * Slice 4.X Phase 13 — Per-chapter SVG icons for the mastery row.
 * Slice 42 — extended with 10 substantive-track icons so every
 * chapter in the live taxonomy now has a distinct glyph (vs the
 * shared BookFallbackIcon they used pre-42). All icons drawn in the
 * same monochrome stroke language: viewBox 0 0 24 24, fill="none",
 * stroke="currentColor", strokeWidths 1.4/1.6/1.8.
 *
 * Sixteen chapter codes, sixteen bespoke glyphs. The icon container
 * itself (38–42px rounded square with status- or brand-tinted bg) is
 * owned by the calling row in `mastery-card.tsx` / the practice
 * builder's chapter cards; this component only renders the inner SVG.
 *
 * Unknown chapter codes still fall back to a neutral book glyph so a
 * future chapter doesn't break rendering.
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

// =============================================================================
// Slice 42 — substantive-track icons
// =============================================================================

/** דיני חוזים וחיובים — document with a stylized signature curl. */
function ContractsIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M6 3h12v18H6z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 11h6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M9 17c1-2 2-2 3 0s2 2 3 0"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** דיני קניין — vintage door key (bow + shaft + two teeth). */
function PropertyIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <circle
        cx={8}
        cy={12}
        r={3.5}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M11.5 12h9"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M17 12v3M20 12v2"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** דיני עונשין — handcuffs (two linked rings + small attachment loops). */
function CriminalSubstantiveIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <circle
        cx={6.5}
        cy={15.5}
        r={4}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <circle
        cx={17.5}
        cy={15.5}
        r={4}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M10.5 14.5h3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M5 12L3 9M19 12l2-3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** דיני תאגידים — office building with a grid of windows + doorway. */
function CorporateIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M5 21V5h14v16M3 21h18"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M8 8.5h2M14 8.5h2M8 12h2M14 12h2M8 15.5h2M14 15.5h2"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M10 21v-3h4v3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** דיני עבודה — briefcase (body + handle + center divider). */
function LaborIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M4 9c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V9z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 7V5c0-.5.5-1 1-1h4c.5 0 1 .5 1 1v2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M4 13h16"
        stroke="currentColor"
        strokeWidth={1.4}
      />
    </svg>
  );
}

/** דיני משפחה וירושה — two-adults silhouette (heads + body arcs). */
function FamilyInheritanceIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <circle
        cx={8}
        cy={7.5}
        r={2.5}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <circle
        cx={16}
        cy={7.5}
        r={2.5}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M3 20v-1.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5V20"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M11 20v-1.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5V20"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** משפט מנהלי — small government building with a flag. */
function AdministrativeIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M4 21h16"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M6 21V9h10v12"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 13.5h2M9 17h2M13 13.5h0.5M13 17h0.5"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M11 9V3.5"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M11 3.5l4 1.5-4 1.5"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** דיני מסים — stacked coins (3 tiers, ellipse top + side curves). */
function TaxIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <ellipse
        cx={12}
        cy={6}
        rx={6.5}
        ry={2}
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M5.5 6v3c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2V6"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M5.5 11v3c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2v-3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path
        d="M5.5 16v2c0 1.1 2.9 2 6.5 2s6.5-.9 6.5-2v-2"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** אתיקה מקצועית — shield with a checkmark (ethics / compliance). */
function EthicsIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M12 3l8 3v6c0 4.5-3.5 7.5-8 8.5-4.5-1-8-4-8-8.5V6z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** דיני נזיקין — warning triangle with exclamation (harm / liability). */
function TortsIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path
        d="M12 3.5L2.5 20.5h19z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M12 17.5v0"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
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
  // Procedural track (the original 6 — unchanged since Slice 4.X).
  civil_proc: CourthouseIcon,
  criminal_proc: GavelIcon,
  evidence: MagnifierCheckIcon,
  execution: DocumentIcon,
  insolvency_arbitration: ScalesIcon,
  constitutional_intl: GlobeIcon,
  // Substantive track (Slice 42 — added so each chapter has its own
  // glyph rather than falling to BookFallbackIcon).
  contracts: ContractsIcon,
  property: PropertyIcon,
  criminal_substantive: CriminalSubstantiveIcon,
  corporate: CorporateIcon,
  labor: LaborIcon,
  family_inheritance: FamilyInheritanceIcon,
  administrative: AdministrativeIcon,
  tax: TaxIcon,
  ethics: EthicsIcon,
  torts: TortsIcon,
};

export function ChapterIcon({ code }: { code: string }) {
  const Icon = ICON_BY_CODE[code] ?? BookFallbackIcon;
  return <Icon />;
}
