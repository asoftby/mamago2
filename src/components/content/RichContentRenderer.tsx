/**
 * RichContentRenderer
 *
 * Unified, SSR-safe renderer for rich text HTML produced by RichDescriptionEditor / Tiptap.
 *
 * Features:
 * - Allowlist-based HTML sanitization (no jsdom / DOMPurify dependency)
 * - Consistent editorial typography via Tailwind prose
 * - Works in Server Components and Client Components
 * - Handles plain-text fallback (whitespace-pre-wrap)
 * - Expandable/collapsible for long content
 *
 * Usage:
 *   <RichContentRenderer html={place.description} />
 *   <RichContentRenderer html={offer.description} collapsible />
 */

import { cn } from "@/lib/utils";
import { sanitizeHtmlAllowlist } from "@/lib/article/articleBlockHtml";

// Tags and attributes allowed from our Tiptap editor output
const ALLOWED_TAGS = [
  "p", "br",
  "h2", "h3",
  "strong", "b", "em", "i",
  "ul", "ol", "li",
  "hr",
  "a",
];

const ALLOWED_ATTRS = ["href", "target", "rel"];

/**
 * Detect whether a string looks like HTML (has tags).
 * Used to decide between rich rendering and plain-text fallback.
 */
function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test((text ?? "").trim());
}

/**
 * Sanitize HTML from our Tiptap editor.
 * Safe to call on both server and client.
 */
export function sanitizeRichContent(html: string): string {
  if (!html) return "";
  return sanitizeHtmlAllowlist(html, ALLOWED_TAGS, ALLOWED_ATTRS);
}

// ─── Prose class set ─────────────────────────────────────────────────────────

const PROSE_CLASSES = cn(
  "prose prose-sm max-w-none",
  // Headings
  "prose-headings:font-sans prose-headings:font-semibold prose-headings:text-foreground",
  "prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3",
  "prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2",
  // Paragraphs
  "prose-p:text-[15px] prose-p:leading-[1.75] prose-p:text-foreground prose-p:my-4",
  // Lists
  "prose-ul:text-[15px] prose-ul:text-foreground prose-ul:my-4 prose-ul:pl-5",
  "prose-ol:text-[15px] prose-ol:text-foreground prose-ol:my-4 prose-ol:pl-5",
  "prose-li:mb-1.5 prose-li:leading-[1.7]",
  "prose-ul:list-disc prose-ol:list-decimal",
  "prose-li:marker:text-muted-foreground",
  // Bold / Italic
  "prose-strong:font-semibold prose-strong:text-foreground",
  "prose-em:text-foreground/80",
  // Links
  "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
  // HR
  "prose-hr:border-border prose-hr:my-6",
);

// ─── Non-collapsible renderer ─────────────────────────────────────────────────

interface RichContentRendererProps {
  html: string;
  className?: string;
}

/**
 * Renders sanitized rich HTML with editorial prose styling.
 * Can be used in Server Components (no "use client" needed).
 */
export function RichContentRenderer({ html, className }: RichContentRendererProps) {
  if (!html) return null;

  const isHtml = looksLikeHtml(html);

  if (!isHtml) {
    // Plain text fallback — preserve line breaks
    return (
      <p
        className={cn("text-[15px] leading-[1.75] text-foreground whitespace-pre-wrap", className)}
      >
        {html}
      </p>
    );
  }

  const safe = sanitizeRichContent(html);

  return (
    <div
      className={cn(PROSE_CLASSES, "rich-rendered-html", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

// ─── Collapsible renderer ─────────────────────────────────────────────────────

/**
 * Collapsible version — same as EventRichDescription but generic.
 * Use this on public pages where descriptions can be long.
 */
export { RichContentCollapsible } from "./RichContentCollapsible";
