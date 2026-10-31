"use client";

import Link from "next/link";
import { Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { orderBreakingNewsBySeen, readSeenBreakingNews } from "@/features/stories/lib/seen";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { useArticleSaveStatusBatch } from "@/features/save/useArticleSaveStatusBatch";
import {
  JOURNAL_TYPE_FILTER_TITLE,
  journalTypeFilterHref,
  type JournalTypeFilter,
} from "@/lib/journal/journalCardMeta";
import { JournalFeedGridCard, JournalFeedRow, JournalMainCard, JournalMobileCard, JournalNewsCard } from "./JournalCards";
import { JournalCollectionsCarousel } from "./JournalCollectionsCarousel";

const NEWS_CARD_SHELL = "shrink-0 snap-start w-[33.6vw] min-w-[112px] max-w-[160px] lg:w-[16%] lg:max-w-none";

/**
 * Страница журнала: H1 + подзаголовок → «Главное» → «Breaking News» → «Подборки mamaGo»
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
  newsArchive = false,
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
  newsArchive?: boolean;  /** Путь страницы (с query рубрики/темы, без type/page): «Все →» и «Смотреть все →» добавляют `?type=`. */
  basePath: string;
  citySlug?: string;
  /** Доп. контент под заголовком (подрубрики/темы на странице рубрики). */
  intro?: React.ReactNode;
}) {
  const typeHref = (type: JournalTypeFilter) => journalTypeFilterHref(basePath, type);
  const resetHref = basePath;
  const saveStatuses = useArticleSaveStatusBatch([...(main ? [main.id] : []), ...feed.map((a) => a.id)]);
  const [seenNewsIds, setSeenNewsIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const refresh = () => {
      try { setSeenNewsIds(readSeenBreakingNews(window.localStorage)); }
      catch { setSeenNewsIds(new Set()); }
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const displayedNews = typeFilter === "BREAKING_NEWS" && !newsArchive ? orderBreakingNewsBySeen(feed, seenNewsIds) : feed;
  const empty = !main && news.length === 0 && collections.length === 0 && feed.length === 0;

  return (
    <div className="site-wrap space-y-10 px-4 pb-16 pt-6 sm:space-y-14 sm:px-7 sm:pt-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={`m-0 font-heading text-[34px] leading-[.98] tracking-[-0.03em] sm:text-[40px] ${newsArchive ? "text-muted-foreground" : ""}`}>
            {typeFilter === "BREAKING_NEWS" ? (newsArchive ? "Архив Breaking News" : "Breaking News") : typeFilter ? JOURNAL_TYPE_FILTER_TITLE[typeFilter] : title}
          </h1>
          {typeFilter === "BREAKING_NEWS" && (
            <Link href={newsArchive ? typeHref("BREAKING_NEWS") : `${typeHref("BREAKING_NEWS")}&archive=1`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <Archive aria-hidden="true" className="h-4 w-4" />
              {newsArchive ? "Актуальные" : "Архив"}
            </Link>
          )}
        </div>
        {typeFilter !== "BREAKING_NEWS" && (
          <p className="max-w-3xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            {typeFilter ? (
              <Link href={resetHref} className="inline-flex min-h-11 items-center font-semibold text-brand-ink hover:underline">
                ← Все материалы
              </Link>
            ) : subtitle}
          </p>
        )}
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
          <HorizontalCardRow
            headerTitle={
              <h2 id="journal-news-title" className="m-0 font-heading text-[24px] leading-tight tracking-[-0.02em] sm:text-[28px]">
                Breaking News
              </h2>
            }
            navLeading={
              <Link
                href={typeHref("BREAKING_NEWS")}
                className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm font-semibold text-brand-ink hover:underline"
              >
                Все →
              </Link>
            }
          >
            {orderBreakingNewsBySeen(news, seenNewsIds).map((article, index) => (
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

      {typeFilter === "BREAKING_NEWS" ? (
        <section aria-label={newsArchive ? "Архив Breaking News" : "Актуальные Breaking News"}>
          {displayedNews.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {displayedNews.map((article, index) => (
                <AnalyticsCardViewTracker key={article.id} entityType="ARTICLE" entityId={article.id} vertical="CITY" citySlug={citySlug} meta={{ section: "journal", block: newsArchive ? "news-archive" : "news-current", position: index }}>
                  <JournalNewsCard article={article} />
                </AnalyticsCardViewTracker>
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              {newsArchive ? "В архиве пока нет материалов." : "Сейчас нет актуальных Breaking News."}
            </p>
          )}
        </section>
      ) : null}

      {typeFilter !== "BREAKING_NEWS" && feed.length > 0 ? (
        <section aria-labelledby="journal-feed-title" className="space-y-2">
          <h2 id="journal-feed-title" className="m-0 font-heading text-[24px] leading-tight tracking-[-0.02em] sm:text-[28px]">
            {typeFilter ? "Все материалы" : "Свежие материалы"}
          </h2>
          <div className="pt-5 md:hidden">
            {feed.map((article, index) => (
              <AnalyticsCardViewTracker
                key={article.id}
                entityType="ARTICLE"
                entityId={article.id}
                vertical="CITY"
                citySlug={citySlug}
                meta={{ section: "journal", block: "feed-mobile", position: index + 1 }}
              >
                <JournalMobileCard article={article} index={index + 1} saveStatus={saveStatuses[article.id]} />
              </AnalyticsCardViewTracker>
            ))}
          </div>
          <div className="hidden border-b border-border md:block lg:hidden">
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
          <Link
            href={typeHref("BREAKING_NEWS")}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink hover:underline"
          >
            Все новости →
          </Link>
        </section>
      ) : null}

      {empty && typeFilter !== "BREAKING_NEWS" ? (
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
