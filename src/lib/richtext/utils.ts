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
