/**
 * Server-side: fetch the og:image thumbnail from a public Instagram page.
 *
 * Security boundary:
 * - only explicit HTTPS Instagram page hosts are accepted;
 * - every redirect hop is revalidated against the same allowlist;
 * - DNS is fully resolved/classified and the connection is pinned to an
 *   approved public address by fetchBinary().
 *
 * Returns null on any error (invalid URL, private/reserved destination,
 * timeout, block, private reel, oversized response, etc.).
 */

import { unstable_cache } from "next/cache";
import { fetchBinary } from "@/server/modules/import/parsers/fetchHtml";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const REVALIDATE_SECONDS = 86_400;

const ALLOWED_INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

export function assertSafeInstagramPageUrl(raw: string | URL): URL {
  const url = raw instanceof URL ? new URL(raw.toString()) : new URL(raw.trim());

  if (url.protocol !== "https:") {
    throw new Error("Instagram URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Instagram URL credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!ALLOWED_INSTAGRAM_HOSTS.has(hostname)) {
    throw new Error("Instagram URL host is not allowed");
  }

  return url;
}

export function extractInstagramThumbnailUrlFromHtml(html: string): string | null {
  const ogA = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const ogB = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogUrl = ogA?.[1] ?? ogB?.[1];
  if (ogUrl) return decodeHtmlEntities(ogUrl);

  const thumbMatch = html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/);
  if (thumbMatch?.[1]) return decodeHtmlEntities(thumbMatch[1]);

  return null;
}

async function fetchReelsThumbnailUncached(safeUrl: URL): Promise<string | null> {
  const remote = await fetchBinary(safeUrl.toString(), {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_HTML_BYTES,
    maxRedirects: 5,
    headers: {
      "User-Agent": BROWSER_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    validateUrl: (candidate) => {
      assertSafeInstagramPageUrl(candidate);
    },
  });

  const html = new TextDecoder("utf-8").decode(remote.buffer);
  return extractInstagramThumbnailUrlFromHtml(html);
}

export async function fetchReelsThumbnail(reelsUrl: string): Promise<string | null> {
  try {
    const safeUrl = assertSafeInstagramPageUrl(reelsUrl);
    const cacheKey = `instagram-thumbnail:v2:${safeUrl.toString()}`;

    return await unstable_cache(
      () => fetchReelsThumbnailUncached(safeUrl),
      [cacheKey],
      { revalidate: REVALIDATE_SECONDS },
    )();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&");
}
