"use strict";

// Id lists mirrored from ../../lib/profile/institutions.ts and
// ../../lib/profile/specializations.ts. Only the stable ids are needed
// server-side (the Hebrew labels are a frontend concern). Keep these in
// sync when the frontend lists change.

const ACADEMIC_INSTITUTION_IDS = [
  "hebrew_university",
  "tel_aviv_university",
  "bar_ilan_university",
  "haifa_university",
  "reichman_university",
  "college_of_management",
  "ono_academic_college",
  "law_and_business",
  "shaarei_mada_umishpat",
  "peres_academic_center",
  "netanya_academic",
  "sapir_college",
  "safed_academic",
  "other",
];

const LEGAL_SPECIALIZATION_IDS = [
  "commercial_corporate",
  "civil_litigation",
  "real_estate",
  "criminal_law",
  "labor_law",
  "family_law",
  "torts_insurance",
  "hightech",
  "administrative_public",
  "tax_law",
  "intellectual_property",
  "white_collar",
  "capital_markets",
  "other_undecided",
];

// Subscription plan ids (from ../../lib/billing/plans.ts).
function isValidPlanId(id) {
  return id === "plan_3m" || id === "plan_6m";
}

module.exports = {
  ACADEMIC_INSTITUTION_IDS,
  LEGAL_SPECIALIZATION_IDS,
  isValidPlanId,
};
