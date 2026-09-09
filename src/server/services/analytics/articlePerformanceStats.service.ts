import { unstable_cache } from "next/cache";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ARTICLE_PERFORMANCE_ANALYTICS_SCOPE,
  type ArticlePerformanceAction,
  type ArticlePerformanceTrackedBlockType,
} from "@/lib/article/articlePerformanceAnalytics";
import type {
  ArticlePerformanceBlockStats,
  ArticlePerformanceStatsPayload,
  ArticlePerformanceSubjectStats,
} from "@/lib/article/articlePerformanceStats";
import type { PublicationStatsPeriod } from "@/lib/publication-stats/period";
import { emptyEmojiRatingCounts, isEmojiRatingType } from "@/lib/content-rating/emojiRating";

function rangeForPeriod(period: PublicationStatsPeriod): { start: Date; end: Date } {
  const now = new Date();
  if (period === "yesterday") {
    const day = subDays(now, 1);
    return { start: startOfDay(day), end: endOfDay(day) };
  }
  const days = period === "today"
    ? 1
    : period === "week"
      ? 7
      : period === "month"
        ? 30
        : period === "threeMonths"
          ? 90
          : period === "sixMonths"
            ? 180
            : 365;
  return { start: startOfDay(subDays(now, days - 1)), end: endOfDay(now) };
}

type ShareRow = { action: string | null; count: bigint };
type UniqueRow = { count: bigint };
type BlockAggregateRow = {
  subjectId: string | null;
  subjectTitle: string | null;
  subjectSource: string | null;
  catalogEntityType: string | null;
  catalogEntityId: string | null;
  blockId: string;
  blockType: string;
  kind: string;
  action: string;
  actionItemId: string;
  count: bigint;
};

const BLOCK_TYPE_LABEL: Record<string, string> = {
  contacts: "Контакты",
  price: "Стоимость",
  openingHours: "Режим работы",
  activityCard: "Карточка публикации",
};

function buildSubjects(rows: BlockAggregateRow[]): ArticlePerformanceSubjectStats[] {
  type MutableBlock = ArticlePerformanceBlockStats;
  type MutableSubject = Omit<ArticlePerformanceSubjectStats, "blocks"> & { blocks: Map<string, MutableBlock> };
  const subjects = new Map<string, MutableSubject>();

  for (const row of rows) {
    const subjectId = row.subjectId || `legacy:${row.blockId}`;
    let subject = subjects.get(subjectId);
    if (!subject) {
      const source = row.subjectSource === "CATALOG" || row.subjectSource === "MANUAL"
        ? row.subjectSource
        : "LEGACY";
      subject = {
        subjectId,
        title: row.subjectTitle || BLOCK_TYPE_LABEL[row.blockType] || "Объект статьи",
        source,
        ...(row.catalogEntityType ? { catalogEntityType: row.catalogEntityType } : {}),
        ...(row.catalogEntityId ? { catalogEntityId: row.catalogEntityId } : {}),
        impressions: 0,
        targetActions: 0,
        ctr: null,
        blocks: new Map(),
      };
      subjects.set(subjectId, subject);
    }

    let block = subject.blocks.get(row.blockId);
    if (!block) {
      block = {
        blockId: row.blockId,
        blockType: row.blockType as ArticlePerformanceTrackedBlockType,
        impressions: 0,
        actions: {},
        actionItems: {},
      };
      subject.blocks.set(row.blockId, block);
    }

    const count = Number(row.count);
    if (row.kind === "impression") {
      block.impressions += count;
      continue;
    }
    if (row.kind !== "action" || !row.action) continue;
    const action = row.action as ArticlePerformanceAction;
    block.actions[action] = (block.actions[action] ?? 0) + count;
    if (row.actionItemId) {
      const key = `${action}:${row.actionItemId}`;
      block.actionItems[key] = (block.actionItems[key] ?? 0) + count;
    }
  }

  const result: ArticlePerformanceSubjectStats[] = [];
  for (const subject of subjects.values()) {
    const blocks = [...subject.blocks.values()];
    // All sections of one compact info card are impressed together. `max`
    // represents object/card exposure without triple-counting price+hours+contacts.
    const impressions = Math.max(0, ...blocks.map((block) => block.impressions));
    const targetActions = blocks.reduce(
      (sum, block) => sum + Object.values(block.actions).reduce((inner, value) => inner + (value ?? 0), 0),
      0,
    );
    result.push({
      subjectId: subject.subjectId,
      title: subject.title,
      source: subject.source,
      ...(subject.catalogEntityType ? { catalogEntityType: subject.catalogEntityType } : {}),
      ...(subject.catalogEntityId ? { catalogEntityId: subject.catalogEntityId } : {}),
      impressions,
      targetActions,
      ctr: impressions > 0 ? targetActions / impressions : null,
      blocks,
    });
  }

  return result.sort((a, b) => b.targetActions - a.targetActions || b.impressions - a.impressions);
}

/**
 * All expensive work is bounded by the existing UserEvent composite index
 * (entityType, entityId, createdAt). JSON expansion happens only after that
 * article+date slice is selected. Result is cached for 60 seconds so repeatedly
 * opening the admin report never scans the same slice on every click.
 */
