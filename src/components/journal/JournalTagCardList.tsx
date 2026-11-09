"use client";

import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { useArticleSaveStatusBatch } from "@/features/save/useArticleSaveStatusBatch";
import { JournalFeedGridCard, JournalFeedRow, JournalMobileCard } from "./JournalCards";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";

/** Same Journal card components and save state as the main journal feed. */
export function JournalTagCardList({ articles, citySlug }: { articles: CityHomeJournalArticle[]; citySlug: string }) {
  const saveStatuses = useArticleSaveStatusBatch(articles.map(article => article.id));
  return (
    <>
      <div className="flex flex-col gap-10 md:hidden">
        {articles.map((article, index) => (
          <AnalyticsCardViewTracker key={article.id} entityType="ARTICLE" entityId={article.id}
            vertical="CITY" citySlug={citySlug} meta={{ section: "tag", block: "feed-mobile", position: index + 1 }}>
            <JournalMobileCard article={article} index={index + 1} saveStatus={saveStatuses[article.id]} />
          </AnalyticsCardViewTracker>
        ))}
      </div>
      <div className="hidden border-b border-border md:block lg:hidden">
        {articles.map((article, index) => (
          <AnalyticsCardViewTracker key={article.id} entityType="ARTICLE" entityId={article.id}
            vertical="CITY" citySlug={citySlug} meta={{ section: "tag", block: "feed", position: index + 1 }}>
            <JournalFeedRow article={article} index={index + 1} saveStatus={saveStatuses[article.id]} />
          </AnalyticsCardViewTracker>
        ))}
      </div>
      <div className="hidden grid-cols-4 gap-x-6 gap-y-12 lg:grid">
        {articles.map((article, index) => (
          <AnalyticsCardViewTracker key={article.id} entityType="ARTICLE" entityId={article.id}
            vertical="CITY" citySlug={citySlug} meta={{ section: "tag", block: "feed-grid", position: index + 1 }}>
            <JournalFeedGridCard article={article} index={index + 1} saveStatus={saveStatuses[article.id]} />
          </AnalyticsCardViewTracker>
        ))}
      </div>
    </>
  );
}
