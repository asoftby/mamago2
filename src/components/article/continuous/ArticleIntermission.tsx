"use client";

import { ContentEmojiRating } from "@/components/content/ContentEmojiRating";
import {
  ArticleTelegramInvitation,
  type ArticleTelegramInvitationAnalytics,
} from "@/components/article/continuous/ArticleTelegramInvitation";
import { postProductTelemetryEvent } from "@/lib/analytics/client";
import type { EmojiRatingType } from "@/lib/content-rating/emojiRating";
import { cn } from "@/lib/utils";

export type ArticleIntermissionArticle = {
  id: string;
  slug: string;
};

export type ArticleIntermissionProps = {
  article: ArticleIntermissionArticle;
  analytics: ArticleTelegramInvitationAnalytics;
  className?: string;
  /** Показать подпись перед следующей статьёй */
  showNextLabel?: boolean;
};

export function ArticleIntermission({
  article,
  analytics,
  className,
  showNextLabel = true,
}: ArticleIntermissionProps) {
  const onRate = (type: EmojiRatingType) => {
    void postProductTelemetryEvent({
      eventType: "CTA_CLICK",
      entityType: "ARTICLE",
      entityId: article.id,
      vertical: "CITY",
      cityId: analytics.cityId ?? undefined,
      citySlug: analytics.citySlug ?? undefined,
      meta: {
        source: "detail",
        section: "journal",
        articleEvent: "article_rating_submitted",
        articleSlug: article.slug,
        sectionId: analytics.sectionId ?? null,
        sectionSlug: analytics.sectionSlug ?? null,
        position: analytics.sessionPosition,
        ratingType: type,
      },
    });
  };

  return (
    <div
      className={cn(
        "not-prose max-w-3xl mx-auto px-4 sm:px-6",
        className,
      )}
      data-article-intermission={article.id}
    >
      <ArticleTelegramInvitation analytics={analytics} />

      <ContentEmojiRating
        entityType="ARTICLE"
        entityId={article.id}
        title="Была полезна статья?"
        getPath={`/api/articles/ratings/${article.id}`}
        postPath="/api/articles/rate"
        postBodyKey="articleId"
        onRate={onRate}
      />

      <div
        className={cn(
          "pb-12 md:pb-20",
          showNextLabel && "pt-2",
        )}
        aria-hidden={!showNextLabel}
      >
        {showNextLabel ? (
          <p className="text-center text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground/80">
            Следующая статья
          </p>
        ) : null}
      </div>
    </div>
  );
}
