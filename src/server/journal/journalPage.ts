import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  countJournalArticles,
  queryJournalArticles,
  type CityHomeJournalArticle,
} from "@/server/article/listCityHomeArticles";
import {
  PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG,
  PUBLIC_ARTICLE_LIST_CACHE_TAG,
} from "@/server/article/publicArticleCache";
import type { JournalTypeFilter } from "@/lib/journal/journalCardMeta";
import { notExpiredJournalPublicationWhere } from "@/lib/journal/publicationType";
import {
  JOURNAL_COLLECTIONS_LIMIT,
  JOURNAL_NEWS_LIMIT,
  journalBlockWheres,
  showJournalTopBlocks,
} from "./journalPageQueries";

type JournalCity = { id: string; slug: string; regionId?: string | null };

export type JournalPageData = {
  main: CityHomeJournalArticle | null;
  news: CityHomeJournalArticle[];
  collections: CityHomeJournalArticle[];
  feed: CityHomeJournalArticle[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Данные страницы журнала: «Главное», «Новости», «Подборки mamaGo», «Свежие материалы».
 * Территория — город страницы (= выбор в шапке): материалы города выше, сортировка по
 * дате публикации; в ленте закреплённые первыми. Истёкшие новости не попадают никуда.
 * Короткий TTL кэша: срок новостей истекает по времени, без события инвалидации.
 */
export async function loadJournalPage(input: {
  city: JournalCity | null;
  scopeWhere: Prisma.ArticleWhereInput | null;
  /** Стабильный ключ scopeWhere для кэша (slug рубрики + тема). */
  scopeKey: string;
  typeFilter: JournalTypeFilter | null;
  page: number;
  pageSize?: number;
}): Promise<JournalPageData> {
  const pageSize = Math.max(1, Math.min(60, input.pageSize ?? 24));
  const page = Math.max(1, Math.trunc(input.page));
  const load = async (): Promise<JournalPageData> => {
    const top = showJournalTopBlocks(page, input.typeFilter);
    const base = journalBlockWheres({ scopeWhere: input.scopeWhere, typeFilter: input.typeFilter, mainId: null });
    const [mainRows, news, collections] = top
      ? await Promise.all([
          queryJournalArticles(null, { additionalWhere: base.main, take: 1 }),
          queryJournalArticles(input.city, { additionalWhere: base.news, take: JOURNAL_NEWS_LIMIT }),
          listJournalCollections({ city: input.city, scopeWhere: input.scopeWhere, limit: JOURNAL_COLLECTIONS_LIMIT }),
        ])
      : [[], [], []];
    const main = mainRows[0] ?? null;
    // «Главное» исключаем из ленты целиком, чтобы пагинация оставалась стабильной.
    const { feed: feedWhere } = journalBlockWheres({
      scopeWhere: input.scopeWhere,
      typeFilter: input.typeFilter,
      mainId: input.typeFilter ? null : await resolveMainId(main, input.scopeWhere, top),
    });
    const total = await countJournalArticles(feedWhere);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Страница типа (?type=news|collection) — все материалы типа, включая истёкшие
    // новости, строго по дате публикации. Основная лента — закреплённые, затем город.
    const feed = page > totalPages ? [] : input.typeFilter === "BREAKING_NEWS"
      ? await queryPaginatedBreakingNews(feedWhere, (page - 1) * pageSize, pageSize)
      : await queryJournalArticles(input.typeFilter ? null : input.city, {
      additionalWhere: feedWhere,
      pinnedFirst: !input.typeFilter,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { main, news, collections, feed, page, totalPages, total };
  };
  return unstable_cache(
    load,
    ["journal-page", input.city?.id ?? "national", input.city?.regionId ?? "", input.scopeKey, input.typeFilter ?? "all", String(page), String(pageSize)],
    { tags: [PUBLIC_ARTICLE_LIST_CACHE_TAG, PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG], revalidate: 300 },
  )();
}

/** На страницах > 1 «Главное» не загружаем, но исключаем тот же материал из ленты. */
async function resolveMainId(
  main: CityHomeJournalArticle | null,
  scopeWhere: Prisma.ArticleWhereInput | null,
  topLoaded: boolean,
): Promise<string | null> {
  if (topLoaded) return main?.id ?? null;
  const { main: mainWhere } = journalBlockWheres({ scopeWhere, typeFilter: null, mainId: null });
  const rows = await queryJournalArticles(null, { additionalWhere: mainWhere, take: 1 });
  return rows[0]?.id ?? null;
}

/**
 * Подборки mamaGo — отдельный источник с фильтрами (рубрика, территория, лимит)
 * для будущего встраивания в «Куда пойти» и главную.
 */
export async function listJournalCollections(input: {
  city: JournalCity | null;
  scopeWhere?: Prisma.ArticleWhereInput | null;
  limit?: number;
}): Promise<CityHomeJournalArticle[]> {
  const { collections } = journalBlockWheres({ scopeWhere: input.scopeWhere ?? null, typeFilter: null, mainId: null });
  return queryJournalArticles(input.city, {
    additionalWhere: collections,
    take: Math.max(1, Math.min(24, input.limit ?? JOURNAL_COLLECTIONS_LIMIT)),
  });
}

/** Globally paginate current news before archived news; no page-local reordering. */
async function queryPaginatedBreakingNews(
  feedWhere: Prisma.ArticleWhereInput,
  skip: number,
  take: number,
): Promise<CityHomeJournalArticle[]> {
  const now = new Date();
  const currentWhere: Prisma.ArticleWhereInput = {
    AND: [feedWhere, notExpiredJournalPublicationWhere(now)],
  };
  const currentCount = await countJournalArticles(currentWhere);
  const currentSkip = Math.min(skip, currentCount);
  const currentTake = Math.min(take, Math.max(0, currentCount - currentSkip));
  const current = currentTake > 0
    ? await queryJournalArticles(null, { additionalWhere: currentWhere, skip: currentSkip, take: currentTake })
    : [];
  const archiveTake = take - current.length;
  if (archiveTake <= 0) return current;
  const archiveWhere: Prisma.ArticleWhereInput = {
    AND: [feedWhere, { OR: [{ expiresAt: null }, { expiresAt: { lte: now } }] }],
  };
  const archive = await queryJournalArticles(null, {
    additionalWhere: archiveWhere,
    skip: Math.max(0, skip - currentCount),
    take: archiveTake,
  });
  return [...current, ...archive];
}
