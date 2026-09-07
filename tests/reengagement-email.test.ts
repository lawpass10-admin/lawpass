// @vitest-environment node
//
// The re-engagement nudge. Covers the two things that are easy to get wrong
// and expensive to get wrong in production: Hebrew gender agreement in the
// copy, and the unsubscribe signature.
//
// The selection rule — who counts as inactive — is SQL and is not tested here;
// it lives in supabase/migrations/20260907000001_reengagement_nudges.sql and
// is exercised against the real database.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildReengagementEmail, firstName } from "@/lib/email/templates/reengagement";
import {
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
} from "@/lib/email/unsubscribe-token";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-not-a-real-one";
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const base = {
  fullName: "ישראל ישראלי",
  loginUrl: "https://law-pass.com/login",
  unsubscribeUrl: "https://law-pass.com/api/email/unsubscribe?u=1&t=abc",
};

describe("Hebrew copy", () => {
  it("addresses a man in the masculine", () => {
    const { html } = buildReengagementEmail({ ...base, gender: "male" });
    expect(html).toContain("אינך משתמש במערכת");
    expect(html).not.toContain("אינך משתמשת");
  });

  it("addresses a woman in the feminine", () => {
    const { html } = buildReengagementEmail({ ...base, gender: "female" });
    expect(html).toContain("אינך משתמשת במערכת");
  });

  it("avoids the gendered verb entirely when gender is unknown or withheld", () => {
    for (const gender of ["other", "prefer_not_to_say", null, undefined]) {
      const { html } = buildReengagementEmail({ ...base, gender });
      expect(html).toContain("לא נכנסת למערכת");
      expect(html).not.toContain("אינך משתמש");
    }
  });

  it("greets by first name only", () => {
    const { html } = buildReengagementEmail({ ...base, gender: "male" });
    expect(html).toContain("ישראל,");
    expect(html).not.toContain("ישראל ישראלי,");
  });

  it("survives an empty or single-word name", () => {
    expect(firstName("")).toBe("");
    expect(firstName("  ")).toBe("");
    expect(firstName("דנה")).toBe("דנה");
    expect(firstName("  דנה   כהן ")).toBe("דנה");

    // No name must not produce a dangling comma.
    const { html } = buildReengagementEmail({ ...base, fullName: "", gender: "female" });
    expect(html).not.toContain(", מזמן");
    expect(html).toContain("מזמן לא התראינו");
  });

  it("keeps the name out of the subject and includes both links in the body", () => {
    const { subject, html } = buildReengagementEmail({ ...base, gender: "male" });
    expect(subject).not.toContain("ישראל");
    expect(html).toContain("https://law-pass.com/login");
    expect(html).toContain("הסרה מרשימת התפוצה");
  });

  it("escapes a name containing markup", () => {
    const { html } = buildReengagementEmail({
      ...base,
      fullName: "<b>ישראל</b>",
      gender: "male",
    });
    expect(html).not.toContain("<b>ישראל</b>");
    expect(html).toContain("&lt;b&gt;ישראל&lt;/b&gt;");
  });
});

describe("unsubscribe token", () => {
  const user = "3f1a7c2e-0000-4000-8000-000000000001";

  it("verifies a token it issued", () => {
    expect(verifyUnsubscribe(user, signUnsubscribe(user))).toBe(true);
  });

  it("rejects another user's token — the whole point of signing", () => {
    const other = "3f1a7c2e-0000-4000-8000-000000000002";
    expect(verifyUnsubscribe(other, signUnsubscribe(user))).toBe(false);
  });

  it("rejects a tampered, empty or missing token", () => {
    const token = signUnsubscribe(user);
    expect(verifyUnsubscribe(user, token.slice(0, -1) + "x")).toBe(false);
    expect(verifyUnsubscribe(user, "")).toBe(false);
    expect(verifyUnsubscribe(user, token.slice(0, 5))).toBe(false);
    expect(verifyUnsubscribe("", token)).toBe(false);
  });

  it("stops verifying when the secret changes", () => {
    const token = signUnsubscribe(user);
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "a-different-secret";
    expect(verifyUnsubscribe(user, token)).toBe(false);
  });

  it("builds a URL that the route can parse, with no double slash", () => {
    const url = unsubscribeUrl("https://law-pass.com/", user);
    expect(url.startsWith("https://law-pass.com/api/email/unsubscribe?")).toBe(true);

    const parsed = new URL(url);
    expect(parsed.searchParams.get("u")).toBe(user);
    expect(verifyUnsubscribe(user, parsed.searchParams.get("t") ?? "")).toBe(true);
  });
});
