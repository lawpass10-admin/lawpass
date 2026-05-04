import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and exposes the current user
// to the caller. Layouts read the active pathname via the x-pathname header
// that we set here.
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Per Supabase SSR docs: do not run any code between createServerClient and
  // supabase.auth.getUser(). Token refresh would not make it back to the
  // browser and the session would silently desync.
  //
  // getUser can throw an AuthApiError when the JWT is valid-shape but points
  // at a deleted user, OR when the auto-refresh path fails because the
  // refresh_token was revoked. Both are recoverable: clear every sb-* cookie
  // on the response so the next request comes in clean, then return user=null
  // so the proxy redirects to /login (or lets the request through if the path
  // is public). Conservative catch — any throw, auth or otherwise, gets the
  // same treatment.
  let user: User | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  if (!user) {
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) response.cookies.delete(c.name);
    }
  }

  return { supabase, user, response };
}