async function computeArticlePerformanceStats(
  articleId: string,
  period: PublicationStatsPeriod,
): Promise<ArticlePerformanceStatsPayload | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  if (!article) return null;

  const { start, end } = rangeForPeriod(period);
  const baseWhere: Prisma.UserEventWhereInput = {
    entityType: "ARTICLE",
    entityId: articleId,
    createdAt: { gte: start, lte: end },
  };

  const [views, saves, uniqueRows, shareRows, ratingRows, blockRows] = await Promise.all([
    prisma.userEvent.count({ where: { ...baseWhere, eventType: "DETAIL_OPEN" } }),
    prisma.userEvent.count({ where: { ...baseWhere, eventType: "SAVE" } }),
    prisma.$queryRaw<UniqueRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT COALESCE(
        CASE WHEN e."userId" IS NOT NULL THEN 'u:' || e."userId" END,
        CASE WHEN e."sessionId" IS NOT NULL THEN 's:' || e."sessionId" END,
        'e:' || e.id
      ))::bigint AS count
      FROM "UserEvent" e
      WHERE e."entityType" = 'ARTICLE'::"AnalyticsEntityType"
        AND e."entityId" = ${articleId}
        AND e."eventType" = 'DETAIL_OPEN'::"UserEventType"
        AND e."createdAt" >= ${start}
        AND e."createdAt" <= ${end}
    `),
    prisma.$queryRaw<ShareRow[]>(Prisma.sql`
      SELECT e.meta->>'targetAction' AS action, COUNT(*)::bigint AS count
      FROM "UserEvent" e
      WHERE e."entityType" = 'ARTICLE'::"AnalyticsEntityType"
        AND e."entityId" = ${articleId}
        AND e."eventType" = 'CTA_CLICK'::"UserEventType"
        AND e."createdAt" >= ${start}
        AND e."createdAt" <= ${end}
        AND e.meta->>'targetAction' IN (
          'article_share_telegram',
          'article_share_whatsapp',
          'article_share_copy',
          'article_share_native'
        )
      GROUP BY e.meta->>'targetAction'
    `),
    prisma.articleRating.groupBy({
      by: ["ratingType"],
      where: { articleId, createdAt: { gte: start, lte: end } },
      _count: true,
    }),
    prisma.$queryRaw<BlockAggregateRow[]>(Prisma.sql`
      WITH narrowed AS (
        SELECT e.meta
        FROM "UserEvent" e
        WHERE e."entityType" = 'ARTICLE'::"AnalyticsEntityType"
          AND e."entityId" = ${articleId}
          AND e."eventType" = 'FILTER_APPLY'::"UserEventType"
          AND e."createdAt" >= ${start}
          AND e."createdAt" <= ${end}
          AND e.meta->>'analyticsScope' = ${ARTICLE_PERFORMANCE_ANALYTICS_SCOPE}
      ), expanded AS (
        SELECT jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(n.meta->'events') = 'array' THEN n.meta->'events'
            ELSE '[]'::jsonb
          END
        ) AS item
        FROM narrowed n
      )
      SELECT
        item->>'subjectId' AS "subjectId",
        item->>'subjectTitle' AS "subjectTitle",
        item->>'subjectSource' AS "subjectSource",
        item->>'catalogEntityType' AS "catalogEntityType",
        item->>'catalogEntityId' AS "catalogEntityId",
        item->>'blockId' AS "blockId",
        item->>'blockType' AS "blockType",
        item->>'kind' AS kind,
        COALESCE(item->>'action', '') AS action,
        COALESCE(item->>'actionItemId', '') AS "actionItemId",
        COUNT(*)::bigint AS count
      FROM expanded
      WHERE item->>'blockId' IS NOT NULL AND item->>'blockType' IS NOT NULL
      GROUP BY 1,2,3,4,5,6,7,8,9,10
    `),
  ]);

  const shareCounts = { telegram: 0, whatsapp: 0, copy: 0, native: 0 };
  for (const row of shareRows) {
    const channel = row.action?.replace("article_share_", "") as keyof typeof shareCounts | undefined;
    if (channel && channel in shareCounts) shareCounts[channel] += Number(row.count);
  }
  const shares = Object.values(shareCounts).reduce((sum, value) => sum + value, 0);

  const ratings = emptyEmojiRatingCounts();
  for (const row of ratingRows) {
    if (isEmojiRatingType(row.ratingType)) ratings[row.ratingType] = row._count;
  }
  const ratingTotal = ratings.like + ratings.neutral + ratings.dislike;
  const subjects = buildSubjects(blockRows);
  const targetActions = subjects.reduce((sum, subject) => sum + subject.targetActions, 0);

  return {
    kind: "article-performance",
    article: {
      id: article.id,
      title: article.title,
      slug: article.slug,
      status: article.status,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      updatedAt: article.updatedAt.toISOString(),
    },
    period,
    statsUpdatedAt: new Date().toISOString(),
    metrics: {
      views,
      uniqueReaders: Number(uniqueRows[0]?.count ?? 0),
      saves,
      shares,
      ratings: ratingTotal,
      positiveRatingRate: ratingTotal > 0 ? ratings.like / ratingTotal : null,
      targetActions,
    },
    shares: shareCounts,
    ratings: {
      ...ratings,
      total: ratingTotal,
      positiveRate: ratingTotal > 0 ? ratings.like / ratingTotal : null,
    },
    subjects,
  };
}

const cachedArticlePerformanceStats = unstable_cache(
  computeArticlePerformanceStats,
  ["article-performance-report-v1"],
  { revalidate: 60 },
);

export function getArticlePerformanceStats(
  articleId: string,
  period: PublicationStatsPeriod,
): Promise<ArticlePerformanceStatsPayload | null> {
  return cachedArticlePerformanceStats(articleId, period);
}
