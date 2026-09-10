import { getGlobalNoindexPublicBaseUrl } from "@/lib/seo/globalNoindex";

export const dynamic = "force-dynamic";

/**
 * Compatibility endpoint for the WordPress-era Search Console submission.
 *
 * The current application publishes its canonical sitemap at /sitemap.xml
 * (also advertised by robots.txt). Google Search Console still has the old
 * /sitemap_index.xml URL submitted, so keeping this endpoint as a valid
 * sitemap index lets crawlers discover the current sitemap while the legacy
 * submission ages out/is removed in Search Console.
 */
export function GET(): Response {
  const baseUrl = getGlobalNoindexPublicBaseUrl().replace(/\/$/, "");
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <sitemap>",
    `    <loc>${sitemapUrl}</loc>`,
    "  </sitemap>",
    "</sitemapindex>",
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
