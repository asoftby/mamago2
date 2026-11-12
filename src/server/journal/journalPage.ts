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
import { getSeasonallyCurrentJournalWhere } from "@/lib/journal/seasonalJournal";
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
  feed: CityHomeJournalArticle[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Данные страницы журнала: «Главное», «Новости», «Свежие материалы».
 * Подборки остаются частью общей ленты; отдельный запрос для блока не нужен.
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
  newsArchive?: boolean;
}): Promise<JournalPageData> {
  const pageSize = Math.max(1, Math.min(60, input.pageSize ?? 24));
  const page = Math.max(1, Math.trunc(input.page));
  const load = async (): Promise<JournalPageData> => {
    const top = showJournalTopBlocks(page, input.typeFilter);
    // News-only views do not query occasions.
    const current = input.typeFilter === "BREAKING_NEWS" ? null : await getSeasonallyCurrentJournalWhere();
    const base = journalBlockWheres({ scopeWhere: input.scopeWhere, typeFilter: input.typeFilter, mainId: null });
    const [mainRows, news] = top
      ? await Promise.all([
          queryJournalArticles(null, { additionalWhere: { AND: [base.main, current ?? {}] }, seasonalPriority: false, take: 1 }),
          queryJournalArticles(input.city, { additionalWhere: base.news, seasonalPriority: false, take: JOURNAL_NEWS_LIMIT }),
        ])
      : [[], []];
    const main = mainRows[0] ?? null;
    // «Главное» исключаем из ленты целиком, чтобы пагинация оставалась стабильной.
    const { feed: feedWhere } = journalBlockWheres({
      scopeWhere: input.scopeWhere,
      typeFilter: input.typeFilter,
      mainId: input.typeFilter ? null : await resolveMainId(main, input.scopeWhere, top, current ?? {}),
    });
    const newsFeedWhere: Prisma.ArticleWhereInput = input.typeFilter === "BREAKING_NEWS"
      ? { AND: [feedWhere, input.newsArchive
        ? { OR: [{ expiresAt: null }, { expiresAt: { lte: new Date() } }] }
        : notExpiredJournalPublicationWhere(new Date())] }
      : feedWhere;
    const total = await countJournalArticles(newsFeedWhere);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Страница типа (?type=news|collection) — все материалы типа, включая истёкшие
    // новости, строго по дате публикации. Основная лента — закреплённые, затем город.
    const feed = page > totalPages ? [] : input.typeFilter === "BREAKING_NEWS"
      ? await queryJournalArticles(null, { additionalWhere: newsFeedWhere, seasonalPriority: false, skip: (page - 1) * pageSize, take: pageSize })
      : await queryJournalArticles(input.typeFilter ? null : input.city, {
      additionalWhere: feedWhere,
      pinnedFirst: !input.typeFilter,
      seasonalWhere: current ?? undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { main, news, feed, page, totalPages, total };
  };
  return unstable_cache(
    load,
    ["journal-page-v2", input.city?.id ?? "national", input.city?.regionId ?? "", input.scopeKey, input.typeFilter ?? "all", input.newsArchive ? "archive" : "current", String(page), String(pageSize)],
    { tags: [PUBLIC_ARTICLE_LIST_CACHE_TAG, PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG], revalidate: 300 },
  )();
}

/** На страницах > 1 «Главное» не загружаем, но исключаем тот же материал из ленты. */
async function resolveMainId(
  main: CityHomeJournalArticle | null,
  scopeWhere: Prisma.ArticleWhereInput | null,
  topLoaded: boolean,
  current: Prisma.ArticleWhereInput,
): Promise<string | null> {
  if (topLoaded) return main?.id ?? null;
  const { main: mainWhere } = journalBlockWheres({ scopeWhere, typeFilter: null, mainId: null });
  const rows = await queryJournalArticles(null, { additionalWhere: { AND: [mainWhere, current] }, seasonalPriority: false, take: 1 });
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
  const current = await getSeasonallyCurrentJournalWhere();
  return queryJournalArticles(input.city, {
    additionalWhere: { AND: [collections, current] },
    seasonalPriority: false,
    take: Math.max(1, Math.min(24, input.limit ?? JOURNAL_COLLECTIONS_LIMIT)),
  });
}
