/**
 * Usage recording — the shared half, used by the Next proxy and anything else
 * that needs to count a request.
 *
 * It talks to PostgREST with `fetch` rather than through @supabase/ssr. The
 * proxy runs on the Edge runtime, where a Supabase client per request is
 * weight for nothing: this is one POST to one function with three strings, and
 * fetch is available there without a bundle.
 */

/** Phones and tablets. Deliberately crude — see `deviceOf`. */
const MOBILE = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile Safari|webOS|BlackBerry/i;
const BOT = /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|monitor|preview/i;

export type Device = "mobile" | "desktop" | "bot";
export type Surface = "web" | "api";

/**
 * Which kind of thing made this request.
 *
 * A short regex, not a user-agent library. The question this answers is "is
 * this a phone", and for that a handful of tokens is right for years at a time;
 * a parsing library would add a dependency and a data file to tell us the same
 * boolean. BOTS ARE CHECKED FIRST because a crawler's agent often contains
 * "Mobile" — Googlebot's smartphone crawler says so outright — and counting
 * those as phones would quietly inflate the one number this exists to produce.
 */
export function deviceOf(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? "";
  if (!ua) return "bot"; // no agent at all is a script, not a person
  if (BOT.test(ua)) return "bot";
  return MOBILE.test(ua) ? "mobile" : "desktop";
}

/** Path segments that are identifiers rather than route structure. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/**
 * "/study-material/9876a9cc-…/x" becomes "/study-material/:id/x".
 *
 * Without this the counter table grows a row per document per day and answers
 * nothing: a hundred study documents become a hundred rows that each say "1",
 * where what was wanted is one row saying "100 people opened a document".
 *
 * Depth is capped at six segments. A path deeper than that is either a mistake
 * or an attack, and either way it should not be able to create unbounded
 * distinct rows.
 */
export function normalisePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean).slice(0, 6);
  if (parts.length === 0) return "/";
  return (
    "/" +
    parts
      .map((part) =>
        UUID.test(part) || NUMERIC.test(part) || LONG_HEX.test(part) ? ":id" : part.toLowerCase()
      )
      .join("/")
  );
}

/**
 * Count one request. Never throws, never blocks.
 *
 * The caller is serving a page; analytics failing must not change what the
 * person sees, so every error is swallowed here rather than handed back. The
 * cost of that is a silent outage, which is why `record_usage` in the database
 * does NOT swallow anything — if counts stop appearing, the function still
 * reports why when called directly.
 */
export async function recordUsage(input: {
  surface: Surface;
  device: Device;
  path: string;
  supabaseUrl?: string;
  anonKey?: string;
}): Promise<void> {
  const url = input.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = input.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/rpc/record_usage`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Nothing to read back; this keeps PostgREST from building a body.
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        p_surface: input.surface,
        p_device: input.device,
        p_path: input.path,
      }),
    });
  } catch {
    // Deliberately empty — see the note above. A page is being served.
  }
}
