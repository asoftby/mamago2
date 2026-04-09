import DOMPurify from "isomorphic-dompurify";

export type ArticleBlockHtmlVariant = "intro" | "text" | "quote";

const TAGS: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: ["p", "br", "strong", "b", "em", "i"],
  text: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
  quote: ["p", "br", "em", "i"],
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

/** Safe HTML for editor initial content and for public render. */
export function sanitizeArticleBlockHtml(
  html: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const allowAttrs =
    variant === "text" ? ["href", "target", "rel", "class", "data-sponsored"] : [];

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS[variant],
    ALLOWED_ATTR: allowAttrs,
    ALLOW_DATA_ATTR: false,
  });
}

export function articleBlockHtmlForEditor(
  raw: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const prepared = legacyPlainTextToEditorHtml(raw);
  return sanitizeArticleBlockHtml(prepared, variant);
}
