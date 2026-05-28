/**
 * Slice 13 — closed list of academic institutions for the onboarding
 * "מוסד אקדמי" dropdown.
 *
 * Mirrors the lib/billing/plans.ts convention: a typed readonly array
 * + a string-union type + a type-narrowing predicate. The dropdown
 * stores the stable `id` in profiles.academic_institution; the form
 * + admin user-detail render the `label` for the user.
 *
 * Ids are lowercase ASCII snake_case so they're URL/log/SQL-safe and
 * stable across future label edits. Adding a new institution =
 * append a new entry + add the id to the zod enum in
 * lib/validators/auth.ts (no DB CHECK constraint to migrate).
 */

export type Institution = {
  /** Stable storage id. Persisted in profiles.academic_institution. */
  id: string;
  /** Hebrew display label rendered in the form + admin user-detail. */
  label: string;
};

export const ACADEMIC_INSTITUTIONS: readonly Institution[] = [
  { id: "hebrew_university", label: "האוניברסיטה העברית בירושלים" },
  { id: "tel_aviv_university", label: "אוניברסיטת תל-אביב" },
  { id: "bar_ilan_university", label: "אוניברסיטת בר-אילן" },
  { id: "haifa_university", label: "אוניברסיטת חיפה" },
  { id: "reichman_university", label: "אוניברסיטת רייכמן" },
  { id: "college_of_management", label: "המסלול האקדמי המכללה למינהל" },
  { id: "ono_academic_college", label: "הקריה האקדמית אונו" },
  { id: "law_and_business", label: "המרכז האקדמי למשפט ולעסקים" },
  { id: "shaarei_mada_umishpat", label: "המרכז האקדמי שערי מדע ומשפט" },
  { id: "peres_academic_center", label: "המרכז האקדמי פרס" },
  { id: "netanya_academic", label: "המכללה האקדמית נתניה" },
  { id: "sapir_college", label: "המכללה האקדמית ספיר" },
  { id: "safed_academic", label: "המכללה האקדמית צפת" },
  { id: "other", label: "אחר" },
] as const;

/** Tuple-of-ids — fed to zod.enum to keep the validator literal-narrow
 *  without redeclaring the strings. */
export const ACADEMIC_INSTITUTION_IDS = ACADEMIC_INSTITUTIONS.map(
  (i) => i.id
) as readonly Institution["id"][] as [string, ...string[]];

export type AcademicInstitution = (typeof ACADEMIC_INSTITUTIONS)[number]["id"];

/** Type-narrowing predicate for unknown input (URL params, untrusted
 *  metadata reads, etc.). Returns true iff the input matches one of
 *  the canonical ids. */
export function isValidAcademicInstitution(
  v: unknown
): v is AcademicInstitution {
  if (typeof v !== "string") return false;
  return ACADEMIC_INSTITUTIONS.some((i) => i.id === v);
}

/** id → Hebrew label, or null when the id isn't in the list. Used by
 *  the admin user-detail page to display the stored id as the label
 *  the operator can read. */
export function getAcademicInstitutionLabel(
  id: string | null | undefined
): string | null {
  if (!id) return null;
  return ACADEMIC_INSTITUTIONS.find((i) => i.id === id)?.label ?? null;
}
