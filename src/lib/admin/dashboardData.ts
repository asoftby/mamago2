import { BillingTransactionType } from "@prisma/client";
import prisma from "@/lib/prisma";

export interface ActionCenterItem {
  id: string;
  type: "moderation" | "improvement" | "verification" | "notification";
  title: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface RevenueSnapshot {
  revenue: number;
  mrr: number;
  boostRevenue: number;
  newSubscriptions: number;
  leadsGenerated: number; // TODO: Lead model absent, always 0
  revenuePrev: number;
}

export interface MoneyRadarItem {
  id: string;
  title: string;
  description: string;
  count: number;
  link: string;
  potential: number;
}

export interface NeedsAttentionItem {
  id: string;
  type: "place" | "event" | "improvement" | "business";
  title: string;
  description: string;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface ContentQueueItem {
  id: string;
  label: string;
  count: number;
  link: string;
}

export interface ContentQualityItem {
  id: string;
  label: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface RecentActivityItem {
  id: string;
  type: "approval" | "creation" | "edit" | "request";
  actor: string;
  action: string;
  entity: string;
  timestamp: Date;
  link?: string;
}

const INCOME_TYPES: BillingTransactionType[] = [
  BillingTransactionType.SUBSCRIPTION_CHARGE,
  BillingTransactionType.SUBSCRIPTION_RENEWAL,
  BillingTransactionType.DEPOSIT_TOPUP,
  BillingTransactionType.LEAD_CHARGE,
  BillingTransactionType.PROMOTION_CHARGE,
  BillingTransactionType.FEATURE_CHARGE,
];

export async function getRevenueSnapshot(
  from: Date,
  to: Date,
): Promise<RevenueSnapshot> {
  try {
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo = from;

    const [revenueAgg, revenuePrevAgg, boostAgg, newSubs, activeSubs] =
      await Promise.all([
        prisma.billingTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: { in: INCOME_TYPES },
            status: "SUCCEEDED",
            occurredAt: { gte: from, lte: to },
          },
        }),
        prisma.billingTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: { in: INCOME_TYPES },
            status: "SUCCEEDED",
            occurredAt: { gte: prevFrom, lte: prevTo },
          },
        }),
        prisma.billingTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: BillingTransactionType.PROMOTION_CHARGE,
            status: "SUCCEEDED",
            occurredAt: { gte: from, lte: to },
          },
        }),
        prisma.subscription.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        prisma.subscription.findMany({
          where: { status: "ACTIVE" },
          select: { plan: { select: { price: true, interval: true } } },
        }),
      ]);

    const mrr = activeSubs.reduce((sum, sub) => {
      const price = Number(sub.plan.price);
      return sum + (sub.plan.interval === "MONTH" ? price : price / 12);
    }, 0);

    return {
      revenue: Number(revenueAgg._sum?.amount ?? 0),
      mrr: Math.round(mrr * 100) / 100,
      boostRevenue: Number(boostAgg._sum?.amount ?? 0),
      newSubscriptions: newSubs,
      leadsGenerated: 0, // TODO: Lead model absent
      revenuePrev: Number(revenuePrevAgg._sum?.amount ?? 0),
    };
  } catch (err) {
    console.error("[dashboard] getRevenueSnapshot failed", err);
    return {
      revenue: 0,
      mrr: 0,
      boostRevenue: 0,
      newSubscriptions: 0,
      leadsGenerated: 0,
      revenuePrev: 0,
    };
  }
}

