import type { Prisma } from "@prisma/client";
import type { JournalTypeFilter } from "@/lib/journal/journalCardMeta";
import { notExpiredJournalPublicationWhere } from "@/lib/journal/publicationType";
import {
  buildJournalGeographyBuckets,
  type JournalCity,
  type JournalGeographyGroup,
} from "@/lib/article/articleJournalGeography";

export type JournalBucket = { group: JournalGeographyGroup | null; where: Prisma.ArticleWhereInput };

/**
 * Порядок ленты журнала: опционально «закреплённые первыми», затем город читателя /
 * регион / другие города / Беларусь (без города — один хронологический бакет).
 * Внутри бакета — по дате публикации.
 */
export function buildJournalFeedBuckets(
  city: JournalCity | null,
  options: { pinnedFirst?: boolean } = {},
): JournalBucket[] {
  const geoBuckets: JournalBucket[] = city
    ? buildJournalGeographyBuckets(city)
    : [{ group: null, where: {} }];
  if (!options.pinnedFirst) return geoBuckets;
  return [
    { group: null, where: { pinned: true } },
    ...geoBuckets.map((bucket) => ({ group: bucket.group, where: { AND: [bucket.where, { pinned: false }] } })),
  ];
}

/** Лимиты блоков страницы журнала (ТЗ «Журнал»). */
export const JOURNAL_NEWS_LIMIT = 5;
export const JOURNAL_COLLECTIONS_LIMIT = 8;

/**
 * Чистые where-условия блоков журнала поверх общего публичного предиката
 * (`publicJournalWhere`, исключает истёкшие новости). `scopeWhere` — рубрика
 * (+ тема/индексируемость на странице рубрики); null — «Все».
 */
export function journalBlockWheres(input: {
  scopeWhere: Prisma.ArticleWhereInput | null;
  typeFilter: JournalTypeFilter | null;
  /** Материал из «Главное» не дублируется в ленте. */
  mainId: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const scoped = (where: Prisma.ArticleWhereInput): Prisma.ArticleWhereInput =>
    input.scopeWhere ? { AND: [input.scopeWhere, where] } : where;
  const feedParts: Prisma.ArticleWhereInput[] = [];
  if (input.typeFilter) {\n    feedParts.push({ publicationType: input.typeFilter });\n  } else {\n    // Breaking News has its own carousel and news archive; do not mix into the general article feed.\n    feedParts.push({ publicationType: { not: "BREAKING_NEWS" } });\n  }
  if (input.mainId) feedParts.push({ id: { not: input.mainId } });
  return {
    /** «Главное»: самый свежий featured любого типа. */
    main: scoped({ featured: true }),
    /** «Новости»: только актуальные BREAKING_NEWS (expiresAt > now). */
    news: scoped({ AND: [{ publicationType: "BREAKING_NEWS" }, notExpiredJournalPublicationWhere(now)] }),
    /** «Подборки mamaGo». */
    collections: scoped({ publicationType: "COLLECTION" }),
    /** «Свежие материалы»: articles/collections; news only in ?type=news, including archive. */
    feed: scoped(feedParts.length ? { AND: feedParts } : {}),
  };
}

/** Блоки над лентой показываются только на первой странице «Все типы». */
export function showJournalTopBlocks(page: number, typeFilter: JournalTypeFilter | null): boolean {
  return page <= 1 && typeFilter === null;
}
