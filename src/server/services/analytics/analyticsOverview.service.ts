import { Prisma, type UserEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AnalyticsOverviewFilters,
  AnalyticsOverviewResult,
} from "@/lib/analytics/adminOverviewTypes";
import { analyticsDayKeys } from "@/server/services/analytics/analyticsDateRange";
import {
  analyticsEventWhereSql,
  analyticsIdentityWhereSql,
  applyAnalyticsUserFilter,
  buildAnalyticsBaseEventWhere,
  loadAnalyticsScope,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  countOrderedFunnel,
  share,
} from "@/server/services/analytics/orderedUserFunnel";
import {
  AUDIENCE_EXCLUDED_ROLES,
  computeCanonicalAudience,
  internalTrafficExclusionSql,
} from "@/server/services/analytics/canonicalAudience";
import {
  ANALYTICS_TIME_ZONE,
  CTA_CLICK_EVENT,
  DETAIL_OPEN_EVENT,
  FEED_IMPRESSION_EVENT,
  PLAN_ADD_EVENT,
  SAVE_EVENT,
} from "@/server/services/analytics/metricDefinitions";

async function countByType(base: Prisma.UserEventWhereInput, type: UserEventType): Promise<number> {
  return prisma.userEvent.count({ where: { ...base, eventType: type } });
}