export async function getActionCenterData(): Promise<ActionCenterItem[]> {
  try {
    const [pendingPlaces, pendingReviews, pendingRevisions, pendingClaims] =
      await Promise.all([
        prisma.place.count({ where: { status: "PENDING" } }),
        prisma.placeReview.count({ where: { status: "PENDING" } }),
        prisma.placeRevision.count({ where: { status: "PENDING" } }),
        prisma.placeClaimRequest.count({ where: { status: "PENDING" } }),
      ]);

    const items: ActionCenterItem[] = [];

    if (pendingPlaces > 0) {
      items.push({
        id: "pending-places",
        type: "moderation",
        title: "Места на модерации",
        count: pendingPlaces,
        link: "/admin/moderation/places",
        severity: pendingPlaces > 10 ? "critical" : "high",
      });
    }

    if (pendingRevisions > 0) {
      items.push({
        id: "pending-revisions",
        type: "moderation",
        title: "Правки мест",
        count: pendingRevisions,
        link: "/admin/moderation/revisions",
        severity: "medium",
      });
    }

    if (pendingReviews > 0) {
      items.push({
        id: "pending-reviews",
        type: "moderation",
        title: "Отзывы на модерации",
        count: pendingReviews,
        link: "/admin/moderation/reviews",
        severity: "medium",
      });
    }

    if (pendingClaims > 0) {
      items.push({
        id: "pending-claims",
        type: "verification",
        title: "Заявки на владение",
        count: pendingClaims,
        link: "/admin/moderation/claims",
        severity: "high",
      });
    }

    return items;
  } catch (err) {
    console.error("[dashboard] getActionCenterData failed", err);
    return [];
  }
}

export async function getMoneyRadarData(): Promise<MoneyRadarItem[]> {
  try {
    const [incompleteProfiles, lowBalance, premiumCandidates] =
      await Promise.all([
        prisma.place.count({
          where: {
            status: "PUBLISHED",
            OR: [{ description: null }, { logoImageId: null }],
          },
        }),
        prisma.billingAccount.count({
          where: {
            status: "ACTIVE",
            depositBalance: { lt: 100 },
          },
        }),
        prisma.business.count({
          where: {
            verificationStatus: "APPROVED",
            billingAccount: {
              subscriptions: { none: { status: "ACTIVE" } },
            },
          },
        }),
      ]);

    const items: MoneyRadarItem[] = [];

    if (incompleteProfiles > 0) {
      items.push({
        id: "incomplete-profiles",
        title: "Неполные профили",
        description: "Места без описания или фото",
        count: incompleteProfiles,
        link: "/admin/moderation/places?filter=incomplete",
        potential: incompleteProfiles * 50,
      });
    }

    if (lowBalance > 0) {
      items.push({
        id: "low-balance",
        title: "Низкий баланс",
        description: "Партнёры с балансом < 100 б",
        count: lowBalance,
        link: "/admin/billing",
        potential: lowBalance * 200,
      });
    }

    if (premiumCandidates > 0) {
      items.push({
        id: "premium-candidates",
        title: "Кандидаты в премиум",
        description: "Верифицированные бизнесы без подписки",
        count: premiumCandidates,
        link: "/admin/billing/businesses",
        potential: premiumCandidates * 150,
      });
    }

    return items;
  } catch (err) {
    console.error("[dashboard] getMoneyRadarData failed", err);
    return [];
  }
}

export async function getNeedsAttentionData(): Promise<NeedsAttentionItem[]> {
  try {
    const [pendingVerifications, pendingClaims] = await Promise.all([
      prisma.business.count({ where: { verificationStatus: "PENDING" } }),
      prisma.placeClaimRequest.count({ where: { status: "PENDING" } }),
    ]);

    const items: NeedsAttentionItem[] = [];

    if (pendingVerifications > 0) {
      items.push({
        id: "biz-verifications",
        type: "business",
        title: `${pendingVerifications} верификаций бизнеса`,
        description: "Ожидают проверки документов",
        link: "/admin/business-verification",
        severity: pendingVerifications > 5 ? "high" : "medium",
      });
    }

    if (pendingClaims > 0) {
      items.push({
        id: "place-claims",
        type: "place",
        title: `${pendingClaims} заявок на владение`,
        description: "Требуют проверки и подтверждения",
        link: "/admin/moderation/claims",
        severity: "medium",
      });
    }

    return items;
  } catch (err) {
    console.error("[dashboard] getNeedsAttentionData failed", err);
    return [];
  }
}

