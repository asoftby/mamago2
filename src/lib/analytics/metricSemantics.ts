export type BehaviorCounterDelta = {
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  cta: number;
};

const ARTICLE_NON_CTA_EVENTS = new Set([
  "article_read_25",
  "article_read_50",
  "article_read_75",
  "article_complete",
  "next_article_loaded",
  "article_section_exhausted",
  "article_rating_submitted",
]);

const ARTICLE_NON_CONTENT_CARD_IMPRESSIONS = new Set([
  "article_telegram_cta_impression",
]);

function asMetaRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

function getArticleEvent(meta: unknown): string | null {
  const articleEvent = asMetaRecord(meta)?.articleEvent;
  return typeof articleEvent === "string" && articleEvent.trim()
    ? articleEvent.trim()
    : null;
}

/**
 * Legacy article interactions can be transported as CTA_CLICK today, but only
 * intentional conversion/navigation CTA activations belong in the CTA KPI.
 */
export function isArticleNonCtaInteraction(meta: unknown): boolean {
  const articleEvent = getArticleEvent(meta);
  return articleEvent != null && ARTICLE_NON_CTA_EVENTS.has(articleEvent);
}

/** Backward-compatible semantic alias used by existing tests/callers. */
export const isArticleReadingPseudoCta = isArticleNonCtaInteraction;

/**
 * Some article UI blocks use CARD_VIEW as a transport event for their own
 * impression. Those must not inflate content-card impression metrics.
 */
export function isNonContentCardImpression(meta: unknown): boolean {
  const articleEvent = getArticleEvent(meta);
  return (
    articleEvent != null &&
    ARTICLE_NON_CONTENT_CARD_IMPRESSIONS.has(articleEvent)
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

/** Contract v1: product "views" in legacy profile/report fields mean content card impressions only. */
export function behaviorCounterDelta(
  eventType: string,
  meta?: unknown,
): BehaviorCounterDelta {
  switch (eventType) {
    case "PAGE_VIEW":
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
    case "CARD_VIEW":
      return {
        views: isNonContentCardImpression(meta) ? 0 : 1,
        opens: 0,
        saves: 0,
        planAdds: 0,
        cta: 0,
      };
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
        cta: isArticleNonCtaInteraction(meta) ? 0 : 1,
      };
    default:
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
  }
}

export function isCanonicalCtaClick(eventType: string, meta?: unknown): boolean {
  return eventType === "CTA_CLICK" && !isArticleNonCtaInteraction(meta);
}

export function isCardImpression(eventType: string, meta?: unknown): boolean {
  return eventType === "CARD_VIEW" && !isNonContentCardImpression(meta);
}
