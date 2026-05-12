"use client";

import { RichContentRenderer } from "@/components/content/RichContentRenderer";

interface OfferRichDescriptionProps {
  htmlContent: string;
}

/**
 * Rich Description Block
 * Airbnb/Notion typography style
 * Bullet list items получают orange dot через prose-li
 */
export function OfferRichDescription({ htmlContent }: OfferRichDescriptionProps) {
  if (!htmlContent || htmlContent.trim() === "") return null;

  return (
    <section className="space-y-4">
      <h2 className="text-[22px] font-bold text-gray-900 lg:text-[24px]">О предложении</h2>

      <div className="max-w-[680px]">
        <RichContentRenderer
          html={htmlContent}
          className={[
            "prose prose-neutral max-w-none",
            // Paragraphs
            "prose-p:text-[15px] prose-p:leading-[1.75] prose-p:text-gray-600 prose-p:my-4",
            "[&>p:first-child]:mt-0 [&>p:last-child]:mb-0",
            // Lists — orange bullet dots
            "prose-ul:my-4 prose-ul:space-y-2",
            "prose-li:text-[15px] prose-li:leading-[1.65] prose-li:text-gray-600",
            "[&_ul>li]:relative [&_ul>li]:pl-5",
            "[&_ul>li::before]:absolute [&_ul>li::before]:left-0 [&_ul>li::before]:top-[0.55em]",
            "[&_ul>li::before]:h-1.5 [&_ul>li::before]:w-1.5 [&_ul>li::before]:rounded-full",
            "[&_ul>li::before]:bg-[#EF8759]",
            "[&_ul>li::before]:content-['']",
            // Headings
            "prose-h3:text-[18px] prose-h3:font-bold prose-h3:text-gray-900 prose-h3:mt-8 prose-h3:mb-3",
            "prose-h4:text-[16px] prose-h4:font-bold prose-h4:text-gray-900 prose-h4:mt-6 prose-h4:mb-2",
            // Strong / links
            "prose-strong:text-gray-900 prose-strong:font-semibold",
            "prose-a:text-[#EF8759] prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
          ].join(" ")}
        />
      </div>
    </section>
  );
}
