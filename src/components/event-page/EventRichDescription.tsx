"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareEventDescriptionHtml } from "@/lib/event/eventDescriptionHtml";
import { cn } from "@/lib/utils";

interface EventRichDescriptionProps {
  /** HTML content from TipTap editor */
  htmlContent: string;
  /** Plain text fallback for preview */
  plainTextSummary?: string;
  /** Max height (px) of the collapsed block before «Читать полностью». */
  collapsedHeight?: number;
  className?: string;
}

/**
 * Expandable/collapsible rich text description block.
 *
 * Features:
 * - Single source of truth (no duplication)
 * - Preserves HTML formatting from editor
 * - Preserves legacy plain-text line breaks
 * - Clean collapsed/expanded states
 * - Smooth animations
 * - Accessible keyboard navigation
 * - SSR-safe
 * - Handles edge cases (empty, short, long content)
 */
export function EventRichDescription({
  htmlContent,
  plainTextSummary,
  collapsedHeight = 240,
  className,
}: EventRichDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content is tall enough to need expansion
  useEffect(() => {
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      setShouldShowButton(contentHeight > collapsedHeight + 20);
    }
  }, [htmlContent, plainTextSummary, collapsedHeight]);

  // Edge case: no content at all
  if (!htmlContent && !plainTextSummary) {
    return null;
  }

  const rawDisplay = htmlContent || plainTextSummary || "";
  const displayContent = prepareEventDescriptionHtml(rawDisplay);

  return (
    <section className={cn("border-t border-border/40 py-10", className)}>

      <div className="relative">
        {/* Rich text content */}
        <div
          ref={contentRef}
          className={cn(
            // Explicit descendant styles: public rendering must not depend on
            // @tailwindcss/typography, which is not part of the app bundle.
            "max-w-none text-[#141210]",
            // Headings
            "[&_h1]:mb-5 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-semibold",
            "[&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
            "[&_h3]:mb-3 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
            // Paragraphs
            "[&_p]:my-5 [&_p]:text-[15px] [&_p]:leading-8 [&_p]:text-[#141210]",
            "[&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_p+_p]:mt-6",
            // Links / emphasis
            "[&_a]:font-medium [&_a]:text-primary [&_a]:no-underline [&_a:hover]:underline",
            "[&_strong]:font-semibold [&_strong]:text-[#141210]",
            // Lists
            "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[15px] [&_ul]:text-[#141210]",
            "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-[15px] [&_ol]:text-[#141210]",
            "[&_li]:mb-2.5 [&_li]:leading-8 [&_li::marker]:text-[rgba(20,18,16,0.55)]",
            // Blockquotes
            "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30",
            "[&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[rgba(20,18,16,0.65)]",
            // Collapsed state
            !isExpanded && shouldShowButton && "overflow-hidden",
            // Smooth transition
            "transition-all duration-300 ease-in-out"
          )}
          style={{
            maxHeight: !isExpanded && shouldShowButton ? collapsedHeight : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />

        {/* Fade gradient when collapsed */}
        {!isExpanded && shouldShowButton && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Expand/Collapse button */}
      {shouldShowButton && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-6 gap-2 text-[14px] font-semibold text-primary hover:text-primary/80 hover:bg-primary/5"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Свернуть описание" : "Читать полностью"}
        >
          {isExpanded ? (
            <>
              Свернуть
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Читать полностью
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </section>
  );
}
