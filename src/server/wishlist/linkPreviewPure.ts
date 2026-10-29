/**
 * Wishlist link previews (PR 3): pure HTML → preview extraction. No network.
 * Only reads <meta>/<title>; never executes or renders anything from the page.
 */

export type ExtractedPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeCodePoint(Number.parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0x20 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "";
  return String.fromCodePoint(cp);
}

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Reads `<meta property|name="key" content="…">` in either attribute order. */
function metaContent(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const tag of tags) {
      const keyMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
      if (!keyMatch || keyMatch[1].toLowerCase() !== key) continue;
      const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i) ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i);
      if (content?.[1]) return content[1];
    }
  }
  return null;
}

function resolveHttpUrl(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(decodeHtmlEntities(raw).trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

export function extractLinkPreview(html: string, pageUrl: string): ExtractedPreview {
  // Meta tags live in <head>; cap the scan so a huge page cannot burn CPU.
  const head = html.slice(0, 400_000);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  return {
    title: clean(metaContent(head, ["og:title", "twitter:title"]) ?? titleTag, 200),
    description: clean(metaContent(head, ["og:description", "twitter:description", "description"]), 300),
    imageUrl: resolveHttpUrl(
      metaContent(head, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]),
      pageUrl,
    ),
    siteName: clean(metaContent(head, ["og:site_name"]), 80),
  };
}

/** A title that only repeats the link host/URL is a placeholder the preview may replace. */
export function isProvisionalTitle(title: string, url: string): boolean {
  const t = title.trim().toLowerCase();
  if (t === url.trim().toLowerCase()) return true;
  try {
    return t === new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
}
