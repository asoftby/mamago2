"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EventRichDescriptionProps {
  /** HTML content from TipTap editor */
  htmlContent: string;
  /** Plain text fallback for preview */
  plainTextSummary?: string;
  /** Minimum height in pixels to show "Read more" button */
  collapsedHeight?: number;
  className?: string;
}

/**
 * Expandable/collapsible rich text description block.
 * 
 * Features:
 * - Single source of truth (no duplication)
 * - Preserves HTML formatting from editor
 * - Clean collapsed/expanded states
 * - Smooth animations
 * - Accessible keyboard navigation
 * - SSR-safe
 * - Handles edge cases (empty, short, long content)
 */
export function EventRichDescription({
  htmlContent,
  plainTextSummary,
  collapsedHeight = 120,
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
  }, [htmlContent, collapsedHeight]);

  // Edge case: no content at all
  if (!htmlContent && !plainTextSummary) {
    return null;
  }

  // Edge case: only plain text summary, no HTML
  const displayContent = htmlContent || `<p>${plainTextSummary || ""}</p>`;

  return (
    <section className={cn("border-t border-border/40 py-10", className)}>
      <h2 className="mb-6 font-headline text-2xl font-bold text-foreground">
        О событии
      </h2>

      <div className="relative">
        {/* Rich text content */}
        <div
          ref={contentRef}
          className={cn(
            // Base prose styles
            "prose prose-sm max-w-none",
            // Headings
            "prose-headings:font-headline prose-headings:font-semibold prose-headings:text-foreground",
            "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
            "prose-h1:mb-4 prose-h2:mb-3 prose-h3:mb-2",
            "prose-h1:mt-6 prose-h2:mt-5 prose-h3:mt-4",
            // Paragraphs
            "prose-p:text-[15px] prose-p:leading-relaxed prose-p:text-foreground",
            "prose-p:mb-4 last:prose-p:mb-0",
            // Links
            "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
            "prose-a:transition-colors",
            // Strong/Bold
            "prose-strong:font-semibold prose-strong:text-foreground",
            // Lists
            "prose-ul:text-[15px] prose-ul:text-foreground prose-ul:my-4",
            "prose-ol:text-[15px] prose-ol:text-foreground prose-ol:my-4",
            "prose-li:leading-relaxed prose-li:mb-2",
            "prose-ul:list-disc prose-ul:pl-6",
            "prose-ol:list-decimal prose-ol:pl-6",
            // Blockquotes
            "prose-blockquote:border-l-4 prose-blockquote:border-primary/30",
            "prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
            // Code
            "prose-code:text-[14px] prose-code:bg-accent prose-code:px-1.5 prose-code:py-0.5",
            "prose-code:rounded prose-code:font-mono",
            // Images
            "prose-img:rounded-xl prose-img:shadow-sm",
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
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent"
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
