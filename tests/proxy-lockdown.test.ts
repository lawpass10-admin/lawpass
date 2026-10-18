import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoginGate } from "@/lib/auth/login-lock";

// The proxy's three collaborators. Mocked so these tests are about ROUTING
// decisions and nothing else — no Supabase, no database, no usage counter.
const gate = vi.hoisted(() => ({ value: null as LoginGate | null }));
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/lib/auth/login-lock", () => ({
  readLoginGate: async () => gate.value,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => ({
    supabase: {},
    user: session.user,
    response: NextResponse.next(),
  }),
}));

vi.mock("@/lib/usage/record", () => ({
  recordUsage: async () => {},
  deviceOf: () => "desktop",
  normalisePath: (p: string) => p,
}));

const { proxy } = await import("@/proxy");

const OPEN: LoginGate = { locked: false, isAdmin: false, allowed: true };
const BLOCKED: LoginGate = { locked: true, isAdmin: false, allowed: false };
const ADMIN: LoginGate = { locked: true, isAdmin: true, allowed: true };

async function go(path: string) {
  const res = await proxy(new NextRequest(`https://law-pass.com${path}`));
  const location = res.headers.get("location");
  return {
    status: res.status,
    to: location ? new URL(location).pathname : null,
  };
}

beforeEach(() => {
  gate.value = OPEN;
  session.user = null;
});

describe("lockdown", () => {
  it("THE SIGN-IN DOOR STAYS OPEN while locked", async () => {
    // The bug this exists to prevent: the gate cannot tell an admin from
    // anyone else until there IS a session, so a signed-out admin looks
    // exactly like a blocked user. With /login gated, they were redirected to
    // /maintenance before the form rendered — and the lock locked out the
    // only people who could unlock it.
    gate.value = BLOCKED;
    expect((await go("/login")).to).toBe(null);
    expect((await go("/forgot-password")).to).toBe(null);
    expect((await go("/reset-password")).to).toBe(null);
  });

  it("sends a blocked user to the maintenance page", async () => {
    gate.value = BLOCKED;
    expect((await go("/dashboard")).to).toBe("/maintenance");
    expect((await go("/")).to).toBe("/maintenance");
    expect((await go("/mahoti")).to).toBe("/maintenance");
  });

  it("keeps registration shut — that is what the lock is for", async () => {
    gate.value = BLOCKED;
    expect((await go("/signup")).to).toBe("/maintenance");
    expect((await go("/verify-email")).to).toBe("/maintenance");
  });

  it("lets an admin straight through", async () => {
    gate.value = ADMIN;
    session.user = { id: "admin-1" };
    expect((await go("/dashboard")).to).toBe(null);
    expect((await go("/admin/users")).to).toBe(null);
  });

  it("never redirects the maintenance page to itself", async () => {
    // A loop here is not a cosmetic bug: it is the whole site in a redirect
    // cycle with no page able to say why.
    gate.value = BLOCKED;
    expect((await go("/maintenance")).to).toBe(null);
  });

  it("leaves the legal pages reachable", async () => {
    gate.value = BLOCKED;
    expect((await go("/privacy")).to).toBe(null);
    expect((await go("/terms")).to).toBe(null);
    expect((await go("/accessibility")).to).toBe(null);
  });

  it("changes nothing when the app is unlocked", async () => {
    gate.value = OPEN;
    expect((await go("/")).to).toBe(null);
    expect((await go("/login")).to).toBe(null);
    // Still the ordinary signed-out behaviour, not the maintenance page.
    expect((await go("/dashboard")).to).toBe("/login");
  });

  it("still bounces a signed-in user away from /login when unlocked", async () => {
    gate.value = OPEN;
    session.user = { id: "u1" };
    expect((await go("/login")).to).toBe("/dashboard");
  });
});
