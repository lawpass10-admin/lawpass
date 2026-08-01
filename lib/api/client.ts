"use client";

/**
 * Browser-side client for the standalone Express API (lawpass_server).
 *
 * Env-gated: the API is used ONLY when NEXT_PUBLIC_API_BASE_URL is set
 * (local dev → http://localhost:4000). On Vercel/production the var is
 * unset, `apiEnabled()` is false, and the per-domain wrappers fall back
 * to the in-app server actions — so production is unaffected until the
 * server is deployed and the var is set.
 *
 * NEXT_PUBLIC_* vars are inlined at build time, so a change requires a
 * dev-server restart to take effect.
 */

import { createClient } from "@/lib/supabase/client";

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

/** True when the frontend should route through the Express API. */
export function apiEnabled(): boolean {
  return apiBaseUrl().length > 0;
}

/**
 * Dev tracing for the server extraction. Logs each request to the Express
 * API and the response it returns, so you can confirm in the browser
 * console that the call actually hit lawpass_server (port 4000) and see the
 * server's `{ ok, ... }` envelope. Only active when the API is enabled
 * (NEXT_PUBLIC_API_BASE_URL set → local dev); on Vercel/prod it's a no-op.
 * Never logs the request body (auth bodies carry passwords/OTP codes).
 */
function logReq(method: string, path: string): void {
  console.log(`[api →] ${method} ${apiBaseUrl()}${path}`);
}

function logRes(method: string, path: string, res: Response, body: JsonRecord): void {
  console.log(
    `[api ←] ${method} ${path} status=${res.status} ok=${String(body.ok)}` +
      (typeof body.error === "string" ? ` error=${body.error}` : "")
  );
}

/**
 * The user's Supabase access token for the Authorization: Bearer header
 * that the server's `authenticate` middleware expects. Read from the
 * browser Supabase session. Returns null when there is no session (the
 * caller then hits the server unauthenticated → 401).
 */
async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

type JsonRecord = Record<string, unknown>;

/**
 * POST a JSON body to `${base}${path}` and return the parsed JSON body.
 * The server always answers with a `{ ok, ... }` JSON envelope (for both
 * success and error statuses), so callers read `.ok` / `.error` directly.
 * Throws on a network failure or a non-JSON response — per-domain
 * wrappers catch that and map it to their own fallback error shape.
 */
export async function apiPostJson(
  path: string,
  body: unknown,
  opts: { auth?: boolean } = {}
): Promise<JsonRecord> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  logReq("POST", path);
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as JsonRecord;
  logRes("POST", path, res, data);
  return data;
}

/**
 * POST a multipart/form-data body (used by the QA report submit, which
 * carries an optional screenshot File alongside the text fields). The
 * browser sets the Content-Type + boundary itself — we must NOT set it.
 * Same `{ ok, ... }` envelope + throw-on-failure contract as apiPostJson.
 */
export async function apiPostForm(
  path: string,
  formData: FormData,
  opts: { auth?: boolean } = {}
): Promise<JsonRecord> {
  const headers: Record<string, string> = {};
  if (opts.auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  logReq("POST", path);
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = (await res.json()) as JsonRecord;
  logRes("POST", path, res, data);
  return data;
}

/**
 * GET `${base}${path}` and return the parsed `{ ok, ... }` JSON body.
 * Same throw-on-failure contract as apiPostJson.
 */
export async function apiGetJson(
  path: string,
  opts: { auth?: boolean } = {}
): Promise<JsonRecord> {
  const headers: Record<string, string> = {};
  if (opts.auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  logReq("GET", path);
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "GET",
    headers,
  });

  const data = (await res.json()) as JsonRecord;
  logRes("GET", path, res, data);
  return data;
}

/**
 * DELETE `${base}${path}` with a JSON body (the practice notes delete
 * carries { sessionId, position }). Same envelope + throw contract.
 */
export async function apiDeleteJson(
  path: string,
  body: unknown,
  opts: { auth?: boolean } = {}
): Promise<JsonRecord> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  logReq("DELETE", path);
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as JsonRecord;
  logRes("DELETE", path, res, data);
  return data;
}

/**
 * Factory that turns a server action into a dual-path wrapper with the
 * IDENTICAL signature (params + return type flow through the generics, so
 * call sites are unchanged). When the API is disabled it defers to the
 * action; otherwise it sends the action's first argument as the request
 * body and returns the server's `{ ok, ... }` envelope. The server
 * preserves each action's response shape, so the cast is safe; on a
 * network failure it returns `{ ok:false, error: fallbackError }`.
 *
 * Used for the high-volume practice/exam gameplay actions to avoid
 * per-function boilerplate.
 */
export function apiAction<TArgs extends unknown[], TResult>(
  path: string,
  action: (...args: TArgs) => Promise<TResult>,
  opts: { method?: "POST" | "DELETE"; fallbackError?: string } = {}
): (...args: TArgs) => Promise<TResult> {
  const method = opts.method ?? "POST";
  const fallbackError = opts.fallbackError ?? "invalid_input";
  return async (...args: TArgs): Promise<TResult> => {
    // [VERIFY-EXPRESS] fallback disabled — see the banner in lib/api/auth.ts.
    // if (!apiEnabled()) {
    //   return action(...args);
    // }
    try {
      const body = args.length > 0 ? args[0] : {};
      const data =
        method === "DELETE"
          ? await apiDeleteJson(path, body, { auth: true })
          : await apiPostJson(path, body, { auth: true });
      return data as unknown as TResult;
    } catch {
      return { ok: false, error: fallbackError } as unknown as TResult;
    }
  };
}
