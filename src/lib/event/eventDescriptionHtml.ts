import {
  looksLikeHtml,
  sanitizeRichContent,
} from "@/components/content/richContentHtml";
import { legacyPlainTextToEditorHtml } from "@/lib/article/articleBlockHtml";
import { formatDescriptionText } from "@/lib/text/formatDescription";

/**
 * Event descriptions come from two sources:
 * - TipTap/editor HTML, whose structure must be preserved verbatim (after sanitizing);
 * - legacy/imported plain text, which may arrive as one long wall of text.
 *
 * Only the plain-text path is editorially normalized. Existing rich HTML is
 * never rewritten by the text formatter.
 */
export function prepareEventDescriptionHtml(content: string): string {
  if (!content) return "";

  if (looksLikeHtml(content)) {
    return sanitizeRichContent(content);
  }

  const normalized = formatDescriptionText(content) || content;

  // The shared legacy converter intentionally wraps the whole input into one
  // <p> and turns every newline into <br>. Event formatting, however, uses
  // blank lines as semantic paragraph boundaries, so convert each normalized
  // block independently and preserve single newlines inside a block as <br>.
  const html = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => legacyPlainTextToEditorHtml(block))
    .join("");

  return sanitizeRichContent(html);
}
