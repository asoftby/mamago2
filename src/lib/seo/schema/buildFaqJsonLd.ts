import type { FaqItem } from "@/lib/faq/faqItems";
import { normalizeFaqItems } from "@/lib/faq/faqItems";

export function buildFaqJsonLd(
  items: FaqItem[] | null | undefined,
): Record<string, unknown> | null {
  const normalizedItems = normalizeFaqItems(items);

  if (normalizedItems.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: normalizedItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
