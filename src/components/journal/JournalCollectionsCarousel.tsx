"use client";

import Link from "next/link";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { JournalCollectionCard } from "./JournalCards";

const COLLECTION_CARD_SHELL =
  "shrink-0 snap-start w-[62vw] min-w-[180px] max-w-[260px] lg:w-[calc((100%-4.5rem)/4)] lg:max-w-none";

/**
 * «Подборки mamaGo» — самостоятельный блок-карусель. Данные приходят из
 * `listJournalCollections({ city, scopeWhere, limit })`, поэтому блок можно
 * встраивать в другие разделы (в этом ТЗ — только журнал).
 */
export function JournalCollectionsCarousel({
  collections,
  allHref,
  citySlug,
  placement = "journal",
  title = "Подборки mamaGo",
}: {
  collections: CityHomeJournalArticle[];
  /** «Смотреть все →» — лента с фильтром по типу. */
  allHref: string;
  citySlug?: string;
  placement?: string;
  title?: string;
}) {
  if (collections.length === 0) return null;
  return (
    <section aria-labelledby="journal-collections-title" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="journal-collections-title" className="m-0 font-heading text-[24px] leading-tight tracking-[-0.02em] sm:text-[28px]">
          {title}
        </h2>
        <Link
          href={allHref}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand-ink hover:underline"
        >
          Смотреть все →
        </Link>
      </div>
      <HorizontalCardRow>
        {collections.map((article, index) => (
          <div key={article.id} className={COLLECTION_CARD_SHELL}>
            <AnalyticsCardViewTracker
              entityType="ARTICLE"
              entityId={article.id}
              vertical="CITY"
              citySlug={citySlug}
              meta={{ section: placement, block: "collections", position: index }}
            >
              <JournalCollectionCard article={article} tone={index} />
            </AnalyticsCardViewTracker>
          </div>
        ))}
      </HorizontalCardRow>
    </section>
  );
}
