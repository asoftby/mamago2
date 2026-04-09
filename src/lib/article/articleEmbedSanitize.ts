import DOMPurify from "isomorphic-dompurify";

/** Результат разбора кода вставки для публичного рендера и предпросмотра. */
export type ArticleEmbedResolveResult = {
  sanitizedHtml: string;
  provider: "youtube" | "instagram" | "unknown";
  requiresInstagramScript: boolean;
};

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getHtmlAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeBasicEntities(m[2] ?? m[3] ?? "");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeYoutubeEmbedSrc(src: string): string | null {
  try {
    const u = new URL(src.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const ok =
      host === "www.youtube.com" ||
      host === "youtube.com" ||
      host === "www.youtube-nocookie.com" ||
      host === "youtube-nocookie.com";
    if (!ok) return null;
    const path = u.pathname.replace(/\/+$/, "");
    if (!/^\/embed\/[a-zA-Z0-9_-]{6,}/.test(path)) return null;
    const hostOut = host.includes("nocookie") ? "www.youtube-nocookie.com" : "www.youtube.com";
    return `https://${hostOut}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

function normalizeInstagramIframeSrc(src: string): string | null {
  try {
    const u = new URL(src.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host !== "www.instagram.com" && host !== "instagram.com") return null;
    const path = u.pathname.replace(/\/+$/, "");
    if (!/^\/(p|reel|tv)\/[^/]+\/embed$/.test(path)) return null;
    return `https://www.instagram.com${path}${u.search}`;
  } catch {
    return null;
  }
}

function buildSafeIframe(src: string, title: string, aspectClass: "video" | "auto"): string {
  const aspectStyle =
    aspectClass === "video"
      ? "aspect-ratio:16/9;min-height:200px"
      : "min-height:320px;min-width:240px";
  return `<iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen="" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" style="width:100%;max-width:100%;border:0;border-radius:0.75rem;${aspectStyle}"></iframe>`;
}

function extractFirstIframeOpenTag(html: string): string | null {
  const m = html.match(/<iframe\b[^>]*>/i);
  return m ? m[0] : null;
}

function tryIframe(html: string): ArticleEmbedResolveResult | null {
  const open = extractFirstIframeOpenTag(html);
  if (!open) return null;
  const srcRaw = getHtmlAttr(open, "src");
  if (!srcRaw) return null;

  const yt = normalizeYoutubeEmbedSrc(srcRaw);
  if (yt) {
    return {
      sanitizedHtml: `<div class="article-embed article-embed--youtube">${buildSafeIframe(yt, "YouTube", "video")}</div>`,
      provider: "youtube",
      requiresInstagramScript: false,
    };
  }

  const ig = normalizeInstagramIframeSrc(srcRaw);
  if (ig) {
    return {
      sanitizedHtml: `<div class="article-embed article-embed--instagram">${buildSafeIframe(ig, "Instagram", "auto")}</div>`,
      provider: "instagram",
      requiresInstagramScript: false,
    };
  }

  return null;
}

function validateInstagramPermalink(href: string): boolean {
  try {
    const u = new URL(href.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host !== "www.instagram.com" && host !== "instagram.com") return false;
    const p = u.pathname.replace(/\/+$/, "");
    return /^\/(p|reel|tv)\/[^/]+$/.test(p);
  } catch {
    return false;
  }
}

function tryInstagramBlockquote(html: string): ArticleEmbedResolveResult | null {
  const m = html.match(/<blockquote\b[\s\S]*?<\/blockquote>/i);
  if (!m) return null;
  const raw = m[0];
  if (!/instagram-media/i.test(raw)) return null;
  const permalink = getHtmlAttr(raw, "data-instgrm-permalink");
  if (!permalink || !validateInstagramPermalink(permalink)) return null;

  const sanitized = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["blockquote", "a", "div", "p", "span"],
    ALLOWED_ATTR: [
      "class",
      "data-instgrm-permalink",
      "data-instgrm-version",
      "data-instgrm-captioned",
      "href",
      "style",
      "target",
      "rel",
    ],
    ALLOW_DATA_ATTR: false,
  });
  if (!/<blockquote/i.test(sanitized)) return null;

  return {
    sanitizedHtml: `<div class="article-embed article-embed--instagram-blockquote">${sanitized}</div>`,
    provider: "instagram",
    requiresInstagramScript: true,
  };
}

/**
 * Безопасный разбор кода вставки: только YouTube iframe, Instagram iframe или официальный blockquote Instagram.
 * Произвольный HTML и &lt;script&gt; из пользовательского ввода не попадают в результат.
 */
export function resolveArticleEmbed(embedHtml: string): ArticleEmbedResolveResult {
  const raw = (embedHtml ?? "").trim();
  if (!raw) {
    return { sanitizedHtml: "", provider: "unknown", requiresInstagramScript: false };
  }

  const iframeResult = tryIframe(raw);
  if (iframeResult) return iframeResult;

  const bqResult = tryInstagramBlockquote(raw);
  if (bqResult) return bqResult;

  return { sanitizedHtml: "", provider: "unknown", requiresInstagramScript: false };
}
