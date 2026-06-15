/**
 * Server-side: fetch the og:image thumbnail from a public Instagram Reel page.
 * Uses the same browser-UA strategy as /api/business/instagram/avatar.
 *
 * Returns null on any error (block, timeout, private reel, etc.).
 * Result is cached by Next.js fetch cache for 24 h.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 5_000;

export async function fetchReelsThumbnail(reelsUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(reelsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
      },
      // Cache at the Next.js layer: revalidate every 24 hours.
      next: { revalidate: 86_400 },
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();

    // 1. Try standard og:image (two attribute orderings)
    const ogA = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const ogB = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogUrl = ogA?.[1] ?? ogB?.[1];
    if (ogUrl) return decodeHtmlEntities(ogUrl);

    // 2. Try "thumbnail_url" embedded in page JSON
    const thumbMatch = html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/);
    if (thumbMatch?.[1]) return decodeHtmlEntities(thumbMatch[1]);

    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&");
}
