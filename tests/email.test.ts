// @vitest-environment node
//
// The email service. Runs under `node`, not the project-wide jsdom, because
// sendEmail refuses to run where a `window` exists — that guard is what stops
// the Resend API key being bundled into client JavaScript, and a jsdom test
// would trip it on every call.
//
// Nothing here touches the network: `fetch` is injected. These tests pin the
// behaviour that makes the wrapper worth having over a bare
// `resend.emails.send` — the retry rules, the idempotency key, and the promise
// that a delivery failure is reported rather than thrown.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  escapeHtml,
  htmlToText,
  isEmailConfigured,
  renderEmail,
  sendEmail,
} from "@/lib/email";

const ORIGINAL_ENV = { ...process.env };

/** A fetch that returns one queued response per call and records the requests. */
function stubFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const body = (init: RequestInit) => JSON.parse(String(init.body));

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key_123456789";
  process.env.RESEND_FROM_EMAIL = "LawPass <noreply@example.test>";
  delete process.env.RESEND_REPLY_TO;
  delete process.env.EMAIL_DRY_RUN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const message = {
  to: "candidate@example.test",
  subject: "המבחן שלך נבדק",
  html: "<p>שלום</p>",
};

describe("configuration", () => {
  it("needs both the key and the from-address", () => {
    expect(isEmailConfigured()).toBe(true);

    delete process.env.RESEND_FROM_EMAIL;
    expect(isEmailConfigured()).toBe(false);
  });

  it("reports a missing configuration instead of throwing", async () => {
    delete process.env.RESEND_API_KEY;
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "x" } }]);

    const result = await sendEmail(message, impl);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("RESEND_API_KEY");
      expect(result.retryable).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("input validation", () => {
  it("throws on a malformed recipient — that is a bug, not a delivery failure", async () => {
    const { impl } = stubFetch([{ status: 200, body: { id: "x" } }]);
    await expect(sendEmail({ ...message, to: "not-an-address" }, impl)).rejects.toThrow(
      /not a usable email address/
    );
  });

  it("throws on an empty subject or body", async () => {
    const { impl } = stubFetch([{ status: 200, body: { id: "x" } }]);
    await expect(sendEmail({ ...message, subject: "  " }, impl)).rejects.toThrow(/subject/);
    await expect(sendEmail({ ...message, html: "" }, impl)).rejects.toThrow(/html/);
  });

  it("accepts a display-name address", async () => {
    const { impl } = stubFetch([{ status: 200, body: { id: "e1" } }]);
    const result = await sendEmail({ ...message, to: "Ido <ido@example.test>" }, impl);
    expect(result.ok).toBe(true);
  });
});

describe("the request it builds", () => {
  it("sends the configured from-address, an array of recipients, and the key", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    const result = await sendEmail(message, impl);

    expect(result).toEqual({ ok: true, id: "e_1", dryRun: false });
    expect(calls).toHaveLength(1);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key_123456789");
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(body(calls[0].init)).toMatchObject({
      from: "LawPass <noreply@example.test>",
      to: ["candidate@example.test"],
      subject: "המבחן שלך נבדק",
    });
  });

  it("derives a plain-text part when none is given", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    await sendEmail({ ...message, html: "<p>שלום</p><p>הציון שלך מוכן</p>" }, impl);

    expect(body(calls[0].init).text).toBe("שלום\nהציון שלך מוכן");
  });

  it("converts tags to Resend's name/value shape and base64s attachments", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    await sendEmail(
      {
        ...message,
        tags: { type: "grading-complete" },
        attachments: [{ filename: "a.txt", content: Buffer.from("hello") }],
      },
      impl
    );

    const sent = body(calls[0].init);
    expect(sent.tags).toEqual([{ name: "type", value: "grading-complete" }]);
    expect(sent.attachments).toEqual([{ filename: "a.txt", content: "aGVsbG8=" }]);
  });

  it("falls back to RESEND_REPLY_TO, and lets the caller override it", async () => {
    process.env.RESEND_REPLY_TO = "support@example.test";
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    await sendEmail(message, impl);
    expect(body(calls[0].init).reply_to).toBe("support@example.test");

    await sendEmail({ ...message, replyTo: "other@example.test" }, impl);
    expect(body(calls[1].init).reply_to).toBe("other@example.test");
  });
});

describe("dry run", () => {
  it("reports success without calling the provider", async () => {
    process.env.EMAIL_DRY_RUN = "1";
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    const result = await sendEmail(message, impl);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dryRun).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("never logs the API key", async () => {
    process.env.EMAIL_DRY_RUN = "1";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { impl } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    await sendEmail(message, impl);

    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain("re_test_key_123456789");
    expect(logged).toContain("re_test_"); // the redacted prefix is still useful
  });
});

describe("failure handling", () => {
  it("does not retry a rejection the provider will repeat", async () => {
    // 422 is the unverified-domain / bad-payload case. Retrying wastes time.
    const { impl, calls } = stubFetch([{ status: 422, body: { message: "domain not verified" } }]);

    const result = await sendEmail(message, impl);

    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("domain not verified");
      expect(result.status).toBe(422);
      expect(result.retryable).toBe(false);
    }
  });

  it("retries a 500 and reuses the SAME idempotency key", async () => {
    const { impl, calls } = stubFetch([
      { status: 500, body: { message: "boom" } },
      { status: 200, body: { id: "e_after_retry" } },
    ]);

    const result = await sendEmail(message, impl);

    expect(result).toEqual({ ok: true, id: "e_after_retry", dryRun: false });
    expect(calls).toHaveLength(2);
    const first = (calls[0].init.headers as Record<string, string>)["Idempotency-Key"];
    const second = (calls[1].init.headers as Record<string, string>)["Idempotency-Key"];
    // If these differed, a retry after a response we never saw would send the
    // candidate a second copy.
    expect(second).toBe(first);
  });

  it("gives up after three attempts and says the failure was retryable", async () => {
    const { impl, calls } = stubFetch([{ status: 429, body: { message: "rate limited" } }]);

    const result = await sendEmail(message, impl);

    expect(calls).toHaveLength(3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  it("uses a caller-supplied idempotency key verbatim", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { id: "e_1" } }]);

    await sendEmail({ ...message, idempotencyKey: "grading-complete:abc" }, impl);

    expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "grading-complete:abc"
    );
  });
});

describe("layout", () => {
  it("escapes interpolated text", () => {
    expect(escapeHtml(`<script>"x"&'y'`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;");
  });

  it("renders RTL Hebrew and escapes a candidate's name", () => {
    const html = renderEmail({
      heading: "המבחן שלך נבדק",
      preheader: "הציון ממתין לך",
      paragraphs: ["שלום <ido>"],
      cta: { label: "צפייה בפתרון", url: "https://lawpass.test/results/1" },
    });

    expect(html).toContain('lang="he"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("direction:rtl");
    expect(html).toContain("הציון ממתין לך");
    expect(html).toContain("שלום &lt;ido&gt;");
    expect(html).not.toContain("<ido>");
    expect(html).toContain("https://lawpass.test/results/1");
  });

  it("produces a readable text part from the rendered shell", () => {
    const html = renderEmail({ heading: "כותרת", paragraphs: ["שורה ראשונה", "שורה שנייה"] });
    const text = htmlToText(html);

    expect(text).toContain("שורה ראשונה");
    expect(text).toContain("שורה שנייה");
    expect(text).not.toContain("<");
    // <style>/<head> content must not leak into the plain-text alternative.
    expect(text).not.toContain("doctype");
  });
});
