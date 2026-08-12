import {
  ContentStatus,
  OfferStatus,
  PromotionActionType,
  PromotionPublicationType,
  PromotionStatus,
  type AnalyticsEntityType,
  type UserEventType,
} from "@prisma/client";
import prisma from "@/lib/prisma";

type PromotionTargetLookupParams = {
  businessId: string;
  publicationId: string;
  publicationType: PromotionPublicationType;
};

export type PromotionPublicationSnapshot = {
  id: string;
  publicationType: PromotionPublicationType;
  title: string;
  status: string;
  isEligible: boolean;
  reason: string | null;
};

async function findPromotionTarget(
  params: PromotionTargetLookupParams,
): Promise<PromotionPublicationSnapshot | null> {
  if (params.publicationType === PromotionPublicationType.EVENT) {
    const activity = await prisma.activity.findFirst({
      where: {
        id: params.publicationId,
        type: "EVENT",
        OR: [
          { businessId: params.businessId },
          { place: { ownerBusinessId: params.businessId } },
        ],
      },
      select: { id: true, title: true, status: true },
    });
    if (!activity) return null;
    const isEligible = activity.status === ContentStatus.PUBLISHED || activity.status === ContentStatus.PENDING_UPDATE;
    return {
      id: activity.id,
      publicationType: PromotionPublicationType.EVENT,
      title: activity.title,
      status: activity.status,
      isEligible,
      reason: isEligible ? null : "Продвигать можно только опубликованные события.",
    };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.publicationId, place: { ownerBusinessId: params.businessId } },
    select: { id: true, title: true, status: true },
  });
  if (!offer) return null;
  const isEligible = offer.status === OfferStatus.PUBLISHED;
  return {
    id: offer.id,
    publicationType: PromotionPublicationType.OFFER,
    title: offer.title,
    status: offer.status,
    isEligible,
    reason: isEligible ? null : "Продвигать можно только опубликованные offers.",
  };
}

export async function getPromotionTargetForBusiness(params: PromotionTargetLookupParams) {
  return findPromotionTarget(params);
}

export async function createPromotion(params: {
  businessId: string;
  publicationId: string;
  publicationType: PromotionPublicationType;
  budget: number;
}) {
  void params;
  throw new Error("Action-based paid Promotion is not available in first PROD. Use explicit Boost purchase.");
}

/** Existing records may be paused, but never resumed into a paid state. */
export async function pausePromotion(params: { businessId: string; promotionId: string }) {
  return prisma.promotion.updateMany({
    where: { id: params.promotionId, businessId: params.businessId, status: PromotionStatus.ACTIVE },
    data: { status: PromotionStatus.PAUSED, pausedAt: new Date() },
  });
}

export async function resumePromotion(params: { businessId: string; promotionId: string }) {
  void params;
  throw new Error("Action-based paid Promotion cannot be reactivated in first PROD.");
}

export async function getPromotionOverviewData(businessId: string) {
  const promotions = await prisma.promotion.findMany({
    where: { businessId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const promotionIds = promotions.map((promotion) => promotion.id);
  const actions = promotionIds.length
    ? await prisma.promotionAction.findMany({
        where: { promotionId: { in: promotionIds } },
        select: { promotionId: true, actionType: true },
      })
    : [];

  const counts = new Map<string, { saveToPlan: number; sendLead: number }>();
  for (const action of actions) {
    const current = counts.get(action.promotionId) ?? { saveToPlan: 0, sendLead: 0 };
    if (action.actionType === PromotionActionType.SAVE_TO_PLAN) current.saveToPlan += 1;
    if (action.actionType === PromotionActionType.SEND_LEAD) current.sendLead += 1;
    counts.set(action.promotionId, current);
  }

  const totalSpend = promotions.reduce((sum, promotion) => sum + promotion.spent.toNumber(), 0);
  const totalBudget = promotions.reduce((sum, promotion) => sum + promotion.budget.toNumber(), 0);
  const totalSaveToPlan = [...counts.values()].reduce((sum, row) => sum + row.saveToPlan, 0);
  const totalLeads = [...counts.values()].reduce((sum, row) => sum + row.sendLead, 0);

  return {
    totalBudget,
    totalSpend,
    totalSaveToPlan,
    totalLeads,
    activeCount: promotions.filter((promotion) => promotion.status === PromotionStatus.ACTIVE).length,
    promotions: promotions.map((promotion) => {
      const actionCounts = counts.get(promotion.id) ?? { saveToPlan: 0, sendLead: 0 };
      const budget = promotion.budget.toNumber();
      const spent = promotion.spent.toNumber();
      return {
        id: promotion.id,
        publicationId: promotion.publicationId,
        publicationType: promotion.publicationType,
        publicationTitle: promotion.publicationTitle,
        budget,
        spent,
        remainingBudget: Math.max(budget - spent, 0),
        status: promotion.status,
        startedAt: promotion.startedAt,
        endedAt: promotion.endedAt,
        pausedAt: promotion.pausedAt,
        saveToPlanCount: actionCounts.saveToPlan,
        leadCount: actionCounts.sendLead,
      };
    }),
    costPerSave: totalSaveToPlan > 0 ? totalSpend / totalSaveToPlan : null,
    costPerLead: totalLeads > 0 ? totalSpend / totalLeads : null,
  };
}

export async function registerPromotionActionFromUserEvent(params: {
  userEventId: string;
  eventType: UserEventType;
  entityType: AnalyticsEntityType | null | undefined;
  entityId: string | null | undefined;
  meta?: Record<string, unknown> | null;
}) {
  void params;
  return { applied: false, reason: "paid_promotion_disabled" as const };
}
