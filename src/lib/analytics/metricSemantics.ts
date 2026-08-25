export type BehaviorCounterDelta = {
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  cta: number;
};

const ARTICLE_READING_PSEUDO_CTA_EVENTS = new Set([
  "article_read_25",
  "article_read_50",
  "article_read_75",
  "article_complete",
  "next_article_loaded",
  "article_section_exhausted",
]);

function asMetaRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

/**
 * Legacy continuous-reading milestones are transported as CTA_CLICK today,
 * but they are reading telemetry rather than user CTA activations.
 */
export function isArticleReadingPseudoCta(meta: unknown): boolean {
  const record = asMetaRecord(meta);
  const articleEvent = record?.articleEvent;
  return (
    typeof articleEvent === "string" &&
    ARTICLE_READING_PSEUDO_CTA_EVENTS.has(articleEvent)
  );
}

/**
 * Extract a real taxonomy category key when trackers provide one.
 * Entity type (EVENT/PLACE/OFFER/ARTICLE) is deliberately not a category.
 */
export function getAnalyticsCategoryKey(meta: unknown): string | null {
  const record = asMetaRecord(meta);
  if (!record) return null;

  for (const key of ["categorySlug", "eventCategorySlug", "categoryId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Contract v1: product "views" in legacy profile/report fields mean card impressions only. */
export function behaviorCounterDelta(
  eventType: string,
  meta?: unknown,
): BehaviorCounterDelta {
  switch (eventType) {
    case "PAGE_VIEW":
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
    case "CARD_VIEW":
      return { views: 1, opens: 0, saves: 0, planAdds: 0, cta: 0 };
    case "DETAIL_OPEN":
      return { views: 0, opens: 1, saves: 0, planAdds: 0, cta: 0 };
    case "SAVE":
      return { views: 0, opens: 0, saves: 1, planAdds: 0, cta: 0 };
    case "PLAN_ADD":
      return { views: 0, opens: 0, saves: 0, planAdds: 1, cta: 0 };
    case "CTA_CLICK":
      return {
        views: 0,
        opens: 0,
        saves: 0,
        planAdds: 0,
        cta: isArticleReadingPseudoCta(meta) ? 0 : 1,
      };
    default:
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
  }
}

export function isCanonicalCtaClick(eventType: string, meta?: unknown): boolean {
  return eventType === "CTA_CLICK" && !isArticleReadingPseudoCta(meta);
}

export function isCardImpression(eventType: string): boolean {
  return eventType === "CARD_VIEW";
}
