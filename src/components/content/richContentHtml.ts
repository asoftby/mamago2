/**
 * Pure HTML sanitization/preparation helpers for rich text content.
 *
 * Deliberately has no CSS or React imports: server-only code (e.g.
 * buildEventPageDataFromPrisma.ts) and plain Node test runners (tsx) import
 * this module directly. RichContentRenderer.tsx re-exports from here for
 * JSX consumers and additionally pulls in the renderer's own stylesheet.
 */

import {
  legacyPlainTextToEditorHtml,
  sanitizeHtmlAllowlist,
} from "@/lib/article/articleBlockHtml";

// Tags and attributes allowed from our Tiptap editor output and legacy rich HTML.
const ALLOWED_TAGS = [
  "p", "br", "div",
  "h2", "h3",
  "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "blockquote", "hr",
  "a",
];

const ALLOWED_ATTRS = ["href", "target", "rel"];

/**
 * Detect whether a string looks like HTML (has tags).
 * Used to decide between rich rendering and plain-text fallback.
 */
export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test((text ?? "").trim());
}

/**
 * Sanitize HTML from our Tiptap editor using the shared parser-based allowlist.
 * Safe to call on both server and client.
 */
export function sanitizeRichContent(html: string): string {
  if (!html) return "";
  return sanitizeHtmlAllowlist(html, ALLOWED_TAGS, ALLOWED_ATTRS);
}

/**
 * Prepare content for rich public rendering.
 *
 * Legacy events may still contain plain text instead of TipTap HTML. Converting
 * that text before sanitization preserves line breaks while escaping markup.
 */
export function prepareRichContentHtml(content: string): string {
  if (!content) return "";
  const prepared = looksLikeHtml(content)
    ? content
    : legacyPlainTextToEditorHtml(content);
  return sanitizeRichContent(prepared);
}
