import { describe, expect, it } from "vitest";

import {
  academicInstitutionSchema,
  birthDateSchema,
  emailSchema,
  examDatePlannedSchema,
  legalSpecializationSchema,
  passwordSchema,
  phoneSchema,
} from "@/lib/validators/auth";

describe("emailSchema", () => {
  it("accepts a well-formed address and normalizes case", () => {
    const result = emailSchema.safeParse("  User@Example.COM  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com");
    }
  });

  it("rejects an obviously malformed address", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("passwordSchema (SPEC §6.1)", () => {
  it("accepts a password with min length + lower + upper + digit", () => {
    expect(passwordSchema.safeParse("Password1").success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("Aa1").success).toBe(false);
  });

  it("rejects passwords missing an uppercase letter", () => {
    expect(passwordSchema.safeParse("password1").success).toBe(false);
  });

  it("rejects passwords missing a digit", () => {
    expect(passwordSchema.safeParse("Password").success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("accepts a 10-digit Israeli mobile starting with 05", () => {
    expect(phoneSchema.safeParse("0501234567").success).toBe(true);
  });

  it("rejects international (+972) format", () => {
    expect(phoneSchema.safeParse("+972501234567").success).toBe(false);
  });

  it("rejects landline numbers", () => {
    expect(phoneSchema.safeParse("0312345678").success).toBe(false);
  });
});

describe("birthDateSchema", () => {
  it("accepts a date >= 18 years ago", () => {
    expect(birthDateSchema.safeParse("1990-01-01").success).toBe(true);
  });

  it("rejects a date < 18 years ago", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const iso = yesterday.toISOString().slice(0, 10);
    expect(birthDateSchema.safeParse(iso).success).toBe(false);
  });
});

describe("examDatePlannedSchema (.nullish())", () => {
  // This is the field that the Slice 1 dcac6f3 hotfix targeted: Supabase
  // strips null-valued keys from user_metadata, so the read-back schema
  // must accept BOTH null and undefined alongside a valid YYYY-MM-01.
  it("accepts null", () => {
    expect(examDatePlannedSchema.safeParse(null).success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(examDatePlannedSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid YYYY-MM-01 string", () => {
    expect(examDatePlannedSchema.safeParse("2026-08-01").success).toBe(true);
  });

  it("rejects a date that is not the first of the month", () => {
    expect(examDatePlannedSchema.safeParse("2026-08-15").success).toBe(false);
  });
});

// =============================================================================
// Slice 13 — academic_institution + legal_specialization enum schemas
// =============================================================================

describe("academicInstitutionSchema", () => {
  it("accepts a listed id", () => {
    const result = academicInstitutionSchema.safeParse("hebrew_university");
    expect(result.success).toBe(true);
  });

  it("accepts the 'other' fallback id", () => {
    expect(academicInstitutionSchema.safeParse("other").success).toBe(true);
  });

  it("rejects empty string", () => {
    const result = academicInstitutionSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/מוסד אקדמי/);
    }
  });

  it("rejects an off-list id", () => {
    expect(
      academicInstitutionSchema.safeParse("not_a_real_institution").success
    ).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(academicInstitutionSchema.safeParse(42).success).toBe(false);
    expect(academicInstitutionSchema.safeParse(null).success).toBe(false);
    expect(academicInstitutionSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("legalSpecializationSchema", () => {
  it("accepts a listed id", () => {
    const result = legalSpecializationSchema.safeParse("criminal_law");
    expect(result.success).toBe(true);
  });

  it("accepts the 'other_undecided' fallback id", () => {
    expect(
      legalSpecializationSchema.safeParse("other_undecided").success
    ).toBe(true);
  });

  it("rejects empty string", () => {
    const result = legalSpecializationSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/תחום התמחות/);
    }
  });

  it("rejects an off-list id", () => {
    expect(
      legalSpecializationSchema.safeParse("not_a_real_specialization").success
    ).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(legalSpecializationSchema.safeParse(42).success).toBe(false);
    expect(legalSpecializationSchema.safeParse(null).success).toBe(false);
    expect(legalSpecializationSchema.safeParse(undefined).success).toBe(false);
  });
});
