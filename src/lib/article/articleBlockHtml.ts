/**
 * Санитизация HTML блоков статьи.
 *
 * НЕ используем isomorphic-dompurify — он тянет jsdom на сервер,
 * а jsdom при инициализации читает .next/browser/default-stylesheet.css
 * которого нет в dev-режиме Next.js 16 + webpack → ENOENT 500.
 *
 * Вместо этого используем sanitize-html (server-safe, без DOM-зависимостей)
 * или встроенную замену на основе allowlist.
 */

export type ArticleBlockHtmlVariant = "intro" | "text" | "quote";

const TAGS: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: ["p", "br", "strong", "b", "em", "i"],
  text: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
  quote: ["p", "br", "em", "i"],
};

const ALLOWED_ATTRS_BY_VARIANT: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: [],
  text: ["href", "target", "rel", "class", "data-sponsored"],
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
 * Простая allowlist-санитизация без jsdom/DOMPurify.
 * Удаляет все теги кроме разрешённых, фильтрует атрибуты.
 * Достаточно для контента из нашего TipTap-редактора.
 *
 * Экспортируется для использования в articleEmbedSanitize.ts.
 */
export function sanitizeHtmlAllowlist(
  html: string,
  allowedTags: string[],
  allowedAttrs: string[],
): string {
  const tagSet = new Set(allowedTags.map((t) => t.toLowerCase()));
  const attrSet = new Set(allowedAttrs.map((a) => a.toLowerCase()));

  // Удаляем script/style/on* полностью включая содержимое
  let result = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Обрабатываем теги
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!tagSet.has(tag)) {
      // Запрещённый тег — убираем
      return "";
    }

    // Самозакрывающийся или закрывающий тег без атрибутов
    if (match.startsWith("</")) {
      return `</${tag}>`;
    }

    // Фильтруем атрибуты
    if (attrSet.size === 0) {
      return `<${tag}>`;
    }

    const filteredAttrs = attrs.replace(
      /\s([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/g,
      (attrMatch, attrName: string) => {
        const attr = attrName.toLowerCase();
        if (!attrSet.has(attr)) return "";
        // Блокируем javascript: в href
        if (attr === "href") {
          const valMatch = attrMatch.match(/=\s*["']?([^"'\s>]*)["']?/);
          if (valMatch) {
            const val = valMatch[1].trim().toLowerCase().replace(/\s/g, "");
            if (val.startsWith("javascript:") || val.startsWith("data:")) return "";
          }
        }
        return attrMatch;
      },
    );

    return `<${tag}${filteredAttrs}>`;
  });

  return result;
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
