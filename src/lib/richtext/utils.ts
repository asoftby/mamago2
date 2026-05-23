/**
 * Rich Text Utilities
 * Helper functions for working with HTML content from TipTap editor
 */

/**
 * Extract plain text from HTML string
 * Removes all HTML tags and returns clean text
 */
export function extractPlainTextFromHtml(html: string): string {
  if (!html) return "";

  const text = html.replace(/<[^>]*>/g, "");

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value.trim();
  }

  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract plain text lines from rich HTML while preserving simple block breaks.
 * Useful when older UIs still expect line-based plain text.
 */
export function extractPlainTextLinesFromHtml(html: string): string[] {
  if (!html) return [];

  const normalized = html
    .replace(/<(br|br\/)\s*>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h2|h3|hr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");

  const text = extractPlainTextFromHtml(normalized);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Check if rich text HTML contains meaningful content
 * Returns false for empty strings, empty tags, or only whitespace
 */
export function isRichTextMeaningful(html: string): boolean {
  if (!html) return false;
  
  // Extract plain text
  const plainText = extractPlainTextFromHtml(html);
  
  // Check if there's actual text content
  return plainText.length > 0;
}

/**
 * Get character count from HTML content
 * Counts only visible text characters, not HTML tags
 */
export function getRichTextLength(html: string): number {
  const plainText = extractPlainTextFromHtml(html);
  return plainText.length;
}

/**
 * Create a plain text excerpt from HTML
 * Useful for previews and summaries
 */
export function createExcerpt(html: string, maxLength: number = 100): string {
  const plainText = extractPlainTextFromHtml(html);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.slice(0, maxLength).trim() + "...";
}

/**
 * TODO: Sanitize HTML for safe public rendering
 * 
 * This function should be implemented before rendering user-generated
 * HTML content on public pages. Consider using a library like DOMPurify
 * or implementing server-side sanitization.
 * 
 * For now, this is a placeholder that returns the HTML as-is.
 * DO NOT use this for public rendering without proper sanitization!
 */
export function sanitizeHtml(html: string): string {
  // TODO: Implement proper HTML sanitization
  // Options:
  // 1. Use DOMPurify library (client-side)
  // 2. Use sanitize-html library (server-side)
  // 3. Implement custom whitelist-based sanitizer
  
  console.warn("sanitizeHtml: HTML sanitization not yet implemented!");
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAiListParagraph(paragraph: string): string {
  const trimmed = paragraph.trim();
  if (!trimmed) return trimmed;

  if (/:\s*[—\-•*]\s+/.test(trimmed)) {
    const match = trimmed.match(/^(.*?):\s*[—\-•*]\s+([\s\S]+)$/);
    if (!match) return trimmed;

    const heading = `${match[1]!.trim()}:`;
    const items = match[2]!
      .split(/\s+[—\-•*]\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (items.length === 0) return trimmed;
    return [heading, ...items.map((item) => `— ${item}`)].join("\n");
  }

  const inlineBulletCount = (trimmed.match(/\s[—\-•*]\s+/g) || []).length;
  if (inlineBulletCount >= 2 && !trimmed.includes("\n")) {
    return trimmed.replace(/\s+[—\-•*]\s+/g, "\n— ");
  }

  return trimmed;
}

function blockToHtml(block: string): string {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const firstBulletIndex = lines.findIndex((line) => /^[—\-•*]\s+/.test(line));
  const allLinesAreBullets = lines.every((line) => /^[—\-•*]\s+/.test(line));

  if (allLinesAreBullets) {
    const items = lines
      .map((line) => line.replace(/^[—\-•*]\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (firstBulletIndex > 0) {
    const lead = lines
      .slice(0, firstBulletIndex)
      .map((line) => escapeHtml(line))
      .join("<br />");
    const items = lines
      .slice(firstBulletIndex)
      .map((line) => line.replace(/^[—\-•*]\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    return `<p>${lead}</p><ul>${items}</ul>`;
  }

  return `<p>${escapeHtml(lines.join("\n")).replace(/\n/g, "<br />")}</p>`;
}

export function plainTextToRichTextHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "<p></p>";

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => normalizeAiListParagraph(paragraph))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "<p></p>";

  return paragraphs.map(blockToHtml).filter(Boolean).join("") || "<p></p>";
}

export function normalizeRichTextEditorValue(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";
  return /<[a-z][\s\S]*>/i.test(normalized)
    ? normalized
    : plainTextToRichTextHtml(normalized);
}
