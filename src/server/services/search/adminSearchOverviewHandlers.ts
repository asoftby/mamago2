import prisma from "@/lib/prisma";

export const OVERVIEW_WINDOW_DAYS = 7;

export interface SearchOverviewData {
  windowDays: number;
  stats: {
    totalQueries: number;
    uniqueQueries: number;
    zeroResultQueries: number;
  };
  popularQueries: Array<{
    query: string;
    count: number;
    lastSearched: Date | null;
  }>;
}

/**
 * Real SearchQueryLog aggregates for the admin Search Overview page — no
 * mock/fabricated data. There is no click-tracking caller wired to
 * logSearchClick() today (BACKLOG-025), so this deliberately does not
 * compute a CTR figure.
 */
export async function computeSearchOverview(
  windowDays = OVERVIEW_WINDOW_DAYS,
): Promise<SearchOverviewData> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const windowWhere = { createdAt: { gte: since } };

  const [totalQueries, zeroResultQueries, popularGroups, uniqueGroups] = await Promise.all([
    prisma.searchQueryLog.count({ where: windowWhere }),
    prisma.searchQueryLog.count({ where: { ...windowWhere, resultsCount: 0 } }),
    prisma.searchQueryLog.groupBy({
      by: ["query"],
      where: windowWhere,
      _count: { query: true },
      _max: { createdAt: true },
      orderBy: { _count: { query: "desc" } },
      take: 10,
    }),
    prisma.searchQueryLog.groupBy({ by: ["query"], where: windowWhere }),
  ]);

  return {
    windowDays,
    stats: {
      totalQueries,
      uniqueQueries: uniqueGroups.length,
      zeroResultQueries,
    },
    popularQueries: popularGroups.map((row) => ({
      query: row.query,
      count: row._count.query,
      lastSearched: row._max.createdAt,
    })),
  };
}
