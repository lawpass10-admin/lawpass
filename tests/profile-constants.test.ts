import { describe, expect, it } from "vitest";

import {
  ACADEMIC_INSTITUTIONS,
  getAcademicInstitutionLabel,
  isValidAcademicInstitution,
} from "@/lib/profile/institutions";
import {
  LEGAL_SPECIALIZATIONS,
  getLegalSpecializationLabel,
  isValidLegalSpecialization,
} from "@/lib/profile/specializations";

describe("ACADEMIC_INSTITUTIONS", () => {
  it("has exactly 14 entries (13 institutions + 'אחר')", () => {
    expect(ACADEMIC_INSTITUTIONS.length).toBe(14);
  });

  it("every id is unique", () => {
    const ids = ACADEMIC_INSTITUTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty Hebrew label", () => {
    for (const inst of ACADEMIC_INSTITUTIONS) {
      expect(inst.label.length).toBeGreaterThan(0);
    }
  });

  it("includes the 'אחר' fallback option", () => {
    expect(ACADEMIC_INSTITUTIONS.some((i) => i.id === "other")).toBe(true);
  });
});

describe("isValidAcademicInstitution", () => {
  it("accepts every listed id", () => {
    for (const inst of ACADEMIC_INSTITUTIONS) {
      expect(isValidAcademicInstitution(inst.id)).toBe(true);
    }
  });

  it("rejects empty string", () => {
    expect(isValidAcademicInstitution("")).toBe(false);
  });

  it("rejects off-list string", () => {
    expect(isValidAcademicInstitution("garbage")).toBe(false);
  });

  it("rejects non-string inputs (number, null, undefined, object)", () => {
    expect(isValidAcademicInstitution(42)).toBe(false);
    expect(isValidAcademicInstitution(null)).toBe(false);
    expect(isValidAcademicInstitution(undefined)).toBe(false);
    expect(isValidAcademicInstitution({ id: "hebrew_university" })).toBe(false);
  });
});

describe("getAcademicInstitutionLabel", () => {
  it("returns the Hebrew label for a known id", () => {
    expect(getAcademicInstitutionLabel("hebrew_university")).toBe(
      "האוניברסיטה העברית בירושלים"
    );
    expect(getAcademicInstitutionLabel("other")).toBe("אחר");
  });

  it("returns null for null / undefined / unknown id", () => {
    expect(getAcademicInstitutionLabel(null)).toBeNull();
    expect(getAcademicInstitutionLabel(undefined)).toBeNull();
    expect(getAcademicInstitutionLabel("not_an_institution")).toBeNull();
  });
});

describe("LEGAL_SPECIALIZATIONS", () => {
  it("has exactly 14 entries", () => {
    expect(LEGAL_SPECIALIZATIONS.length).toBe(14);
  });

  it("every id is unique", () => {
    const ids = LEGAL_SPECIALIZATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty Hebrew label", () => {
    for (const spec of LEGAL_SPECIALIZATIONS) {
      expect(spec.label.length).toBeGreaterThan(0);
    }
  });

  it("includes the 'אחר / טרם נקבע' fallback option", () => {
    expect(
      LEGAL_SPECIALIZATIONS.some((s) => s.id === "other_undecided")
    ).toBe(true);
  });
});

describe("isValidLegalSpecialization", () => {
  it("accepts every listed id", () => {
    for (const spec of LEGAL_SPECIALIZATIONS) {
      expect(isValidLegalSpecialization(spec.id)).toBe(true);
    }
  });

  it("rejects empty string", () => {
    expect(isValidLegalSpecialization("")).toBe(false);
  });

  it("rejects off-list string", () => {
    expect(isValidLegalSpecialization("garbage")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isValidLegalSpecialization(42)).toBe(false);
    expect(isValidLegalSpecialization(null)).toBe(false);
    expect(isValidLegalSpecialization(undefined)).toBe(false);
    expect(isValidLegalSpecialization({ id: "criminal_law" })).toBe(false);
  });
});

describe("getLegalSpecializationLabel", () => {
  it("returns the Hebrew label for a known id", () => {
    expect(getLegalSpecializationLabel("criminal_law")).toBe("משפט פלילי");
    expect(getLegalSpecializationLabel("other_undecided")).toBe(
      "אחר / טרם נקבע"
    );
  });

  it("returns null for null / undefined / unknown id", () => {
    expect(getLegalSpecializationLabel(null)).toBeNull();
    expect(getLegalSpecializationLabel(undefined)).toBeNull();
    expect(getLegalSpecializationLabel("not_a_spec")).toBeNull();
  });
});
