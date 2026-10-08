import { describe, expect, it } from "vitest";

import {
  pageLabelFor,
  UNKNOWN_PAGE,
} from "@/app/(app)/admin/usage/_lib/page-labels";

describe("pageLabelFor", () => {
  it("names the screen behind an api domain", () => {
    expect(pageLabelFor("api", "/api/custom-exam/pool")).toBe("שאלון מותאם אישית");
    expect(pageLabelFor("api", "/api/open-questions/subjects")).toBe("מטלת כתיבה");
    expect(pageLabelFor("api", "/api/mahoti/questions/:id/attempts")).toBe("דין מהותי");
  });

  it("covers every endpoint of a domain, including ones not listed", () => {
    // The point of matching by domain: an endpoint added tomorrow is already
    // labelled, instead of showing a blank cell nobody notices.
    for (const path of [
      "/api/dashboard/mastery",
      "/api/dashboard/overview",
      "/api/dashboard/something-not-built-yet",
    ]) {
      expect(pageLabelFor("api", path)).toBe("סטטיסטיקה אישית ותרגול מותאם");
    }
  });

  it("does not let one domain swallow another that shares its prefix", () => {
    // `/api/exam` vs `/api/exam-archive` is the case a bare startsWith gets
    // wrong, and it would be wrong silently — a plausible label on the wrong
    // row is worse than no label.
    expect(pageLabelFor("api", "/api/exam/sessions")).toBe("סימולציות בחינה");
    expect(pageLabelFor("web", "/exam")).toBe("סימולציות בחינה");
    expect(pageLabelFor("web", "/exam-archive")).toBe("משוב מפורט על מבחנים שעשיתי");
  });

  it("matches a domain exactly, not only with a trailing segment", () => {
    expect(pageLabelFor("api", "/api/drafts")).toBe("הטיוטות שלי");
    expect(pageLabelFor("web", "/dashboard")).toBe("סטטיסטיקה אישית ותרגול מותאם");
  });

  it("reads web paths against the page table, not the api one", () => {
    // Same word, different tables: `/dashboard` is a page and `/api/dashboard`
    // is a router, and neither should resolve through the other's list.
    expect(pageLabelFor("web", "/api/dashboard/mastery")).toBe(UNKNOWN_PAGE);
    expect(pageLabelFor("api", "/dashboard")).toBe(UNKNOWN_PAGE);
  });

  it("says nothing rather than guessing for unmapped paths", () => {
    // These are really counted — the middleware records whatever is requested.
    expect(pageLabelFor("api", "/favicon.ico")).toBe(UNKNOWN_PAGE);
    expect(pageLabelFor("api", "/")).toBe(UNKNOWN_PAGE);
    expect(pageLabelFor("api", "/api/not-a-domain/x")).toBe(UNKNOWN_PAGE);
  });

  it("gives the three auth screens one flow name", () => {
    for (const path of ["/api/auth/signup", "/api/auth/signin", "/api/auth/verify-otp"]) {
      expect(pageLabelFor("api", path)).toBe("התחברות והרשמה");
    }
  });
});