export async function getContentQueuesData(): Promise<ContentQueueItem[]> {
  try {
    const [pendingPlaces, pendingRevisions, pendingReviews] =
      await Promise.all([
        prisma.place.count({ where: { status: "PENDING" } }),
        prisma.placeRevision.count({ where: { status: "PENDING" } }),
        prisma.placeReview.count({ where: { status: "PENDING" } }),
      ]);

    return [
      {
        id: "places",
        label: "Места",
        count: pendingPlaces,
        link: "/admin/moderation/places",
      },
      {
        id: "revisions",
        label: "Правки мест",
        count: pendingRevisions,
        link: "/admin/moderation/revisions",
      },
      {
        id: "reviews",
        label: "Отзывы",
        count: pendingReviews,
        link: "/admin/moderation/reviews",
      },
    ];
  } catch (err) {
    console.error("[dashboard] getContentQueuesData failed", err);
    return [];
  }
}

export async function getContentQualityData(): Promise<ContentQualityItem[]> {
  try {
    const [noCover, noDesc, noAddress] = await Promise.all([
      prisma.place.count({
        where: { status: "PUBLISHED", logoImageId: null },
      }),
      prisma.place.count({
        where: { status: "PUBLISHED", description: null },
      }),
      prisma.place.count({
        where: {
          status: "PUBLISHED",
          formattedAddr: null,
          customAddress: null,
        },
      }),
    ]);

    return [
      {
        id: "no-cover",
        label: "Без фото",
        count: noCover,
        link: "/admin/moderation/places?filter=no_cover",
        severity: noCover > 20 ? "high" : noCover > 5 ? "medium" : "low",
      },
      {
        id: "no-desc",
        label: "Без описания",
        count: noDesc,
        link: "/admin/moderation/places?filter=no_seo",
        severity: noDesc > 20 ? "high" : noDesc > 5 ? "medium" : "low",
      },
      {
        id: "no-address",
        label: "Без адреса",
        count: noAddress,
        link: "/admin/moderation/places?filter=no_taxonomy",
        severity: noAddress > 10 ? "high" : noAddress > 2 ? "medium" : "low",
      },
    ];
  } catch (err) {
    console.error("[dashboard] getContentQualityData failed", err);
    return [];
  }
}

export async function getRecentActivityData(): Promise<RecentActivityItem[]> {
  try {
    const [recentPlaces, recentReviews, recentBusinesses, recentUsers] =
      await Promise.all([
        prisma.place.findMany({
          where: { status: { not: "DELETED" } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, createdAt: true, status: true },
        }),
        prisma.placeReview.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            authorName: true,
            createdAt: true,
            place: { select: { id: true, title: true } },
          },
        }),
        prisma.business.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, createdAt: true },
        }),
        prisma.user.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, displayName: true, email: true, createdAt: true },
        }),
      ]);

    const items: RecentActivityItem[] = [
      ...recentPlaces.map((p) => ({
        id: `place-${p.id}`,
        type: "creation" as const,
        actor: "Пользователь",
        action: "добавил место",
        entity: p.title,
        timestamp: p.createdAt,
        link: `/admin/moderation/places/${p.id}`,
      })),
      ...recentReviews.map((r) => ({
        id: `review-${r.id}`,
        type: "creation" as const,
        actor: r.authorName,
        action: "оставил отзыв о",
        entity: r.place.title,
        timestamp: r.createdAt,
        link: `/admin/moderation/reviews`,
      })),
      ...recentBusinesses.map((b) => ({
        id: `business-${b.id}`,
        type: "creation" as const,
        actor: "Партнёр",
        action: "зарегистрировал бизнес",
        entity: b.name,
        timestamp: b.createdAt,
        link: `/admin/business/${b.id}`,
      })),
      ...recentUsers.map((u) => ({
        id: `user-${u.id}`,
        type: "creation" as const,
        actor: "Система",
        action: "зарегистрировал пользователя",
        entity: u.displayName ?? u.email,
        timestamp: u.createdAt,
        link: `/admin/users/${u.id}`,
      })),
    ];

    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);
  } catch (err) {
    console.error("[dashboard] getRecentActivityData failed", err);
    return [];
  }
}
