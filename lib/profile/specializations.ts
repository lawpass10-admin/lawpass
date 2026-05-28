/**
 * Slice 13 — closed list of legal specializations for the onboarding
 * "תחום התמחות" dropdown.
 *
 * Same shape as ACADEMIC_INSTITUTIONS — see lib/profile/institutions.ts
 * for the rationale on id stability + storage.
 */

export type Specialization = {
  /** Stable storage id. Persisted in profiles.legal_specialization. */
  id: string;
  /** Hebrew display label rendered in the form + admin user-detail. */
  label: string;
};

export const LEGAL_SPECIALIZATIONS: readonly Specialization[] = [
  { id: "commercial_corporate", label: "מסחרי ותאגידים" },
  { id: "civil_litigation", label: "ליטיגציה אזרחית" },
  { id: "real_estate", label: 'נדל"ן ומקרקעין' },
  { id: "criminal_law", label: "משפט פלילי" },
  { id: "labor_law", label: "דיני עבודה" },
  { id: "family_law", label: "דיני משפחה" },
  { id: "torts_insurance", label: "נזיקין וביטוח" },
  { id: "hightech", label: "הייטק וטכנולוגיה" },
  { id: "administrative_public", label: "משפט מנהלי וציבורי" },
  { id: "tax_law", label: "דיני מיסים" },
  { id: "intellectual_property", label: "קניין רוחני" },
  { id: "white_collar", label: "צווארון לבן" },
  { id: "capital_markets", label: "שוק ההון" },
  { id: "other_undecided", label: "אחר / טרם נקבע" },
] as const;

/** Tuple-of-ids — fed to zod.enum to keep the validator literal-narrow
 *  without redeclaring the strings. */
export const LEGAL_SPECIALIZATION_IDS = LEGAL_SPECIALIZATIONS.map(
  (s) => s.id
) as readonly Specialization["id"][] as [string, ...string[]];

export type LegalSpecialization =
  (typeof LEGAL_SPECIALIZATIONS)[number]["id"];

/** Type-narrowing predicate for unknown input. */
export function isValidLegalSpecialization(
  v: unknown
): v is LegalSpecialization {
  if (typeof v !== "string") return false;
  return LEGAL_SPECIALIZATIONS.some((s) => s.id === v);
}

/** id → Hebrew label, or null when the id isn't in the list. */
export function getLegalSpecializationLabel(
  id: string | null | undefined
): string | null {
  if (!id) return null;
  return LEGAL_SPECIALIZATIONS.find((s) => s.id === id)?.label ?? null;
}
