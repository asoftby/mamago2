"use client";

import { postProductTelemetryEvent } from "@/lib/analytics/client";
import type { ArticleAnalyticsKind } from "@/lib/article/continuousReadingState";
import { analyticsEventKey } from "@/lib/article/continuousReadingState";

export type ContinuousAnalyticsContext = {
  cityId: string | null;
  citySlug: string | null;
  sectionId: string | null;
  sectionSlug: string | null;
  sourceArticleId: string;
  sessionPosition: number;
  previousArticleId: string | null;
};

/**
 * События непрерывного чтения через существующий UserEvent pipeline.
 * Имена из ТЗ живут в meta.articleEvent (enum UserEventType не расширяем).
 */
export function createContinuousAnalyticsTracker() {
  const fired = new Set<string>();

  function track(
    kind: ArticleAnalyticsKind,
    articleId: string,
    articleSlug: string,
    ctx: ContinuousAnalyticsContext,
    extra?: Record<string, unknown>,
  ) {
    const key = analyticsEventKey(kind, articleId);
    if (fired.has(key)) return;
    fired.add(key);

    const eventType =
      kind === "article_impression"
        ? ("CARD_VIEW" as const)
        : kind === "article_view" || kind === "next_article_started"
          ? ("DETAIL_OPEN" as const)
          : ("CTA_CLICK" as const);

    void postProductTelemetryEvent({
      eventType,
      entityType: "ARTICLE",
      entityId: articleId,
      vertical: "CITY",
      cityId: ctx.cityId,
      citySlug: ctx.citySlug,
      meta: {
        source: "detail",
        section: "journal",
        articleEvent: kind,
        articleSlug,
        sectionId: ctx.sectionId,
        sectionSlug: ctx.sectionSlug,
        position: ctx.sessionPosition,
        sourceArticleId: ctx.sourceArticleId,
        previousArticleId: ctx.previousArticleId,
        ...extra,
      },
    });
  }

  return { track, has: (kind: ArticleAnalyticsKind, id: string) => fired.has(analyticsEventKey(kind, id)) };
}
