"use client";

/**
 * RichContentCollapsible
 *
 * Expandable/collapsible rich text block for public pages.
 * Generic version of EventRichDescription — works for Places, Offers, Events.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichContentRenderer } from "./RichContentRenderer";

interface RichContentCollapsibleProps {
  html: string;
  /** Section heading shown above the content */
  heading?: string;
  /** Collapsed height in px before "Read more" appears. Default: 240 */
  collapsedHeight?: number;
  className?: string;
}

export function RichContentCollapsible({
  html,
  heading,
  collapsedHeight = 240,
  className,
}: RichContentCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsToggle(contentRef.current.scrollHeight > collapsedHeight + 20);
    }
  }, [html, collapsedHeight]);

  if (!html) return null;

  return (
    <section className={cn("border-t border-border/40 py-8", className)}>
      {heading && (
        <h2 className="mb-5 font-sans text-xl font-semibold text-foreground">
          {heading}
        </h2>
      )}

      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
          )}
          style={{
            maxHeight: !isExpanded && needsToggle ? collapsedHeight : undefined,
          }}
        >
          <RichContentRenderer html={html} />
        </div>

        {/* Fade gradient when collapsed */}
        {!isExpanded && needsToggle && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background via-background/80 to-transparent"
            aria-hidden
          />
        )}
      </div>

      {needsToggle && (
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              Свернуть <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Читать полностью <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </section>
  );
}
