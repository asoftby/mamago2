"use client";

import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import type { ArticleSaveStatus } from "@/features/save/ArticleSaveHeart";
import { useArticleSaveStatusBatch } from "@/features/save/useArticleSaveStatusBatch";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { journalTypeFilterHref, type JournalTypeFilter } from "@/lib/journal/journalCardMeta";
import { JournalFeedGridCard, JournalFeedRow, JournalMobileCard } from "./JournalCards";

/**
 * The journal's single responsive article feed, reused on journal and topic pages.
 * Its mobile, tablet and desktop presentations are the existing journal designs.
 */
export function JournalFeedCards({
  articles,
  saveStatuses,
  citySlug,
  blogHref,
  typeFilter = null,
  trackingSection = "journal",
}: {
  articles: CityHomeJournalArticle[];
  saveStatuses: Record<string, ArticleSaveStatus>;
  citySlug?: string;
  blogHref: string;
  typeFilter?: JournalTypeFilter | null;
  trackingSection?: string;
}) {
  const typeHref = (type: JournalTypeFilter) => journalTypeFilterHref(blogHref, type);

  return (
    <>
          <div className="flex flex-col gap-12 pt-5 md:hidden">
            {articles.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: trackingSection, block: "feed-mobile", position: index + 1 }}
              >
                <JournalMobileCard article={article} index={index + 1} saveStatus={saveStatuses[article.id]} />
              </AnalyticsCardViewTracker>
            ))}
          </div>
          <div className="hidden border-b border-border md:block lg:hidden">
            {articles.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: trackingSection, block: "feed", position: index + 1 }}
              >
                <JournalFeedRow
                  article={article}
                  index={index + 1}
                  saveStatus={saveStatuses[article.id]}
                  typeHref={
                    article.publicationType === "BREAKING_NEWS"
                      ? typeHref("BREAKING_NEWS")
                      : article.publicationType === "COLLECTION" && typeFilter !== "COLLECTION"
                        ? typeHref("COLLECTION")
                        : null
                  }
                />
              </AnalyticsCardViewTracker>
            ))}
          </div>
          <div className="hidden grid-cols-4 gap-x-6 gap-y-12 pt-4 lg:grid">
            {articles.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: trackingSection, block: "feed-grid", position: index + 1 }}
              >
                <JournalFeedGridCard
                  article={article}
                  index={index + 1}
                  saveStatus={saveStatuses[article.id]}
                  typeHref={
                    article.publicationType === "BREAKING_NEWS"
                      ? typeHref("BREAKING_NEWS")
                      : article.publicationType === "COLLECTION" && typeFilter !== "COLLECTION"
                        ? typeHref("COLLECTION")
                        : null
                  }
                />
              </AnalyticsCardViewTracker>
            ))}
          </div>
    </>
  );
}

/** Batch-save status for topic landing pages; the journal already owns its batch. */
export function JournalTaggedFeed({
  articles,
  citySlug,
  blogHref,
}: {
  articles: CityHomeJournalArticle[];
  citySlug: string;
  blogHref: string;
}) {
  const saveStatuses = useArticleSaveStatusBatch(articles.map((article) => article.id));
  return (
    <JournalFeedCards
      articles={articles}
      saveStatuses={saveStatuses}
      citySlug={citySlug}
      blogHref={blogHref}
      trackingSection="journal-tag"
    />
  );
}
