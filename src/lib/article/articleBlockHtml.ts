/**
 * Санитизация HTML блоков статьи.
 *
 * Использует parser-based allowlist-санитайзер, одинаковый на сервере и клиенте.
 * Поддерживает фильтрацию тегов/атрибутов по белому списку
 * и блокировку опасных протоколов (javascript:, data:, vbscript:).
 */

import sanitizeHtml from "sanitize-html";

export type ArticleBlockHtmlVariant = "intro" | "text" | "quote";

const RICH_TEXT_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "div"];
// "text" alone gets the footnote mark (<code>) — the editor only exposes the
// toggle for this variant, and "intro" (the dek) has no matching public
// styling for it (ArticleHeader), so keep it out of intro's own allowlist
// in case older/imported intro HTML happens to contain a stray <code>.
const TEXT_TAGS = [...RICH_TEXT_TAGS, "code"];
const RICH_TEXT_ATTRS = ["href", "target", "rel", "class", "data-sponsored"];

const TAGS: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: RICH_TEXT_TAGS,
  text: TEXT_TAGS,
  quote: ["p", "br", "em", "i"],
};

const ALLOWED_ATTRS_BY_VARIANT: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: RICH_TEXT_ATTRS,
  text: RICH_TEXT_ATTRS,
  quote: [],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Heuristic: stored value looks like HTML from TipTap / editor, not plain text. */
export function articleBlockTextLooksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test((text ?? "").trim());
}

/**
 * Legacy plain text → minimal HTML for TipTap (`<p>`, `<br>`).
 * If the string already looks like HTML, returns it unchanged (then sanitize).
 */
export function legacyPlainTextToEditorHtml(text: string): string {
  const t = text ?? "";
  if (!t.trim()) return "<p></p>";
  if (articleBlockTextLooksLikeHtml(t)) return t;
  return `<p>${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;
}

/**
 * Allowlist-санитизация через полноценный HTML parser.
 * Удаляет все теги кроме разрешённых, фильтрует атрибуты,
 * декодирует HTML entities до проверки URL-схем и пропускает только
 * http:, https:, mailto:, tel: и безопасные относительные URL.
 *
 * SSR-safe — не требует DOM и даёт тот же результат в client preview.
 * Сохраняет текстовое содержимое удалённых тегов.
 *
 * Экспортируется для использования в articleEmbedSanitize.ts.
 */
export function sanitizeHtmlAllowlist(
  html: string,
  allowedTags: string[],
  allowedAttrs: string[],
): string {
  if (!html) return "";

  const sanitized = sanitizeHtml(html, {
    allowedTags: allowedTags.map((tag) => tag.toLowerCase()),
    allowedAttributes: {
      "*": [...new Set([...allowedAttrs.map((attr) => attr.toLowerCase()), "data-*"])],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: [
      "href",
      "src",
      "action",
      "formaction",
      "xlink:href",
    ],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "template", "noscript"],
    parser: {
      decodeEntities: true,
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target?.toLowerCase() === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
    },
  });

  // Keep the historical serialization used by stored/editor HTML. This is
  // output formatting only; parsing and URL validation have already completed.
  return sanitized.replace(/<(br|hr) \/>/g, "<$1>");
}

/** Safe HTML for editor initial content and for public render. */
export function sanitizeArticleBlockHtml(
  html: string,
  variant: ArticleBlockHtmlVariant,
): string {
  return sanitizeHtmlAllowlist(html, TAGS[variant], ALLOWED_ATTRS_BY_VARIANT[variant]);
}

export function articleBlockHtmlForEditor(
  raw: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const prepared = legacyPlainTextToEditorHtml(raw);
  return sanitizeArticleBlockHtml(prepared, variant);
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractHtmlAttribute(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decodeHtmlAttribute(match[1]) : "";
}

function renderInlineQuoteBlocks(html: string): string {
  return html.replace(
    /<div\b([^>]*)data-type="quote-block"([^>]*)>([\s\S]*?)<\/div>/gi,
    (_full, beforeAttrs, afterAttrs, innerHtml) => {
      const attrs = `${beforeAttrs ?? ""} ${afterAttrs ?? ""}`;
      const author = extractHtmlAttribute(attrs, "data-author").trim();
      const authorRole = extractHtmlAttribute(attrs, "data-author-role").trim();
      const footer =
        author || authorRole
          ? `<footer style="margin-top:14px;font-size:13px;line-height:1.4;font-weight:400;opacity:.68;font-family:var(--font-sans),system-ui,sans-serif;">${
              author ? `<span>&mdash; ${escapeHtml(author)}</span>` : ""
            }${
              author && authorRole ? `<span style="margin:0 8px;">&middot;</span>` : ""
            }${authorRole ? `<span>${escapeHtml(authorRole)}</span>` : ""}</footer>`
          : "";

      return `<blockquote style="display:flex;gap:20px;margin:32px 0;padding:0;"><div style="width:3px;flex-shrink:0;align-self:stretch;border-radius:999px;background:var(--primary);"></div><div style="min-width:0;flex:1;padding-block:4px;"><div style="font-style:italic;">${innerHtml}</div>${footer}</div></blockquote>`;
    },
  );
}

export function articleBlockHtmlForPublic(
  raw: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const sanitized = articleBlockHtmlForEditor(raw, variant);
  if (variant === "quote") return sanitized;
  return renderInlineQuoteBlocks(sanitized);
}
