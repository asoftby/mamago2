import {
  looksLikeHtml,
  prepareRichContentHtml,
} from "@/components/content/richContentHtml";
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

  const normalized = looksLikeHtml(content)
    ? content
    : formatDescriptionText(content) || content;

  return prepareRichContentHtml(normalized);
}
