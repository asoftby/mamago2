import {
  looksLikeHtml,
  sanitizeRichContent,
} from "@/components/content/richContentHtml";
import { legacyPlainTextToEditorHtml } from "@/lib/article/articleBlockHtml";

const LONG_PLAIN_TEXT_CHUNK_CHARS = 420;
const LONG_PLAIN_TEXT_CHUNK_SENTENCES = 4;

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitLongPlainBlock(block: string): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];

  // Explicit single newlines may represent lists or deliberate line layout.
  // Preserve them inside one paragraph; the legacy converter renders them as <br>.
  if (trimmed.includes("\n") || trimmed.length < LONG_PLAIN_TEXT_CHUNK_CHARS) {
    return [trimmed];
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length <= LONG_PLAIN_TEXT_CHUNK_SENTENCES) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    current.push(sentence);
    const currentText = current.join(" ");

    if (
      current.length >= LONG_PLAIN_TEXT_CHUNK_SENTENCES ||
      currentText.length >= LONG_PLAIN_TEXT_CHUNK_CHARS
    ) {
      chunks.push(currentText);
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

function splitPlainEventParagraphs(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .flatMap((block) => splitLongPlainBlock(block));
}

/**
 * Event descriptions come from two sources:
 * - TipTap/editor HTML, whose structure must be preserved verbatim (after sanitizing);
 * - legacy/imported plain text, which may arrive as one long wall of text.
 *
 * Plain text is only split into readable paragraphs. Its wording and metadata
 * are never editorially rewritten at render time.
 */
export function prepareEventDescriptionHtml(content: string): string {
  if (!content) return "";

  if (looksLikeHtml(content)) {
    return sanitizeRichContent(content);
  }

  const html = splitPlainEventParagraphs(content)
    .map((block) => legacyPlainTextToEditorHtml(block))
    .join("");

  return sanitizeRichContent(html);
}
