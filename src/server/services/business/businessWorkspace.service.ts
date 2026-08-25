import {
  AnalyticsEntityType,
  BillingTransactionType,
  NotificationAudience,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";
import { getPromotionOverviewData } from "@/server/services/promotion/promotion.service";
import {
  CANONICAL_CARD_IMPRESSION_SQL,
  CANONICAL_CTA_CLICK_SQL,
} from "@/server/services/analytics/analyticsMetricSql";

type MetricMap = Record<
  string,
  {
    /** Compatibility name: Contract v1 defines this as canonical CARD_VIEW impressions. */
    views: number;
    opens: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  }
>;

type PerformanceMetricRow = {
  entity_type: string;
  entity_id: string;
  impressions: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

function emptyMetrics(): MetricMap[string] {
  return {
    views: 0,
    opens: 0,
    saves: 0,
    planAdds: 0,
    ctaClicks: 0,
  };
}

function monthStart(): Date {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export type DashboardPeriod = "today" | "yesterday" | "week" | "month" | "quarter";

export function getPeriodRange(period: DashboardPeriod): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  switch (period) {
    case "today": {
      const to = new Date(now);
      return { from: today, to };
    }
    case "yesterday": {
      const from = new Date(today);
      from.setDate(from.getDate() - 1);
      const to = new Date(today);
      to.setMilliseconds(-1);
      return { from, to };
    }
    case "week": {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    case "month": {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { from, to: now };
    }
    case "quarter": {
      const from = new Date(today);
      from.setDate(from.getDate() - 90);
      return { from, to: now };
    }
  }
}

async function loadPerformanceMetricRows(params: {
  entityType: AnalyticsEntityType;
  ids: string[];
  dateRange?: { start: Date; end: Date };
}): Promise<PerformanceMetricRow[]> {
  if (params.ids.length === 0) return [];
  const dateSql = params.dateRange
    ? Prisma.sql`
        AND e."createdAt" >= ${params.dateRange.start}
        AND e."createdAt" <= ${params.dateRange.end}
      `
    : Prisma.empty;

  return prisma.$queryRaw<PerformanceMetricRow[]>`
    SELECT
      e."entityType"::text AS entity_type,
      e."entityId"::text AS entity_id,
      COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})::bigint AS impressions,
      COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN')::bigint AS opens,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
      COUNT(*) FILTER (WHERE ${CANONICAL_CTA_CLICK_SQL})::bigint AS cta_clicks
    FROM "UserEvent" e
    WHERE e."entityType" = ${params.entityType}::"AnalyticsEntityType"
      AND e."entityId" IN (${Prisma.join(params.ids)})
      ${dateSql}
    GROUP BY e."entityType", e."entityId"
  `;
}

/**
 * Canonical first-party publication metrics for B2B dashboards.
 * PAGE_VIEW is traffic and never contributes to publication impressions.
 * Article reading/rating transport events never contribute to CTA clicks.
 */
export async function getPerformanceMetricsByEntity(params: {
  events: Array<{ id: string; title: string; updatedAt: Date; status: string }>;
  offers: Array<{ id: string; title: string; updatedAt: Date; status: string }>;
  /** Optional — Place is not shown on the Dashboard's Top-5, but is a real, naturally-owned publication type for Business Analytics. */
  places?: Array<{ id: string; title: string; updatedAt: Date; status: string }>;
  /** Optional — Dashboard's Top-5 stays all-time (unchanged); Business Analytics passes this to match the selected period. */
  dateRange?: { start: Date; end: Date };
}) {
  const eventIds = params.events.map((item) => item.id);
  const offerIds = params.offers.map((item) => item.id);
  const placeIds = (params.places ?? []).map((item) => item.id);

  if (eventIds.length === 0 && offerIds.length === 0 && placeIds.length === 0) {
    return new Map<string, MetricMap[string]>();
  }

  const rows = (
    await Promise.all([
      loadPerformanceMetricRows({
        entityType: AnalyticsEntityType.EVENT,
        ids: eventIds,
        dateRange: params.dateRange,
      }),
      loadPerformanceMetricRows({
        entityType: AnalyticsEntityType.OFFER,
        ids: offerIds,
        dateRange: params.dateRange,
      }),
      loadPerformanceMetricRows({
        entityType: AnalyticsEntityType.PLACE,
        ids: placeIds,
        dateRange: params.dateRange,
      }),
    ])
  ).flat();

  const metrics = new Map<string, MetricMap[string]>();
  for (const row of rows) {
    metrics.set(`${row.entity_type}:${row.entity_id}`, {
      views: Number(row.impressions),
      opens: Number(row.opens),
      saves: Number(row.saves),
      planAdds: Number(row.plan_adds),
      ctaClicks: Number(row.cta_clicks),
    });
  }
  return metrics;
}

export async function getBusinessWorkspaceData(params: {
  userId: string;
  businessId: string;
  period?: DashboardPeriod;
  dateRange?: { start: Date; end: Date };
}) {
  const period = params.period ?? "week";
  const presetRange = getPeriodRange(period);
  const periodFrom = params.dateRange?.start ?? presetRange.from;
  const periodTo = params.dateRange?.end ?? presetRange.to;
  const currentMonthStart = monthStart();

  const [billingSummary, places, events, placeOffers, promotionSummary] = await Promise.all([
    getBusinessBillingSummary(params.businessId),
    prisma.place.findMany({
      where: {
        archivedAt: null,
        OR: [{ ownerBusinessId: params.businessId }, { createdByUserId: params.userId }],
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activity.findMany({
      where: {
        OR: [{ businessId: params.businessId }, { ownerUserId: params.userId }],
        type: "EVENT",
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        status: true,
        placeId: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.offer.findMany({
      where: {
        archivedAt: null,
        place: {
          OR: [{ ownerBusinessId: params.businessId }, { createdByUserId: params.userId }],
        },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        status: true,
        placeId: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    getPromotionOverviewData(params.businessId),
  ]);

  const metricsByEntity = await getPerformanceMetricsByEntity({
    events,
    offers: placeOffers,
    dateRange: { start: periodFrom, end: periodTo },
  });

  const linkedPublicationsByPlace = new Map<
    string,
    { events: number; offers: number }
  >();

  for (const place of places) {
    linkedPublicationsByPlace.set(place.id, { events: 0, offers: 0 });
  }

  for (const event of events) {
    if (!event.placeId) continue;
    const current = linkedPublicationsByPlace.get(event.placeId);
    if (current) current.events += 1;
  }

  for (const offer of placeOffers) {
    if (!offer.placeId) continue;
    const current = linkedPublicationsByPlace.get(offer.placeId);
    if (current) current.offers += 1;
  }

  const transactionWindow = billingSummary?.account.id
    ? await prisma.billingTransaction.findMany({
        where: {
          billingAccountId: billingSummary.account.id,
          occurredAt: { gte: currentMonthStart },
          status: "SUCCEEDED",
        },
        select: {
          id: true,
          amount: true,
          type: true,
          referenceType: true,
          referenceId: true,
          description: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "desc" },
      })
    : [];

  // Period-aware spend
  const periodTransactions = billingSummary?.account.id
    ? await prisma.billingTransaction.findMany({
        where: {
          billingAccountId: billingSummary.account.id,
          occurredAt: { gte: periodFrom, lte: periodTo },
          status: "SUCCEEDED",
          amount: { lt: 0 },
        },
        select: { amount: true, type: true },
      })
    : [];

  const periodSpend = periodTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount.toNumber()),
    0,
  );
  const periodLeadCount = periodTransactions.filter(
    (tx) => tx.type === BillingTransactionType.LEAD_CHARGE,
  ).length;

  // Inbox preview: latest 3 broadcast-style notifications for this user.
  // Avoid filtering by entityType here because some local databases still
  // store Notification.entityType without the generated Postgres enum type.
  const inboxPreview = await prisma.notification.findMany({
    where: {
      userId: params.userId,
      audience: NotificationAudience.BUSINESS,
      type: { in: ["NEWS", "ANNOUNCEMENT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, type: true, createdAt: true, seenAt: true },
  });

  const spend = billingSummary?.monthSpent ?? 0;
  const leadCharges = transactionWindow.filter(
    (tx) => tx.type === BillingTransactionType.LEAD_CHARGE
  );
  const leadCount = leadCharges.length;

  const topPublications = [
    ...events.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      status: item.status,
      type: "event" as const,
      metrics:
        metricsByEntity.get(`${AnalyticsEntityType.EVENT}:${item.id}`) ??
        emptyMetrics(),
    })),
    ...placeOffers.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      status: item.status,
      type: "offer" as const,
      metrics:
        metricsByEntity.get(`${AnalyticsEntityType.OFFER}:${item.id}`) ??
        emptyMetrics(),
    })),
  ]
    .sort((a, b) => {
      if (b.metrics.ctaClicks !== a.metrics.ctaClicks) {
        return b.metrics.ctaClicks - a.metrics.ctaClicks;
      }
      if (b.metrics.planAdds !== a.metrics.planAdds) {
        return b.metrics.planAdds - a.metrics.planAdds;
      }
      if (b.metrics.saves !== a.metrics.saves) {
        return b.metrics.saves - a.metrics.saves;
      }
      return b.metrics.views - a.metrics.views;
    })
    .slice(0, 5);

  const totalPlanAdds = [...metricsByEntity.values()].reduce(
    (sum, metrics) => sum + metrics.planAdds,
    0
  );
  const totalCtaClicks = [...metricsByEntity.values()].reduce(
    (sum, metrics) => sum + metrics.ctaClicks,
    0
  );

  const recommendedActions: string[] = [];

  if (placeOffers.length === 0) {
    recommendedActions.push("У вас пока нет активных offers. Добавьте хотя бы одно предложение, чтобы монетизировать существующий спрос.");
  }

  if (events.length === 0) {
    recommendedActions.push("События помогают регулярно возвращать аудиторию. Запланируйте первое событие, чтобы получить повторный спрос.");
  }

  if (places.some((place) => {
    const linked = linkedPublicationsByPlace.get(place.id);
    return linked ? linked.events + linked.offers === 0 : false;
  })) {
    recommendedActions.push("У части places нет связанных publications. Свяжите место с событием или offer, чтобы оно начало приносить спрос.");
  }

  if (
    topPublications.some(
      (item) => item.metrics.planAdds > 0 && item.metrics.ctaClicks === 0
    )
  ) {
    recommendedActions.push("Некоторые публикации уже добавляют в план, но не приводят к обращению. Попробуйте продвинуть их или усилить CTA.");
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Кабинет собран так, чтобы вы быстро понимали, что уже работает. Следующий шаг — сравнить лучшие publications и направить бюджет в те, что дают добавления в план и обращения.");
  }

  return {
    spend,
    leadCount,
    periodSpend,
    periodLeadCount,
    inboxPreview,
    promotionSpend: promotionSummary.totalSpend,
    promotionLeadCount: promotionSummary.totalLeads,
    promotionSaveCount: promotionSummary.totalSaveToPlan,
    activePromotionCount: promotionSummary.activeCount,
    totalPlanAdds,
    totalCtaClicks,
    costPerSave: promotionSummary.costPerSave,
    costPerLead: promotionSummary.costPerLead,
    topPublications,
    recommendations: recommendedActions,
    places,
    events,
    offers: placeOffers,
    linkedPublicationsByPlace,
    metricsByEntity,
    promotionSummary,
    billingSummary,
    recentTransactions: transactionWindow.slice(0, 8),
  };
}

export type BusinessPublicationRow = {
  entityType: "EVENT" | "OFFER" | "PLACE";
  entityId: string;
  title: string;
  status: string;
  metrics: MetricMap[string];
};

/**
 * Full list of a business's own publications with canonical aggregate metrics.
 * Reuses the exact same ownership queries as `getBusinessWorkspaceData` and
 * the same `getPerformanceMetricsByEntity` aggregation — not a parallel KPI
 * pipeline. The compatibility field `views` means card impressions.
 */
export async function getBusinessPublicationsPerformance(params: {
  userId: string;
  businessId: string;
  dateRange?: { start: Date; end: Date };
}): Promise<BusinessPublicationRow[]> {
  const [events, offers, places] = await Promise.all([
    prisma.activity.findMany({
      where: {
        OR: [{ businessId: params.businessId }, { ownerUserId: params.userId }],
        type: "EVENT",
      },
      select: { id: true, title: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.offer.findMany({
      where: {
        archivedAt: null,
        place: {
          OR: [{ ownerBusinessId: params.businessId }, { createdByUserId: params.userId }],
        },
      },
      select: { id: true, title: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.place.findMany({
      where: {
        archivedAt: null,
        OR: [{ ownerBusinessId: params.businessId }, { createdByUserId: params.userId }],
      },
      select: { id: true, title: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const metricsByEntity = await getPerformanceMetricsByEntity({
    events,
    offers,
    places,
    dateRange: params.dateRange,
  });

  const toRow = (
    entityType: BusinessPublicationRow["entityType"],
    item: { id: string; title: string; status: string },
  ): BusinessPublicationRow => ({
    entityType,
    entityId: item.id,
    title: item.title,
    status: item.status,
    metrics: metricsByEntity.get(`${entityType}:${item.id}`) ?? emptyMetrics(),
  });

  return [
    ...events.map((e) => toRow("EVENT", e)),
    ...offers.map((o) => toRow("OFFER", o)),
    ...places.map((p) => toRow("PLACE", p)),
  ].sort(
    (a, b) =>
      b.metrics.ctaClicks - a.metrics.ctaClicks ||
      b.metrics.opens - a.metrics.opens,
  );
}
