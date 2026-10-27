"use client";

import Link from "next/link";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { useArticleSaveStatusBatch } from "@/features/save/useArticleSaveStatusBatch";
import {
  JOURNAL_TYPE_FILTER_TITLE,
  journalTypeFilterHref,
  type JournalTypeFilter,
} from "@/lib/journal/journalCardMeta";
import { JournalFeedGridCard, JournalFeedRow, JournalMainCard, JournalNewsCard } from "./JournalCards";
import { JournalCollectionsCarousel } from "./JournalCollectionsCarousel";

const NEWS_CARD_SHELL = "shrink-0 snap-start w-[64vw] min-w-[200px] max-w-[280px] lg:w-[calc((100%-6rem)/5)] lg:max-w-none";

/**
 * Страница журнала: H1 + подзаголовок → «Главное» → «Новости» → «Подборки mamaGo»
 * → «Свежие материалы». Каждый пустой блок скрыт целиком. Чипы рубрик — в layout.
 */
export function JournalPageView({
  title,
  subtitle,
  main,
  news,
  collections,
  feed,
  typeFilter,
  basePath,
  citySlug,
  intro,
}: {
  title: string;
  subtitle: string;
  main: CityHomeJournalArticle | null;
  news: CityHomeJournalArticle[];
  collections: CityHomeJournalArticle[];
  feed: CityHomeJournalArticle[];
  typeFilter: JournalTypeFilter | null;
  /** Путь страницы (с query рубрики/темы, без type/page): «Все →» и «Смотреть все →» добавляют `?type=`. */
  basePath: string;
  citySlug?: string;
  /** Доп. контент под заголовком (подрубрики/темы на странице рубрики). */
  intro?: React.ReactNode;
}) {
  const typeHref = (type: JournalTypeFilter) => journalTypeFilterHref(basePath, type);
  const resetHref = basePath;
  const saveStatuses = useArticleSaveStatusBatch([...(main ? [main.id] : []), ...feed.map((a) => a.id)]);
  const empty = !main && news.length === 0 && collections.length === 0 && feed.length === 0;

  return (
    <div className="site-wrap space-y-10 px-4 pb-16 pt-6 sm:space-y-14 sm:px-7 sm:pt-10">
      <header className="space-y-3">
        <h1 className="m-0 font-heading text-[34px] leading-[.98] tracking-[-0.03em] sm:text-[40px]">
          {typeFilter ? JOURNAL_TYPE_FILTER_TITLE[typeFilter] : title}
        </h1>
        <p className="max-w-3xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
          {typeFilter ? (
            <Link href={resetHref} className="inline-flex min-h-11 items-center font-semibold text-brand-ink hover:underline">
              ← Все материалы
            </Link>
          ) : subtitle}
        </p>
        {intro}
      </header>

      {main ? (
        <section aria-label="Главное">
          <AnalyticsCardViewTracker
            entityType="ARTICLE"
            entityId={main.id}
            vertical="CITY"
            citySlug={citySlug}
            meta={{ section: "journal", block: "main", position: 0 }}
          >
            <JournalMainCard article={main} saveStatus={saveStatuses[main.id]} />
          </AnalyticsCardViewTracker>
        </section>
      ) : null}

      {news.length > 0 ? (
        <section aria-labelledby="journal-news-title" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="journal-news-title" className="m-0 font-heading text-[24px] leading-tight tracking-[-0.02em] sm:text-[28px]">
              Новости
            </h2>
            <Link
              href={typeHref("BREAKING_NEWS")}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand-ink hover:underline"
            >
              Все →
            </Link>
          </div>
          <HorizontalCardRow>
            {news.map((article, index) => (
              <div key={article.id} className={NEWS_CARD_SHELL}>
                <AnalyticsCardViewTracker
                  entityType="ARTICLE"
                  entityId={article.id}
                  vertical="CITY"
                  citySlug={citySlug}
                  meta={{ section: "journal", block: "news", position: index }}
                >
                  <JournalNewsCard article={article} />
                </AnalyticsCardViewTracker>
              </div>
            ))}
          </HorizontalCardRow>
        </section>
      ) : null}

      <JournalCollectionsCarousel
        collections={collections}
        allHref={typeHref("COLLECTION")}
        citySlug={citySlug}
      />

      {feed.length > 0 ? (
        <section aria-labelledby="journal-feed-title" className="space-y-2">
          <h2 id="journal-feed-title" className="m-0 font-heading text-[24px] leading-tight tracking-[-0.02em] sm:text-[28px]">
            {typeFilter ? "Все материалы" : "Свежие материалы"}
          </h2>
          <div className="border-b border-border lg:hidden">
            {feed.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: "journal", block: "feed", position: index + 1 }}
              >
                <JournalFeedRow
                  article={article}
                  index={index + 1}
                  saveStatus={saveStatuses[article.id]}
                  typeHref={
                    article.publicationType === "BREAKING_NEWS" && typeFilter !== "BREAKING_NEWS"
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
            {feed.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: "journal", block: "feed-grid", position: index + 1 }}
              >
                <JournalFeedGridCard
                  article={article}
                  index={index + 1}
                  saveStatus={saveStatuses[article.id]}
                  typeHref={
                    article.publicationType === "BREAKING_NEWS" && typeFilter !== "BREAKING_NEWS"
                      ? typeHref("BREAKING_NEWS")
                      : article.publicationType === "COLLECTION" && typeFilter !== "COLLECTION"
                        ? typeHref("COLLECTION")
                        : null
                  }
                />
              </AnalyticsCardViewTracker>
            ))}
          </div>
          {typeFilter !== "BREAKING_NEWS" ? (
            <Link
              href={typeHref("BREAKING_NEWS")}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink hover:underline"
            >
              Все новости →
            </Link>
          ) : null}
        </section>
      ) : null}

      {empty ? (
        <div className="py-12">
          <p className="text-sm text-muted-foreground">Здесь пока нет материалов.</p>
          {typeFilter ? (
            <Link href={resetHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Все материалы
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
