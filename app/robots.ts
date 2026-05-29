import type { MetadataRoute } from "next";

/**
 * Slice 16 / Phase L6 — robots.txt.
 *
 * Next App Router converts the default export into /robots.txt at
 * build time, so this is the single source of truth for the
 * crawl policy.
 *
 * Allowed: `/`. Everything else is either:
 *   - a private app surface (dashboard, exam, admin, etc.) gated
 *     by the proxy at the repo root anyway — but explicit
 *     disallow keeps them out of the index even if a future proxy
 *     change relaxes access.
 *   - a transient auth handler (login, signup, verify-email, …)
 *     with query params (?plan=, ?email=, ?next=) that we don't
 *     want Google snapshotting.
 *   - the OAuth callback handler under /auth/* (no SEO value, can
 *     leak query state).
 *   - /api endpoints + the /api/webhooks Tranzila callback.
 *
 * /pricing is on the disallow list because the public landing
 * already shows the plans inline; the /pricing route itself is
 * only reached post-signup when verifyOtpAction lands a user
 * without a subscription, so it's a private surface in practice.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/admin",
          "/api",
          "/auth",
          "/bookmarks",
          "/checkout",
          "/dashboard",
          "/exam",
          "/forgot-password",
          "/login",
          "/mistakes",
          "/onboarding",
          "/practice",
          "/pricing",
          "/qa",
          "/reset-password",
          "/signup",
          "/statistics",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