function shortDayLabel(dateKey: string): string {
  // Format the civil date itself (noon UTC), never re-zoned.
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

/**
 * Агрегированные метрики для вкладки Analytics → Overview.
 *
 * Определения — `metricDefinitions.ts` (B): визиторы, просмотры страниц и
 * устройства — из `computeCanonicalAudience` (те же, что на /admin, для
 * выбранного города); показы в ленте (CARD_VIEW) — отдельно; внутренний
 * трафик (ADMIN/MODERATOR + tainted-сессии) исключён из всех цифр; сутки —
 * по Минску. Фильтры сущности/вертикали относятся к контентным событиям и к
 * аудитории (PAGE_VIEW без сущности) не применяются.
 *
 * D6: фильтры «сегмент» и «возраст ребёнка» применяются ко всем цифрам вкладки
 * (аудитория, события, ряд по дням) — раньше они молча игнорировались.
 * D7: воронка и конверсии — по уникальным людям, доли считаются от открывших
 * и не превышают 100%; при нуле открывших доля — null («—»), а не 0%.
 */
export async function getAnalyticsOverview(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsOverviewResult> {
  const { start, end, cityId, allowed, exclusion } = await loadAnalyticsScope(filters);
  const base = applyAnalyticsUserFilter(
    buildAnalyticsBaseEventWhere(start, end, filters, cityId, exclusion),
    allowed,
  );
  const exclusionSql = internalTrafficExclusionSql(exclusion, "e");
  const cityPageViewSql = cityId ? Prisma.sql`AND e."cityId" = ${cityId}` : Prisma.empty;
  const allowedPageViewSql = allowed
    ? allowed.size === 0
      ? Prisma.sql`AND FALSE`
      : Prisma.sql`AND e."userId" IN (${Prisma.join([...allowed])})`
    : Prisma.empty;
  // Funnel audience membership is applied after resolving anonymous sessions.
  const contentEventSql = analyticsEventWhereSql(start, end, filters, cityId, null, exclusion);
  const filteredContentEventSql = analyticsEventWhereSql(start, end, filters, cityId, allowed, exclusion);

  const [
    audience,
    feedImpressions,
    opens,
    saves,
    planAdds,
    ctaClicks,
    people,
    profilesActiveInRange,
    topVerticalRows,
    topEntityRows,
    dailyPageViewRows,
    dailyOpenRows,
  ] = await Promise.all([
    computeCanonicalAudience(prisma, start, end, { cityId, allowedUserIds: allowed }),
    countByType(base, FEED_IMPRESSION_EVENT),
    countByType(base, DETAIL_OPEN_EVENT),
    countByType(base, SAVE_EVENT),
    countByType(base, PLAN_ADD_EVENT),
    countByType(base, CTA_CLICK_EVENT),
    countOrderedFunnel(contentEventSql, analyticsIdentityWhereSql(start, end, exclusion), allowed),
    prisma.userBehaviorProfile.count({
      where: {
        lastSeenAt: { gte: start, lte: end },
        user: { role: { notIn: [...AUDIENCE_EXCLUDED_ROLES] } },
      },
    }),
    prisma.userEvent.groupBy({
      by: ["vertical"],
      where: { ...base, vertical: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { vertical: "desc" } },
      take: 5,
    }),
    prisma.userEvent.groupBy({
      by: ["entityType", "entityId"],
      where: {
        ...base,
        entityType: { not: null },
        entityId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { entityId: "desc" } },
      take: 5,
    }),
    // PAGE_VIEW per Minsk day: same exclusion; rows with neither user nor session never count (canonical rule).
    prisma.$queryRaw<{ day: string; c: bigint }[]>(Prisma.sql`
      SELECT to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ANALYTICS_TIME_ZONE}, 'YYYY-MM-DD') AS day, count(*)::bigint AS c
      FROM "UserEvent" e
      WHERE e."eventType" = 'PAGE_VIEW'
        AND e."createdAt" >= ${start} AND e."createdAt" <= ${end}
        AND (e."sessionId" IS NOT NULL OR e."userId" IS NOT NULL)
        ${cityPageViewSql}
        ${allowedPageViewSql}
        AND ${exclusionSql}
      GROUP BY 1
    `),
    prisma.$queryRaw<{ day: string; c: bigint }[]>(Prisma.sql`
      SELECT to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ANALYTICS_TIME_ZONE}, 'YYYY-MM-DD') AS day, count(*)::bigint AS c
      FROM "UserEvent" e
      WHERE e."eventType" = 'DETAIL_OPEN' AND ${filteredContentEventSql}
      GROUP BY 1
    `),
  ]);

  const pageViews = audience.pageViews;
  // D7: доли — от уникальных открывших; ветки save/plan/click не короче 100%.
  const saveRate = share(people.save, people.open);
  const planRate = share(people.plan, people.open);
  const clickRate = share(people.click, people.open);

  const pctOfTop = (n: number, top: number) =>
    top > 0 ? Math.round((n / top) * 1000) / 10 : 0;
  const funnel = [
    { key: "view" as const, label: "Видели контент", count: people.view, percentOfTop: people.view > 0 ? 100 : 0 },
    { key: "open" as const, label: "Открыли карточку", count: people.open, percentOfTop: pctOfTop(people.open, people.view) },
    { key: "save" as const, label: "Сохранили", count: people.save, percentOfTop: pctOfTop(people.save, people.open) },
    { key: "plan" as const, label: "Добавили в план", count: people.plan, percentOfTop: pctOfTop(people.plan, people.open) },
    { key: "click" as const, label: "Перешли к партнёру", count: people.click, percentOfTop: pctOfTop(people.click, people.open) },
  ];

  const topVerticals = topVerticalRows.map((r) => ({
    label: r.vertical ?? "—",
    count: r._count._all,
  }));

  const topEntities = topEntityRows.map((r) => ({
    label: `${r.entityType ?? "?"} · ${(r.entityId ?? "").slice(0, 8)}…`,
    sublabel: r.entityId ?? undefined,
    count: r._count._all,
  }));

  const viewsByDay = new Map(dailyPageViewRows.map((r) => [r.day, Number(r.c)]));
  const opensByDay = new Map(dailyOpenRows.map((r) => [r.day, Number(r.c)]));
  const dailySeries = analyticsDayKeys(start, end, 90).map((date) => ({
    day: shortDayLabel(date),
    date,
    pageViews: viewsByDay.get(date) ?? 0,
    opens: opensByDay.get(date) ?? 0,
  }));

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    visitors: audience.visitors,
    devices: audience.devices,
    pageViews,
    feedImpressions,
    opens,
    saves,
    planAdds,
    ctaClicks,
    saveRate,
    planRate,
    clickRate,
    funnel,
    profilesActiveInRange,
    topVerticals,
    topEntities,
    dailySeries,
  };
}
