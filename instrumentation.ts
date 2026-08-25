/**
 * Runs once when the Next.js server process boots (Render start command).
 *
 * Its whole job is to separate two failures that look identical from the
 * browser: a variable Render never received, and a variable Render has but
 * the BUILD did not. `NEXT_PUBLIC_*` values are substituted into the client
 * bundle at build time, so a variable added after the last build — or a
 * deploy that reused a cached build — leaves an empty string compiled into
 * the JavaScript while `process.env` on the server looks perfectly fine.
 *
 * Prints presence and length only. Never the value: this lands in Render's
 * log stream, and secrets do not belong there.
 */
export async function register(): Promise<void> {
  const report = (name: string) => {
    const value = process.env[name];
    if (value === undefined) return `${name}=<undefined>`;
    if (value === "") return `${name}=<empty string>`;
    // Host only for URLs, so the log is useful without being a leak.
    const shown = /^https?:\/\//.test(value)
      ? value
      : `<set, ${value.length} chars>`;
    return `${name}=${shown}`;
  };

  console.info(
    "[boot] runtime env:",
    [
      report("NEXT_PUBLIC_API_BASE_URL"),
      report("NEXT_PUBLIC_SITE_URL"),
      report("NEXT_PUBLIC_SUPABASE_URL"),
      report("NODE_ENV"),
    ].join("  |  ")
  );

  // Every NEXT_PUBLIC_* key the process can actually see, JSON-quoted.
  //
  // A key with a trailing space reads as `NEXT_PUBLIC_API_BASE_URL` in a
  // hosting dashboard and as undefined in code — the two are impossible to
  // tell apart by eye. Quoting turns that invisible difference into a
  // visible one: "NEXT_PUBLIC_API_BASE_URL " with the space inside the
  // quotes, rather than a name that merely looks right.
  const publicKeys = Object.keys(process.env)
    .filter((key) => key.startsWith("NEXT_PUBLIC"))
    .sort();
  console.info(
    `[boot] NEXT_PUBLIC_* keys visible to the process (${publicKeys.length}):`,
    publicKeys.map((key) => JSON.stringify(key)).join(", ") || "(none)"
  );
}
