import type { MetadataRoute } from "next";

/**
 * Slice 16 / Phase L6 — sitemap.xml.
 *
 * Single entry today: the public landing at `/`. The auth surfaces
 * (/login, /signup, …) and the private app routes don't belong
 * here — they're either transient (signup query params) or gated
 * behind the proxy (dashboard, exam, etc.). Future public pages
 * (e.g. /about, /blog) get added to this list as they ship.
 *
 * `lastModified: new Date()` rebuilds the timestamp on every
 * deploy, which is the closest signal we have to "content
 * changed" without wiring per-page change tracking. Acceptable
 * for a single-entry sitemap; revisit when there's a content
 * pipeline.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ];
}
