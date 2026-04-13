import {
  AnalyticsEntityType,
  BillingAccountStatus,
  BillingReferenceType,
  BillingTransactionStatus,
  BillingTransactionType,
  ContentStatus,
  OfferStatus,
  Prisma,
  PromotionActionType,
  PromotionPublicationType,
  PromotionStatus,
  type UserEventType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  PROMOTION_ACTION_COSTS,
  mapAnalyticsEntityToPromotionPublicationType,
  mapUserEventToPromotionAction,
} from "@/lib/promotion/shared";

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

type PromotionActionCountMap = Record<
  string,
  {
    saveToPlan: number;
    sendLead: number;
  }
>;

function emptyActionCounts() {
  return {
    saveToPlan: 0,
    sendLead: 0,
  };
}

function isEligibleEventStatus(status: ContentStatus) {
  return status === ContentStatus.PUBLISHED || status === ContentStatus.PENDING_UPDATE;
}

function isEligibleOfferStatus(status: OfferStatus) {
  return status === OfferStatus.PUBLISHED;
}

async function findPromotionTarget(
  tx: Prisma.TransactionClient,
  params: PromotionTargetLookupParams,
): Promise<PromotionPublicationSnapshot | null> {
  if (params.publicationType === PromotionPublicationType.EVENT) {
    const activity = await tx.activity.findFirst({
      where: {
        id: params.publicationId,
        type: "EVENT",
        OR: [
          { businessId: params.businessId },
          { place: { ownerBusinessId: params.businessId } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!activity) return null;

    return {
      id: activity.id,
      publicationType: PromotionPublicationType.EVENT,
      title: activity.title,
      status: activity.status,
      isEligible: isEligibleEventStatus(activity.status),
      reason: isEligibleEventStatus(activity.status)
        ? null
        : "Продвигать можно только опубликованные события.",
    };
  }

  const offer = await tx.offer.findFirst({
    where: {
      id: params.publicationId,
      place: {
        ownerBusinessId: params.businessId,
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  if (!offer) return null;

  return {
    id: offer.id,
    publicationType: PromotionPublicationType.OFFER,
    title: offer.title,
    status: offer.status,
    isEligible: isEligibleOfferStatus(offer.status),
    reason: isEligibleOfferStatus(offer.status)
      ? null
      : "Продвигать можно только опубликованные offers.",
  };
}

export async function getPromotionTargetForBusiness(
  params: PromotionTargetLookupParams,
): Promise<PromotionPublicationSnapshot | null> {
  return prisma.$transaction((tx) => findPromotionTarget(tx, params));
}

export async function createPromotion(params: {
  businessId: string;
  publicationId: string;
  publicationType: PromotionPublicationType;
  budget: number;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await findPromotionTarget(tx, {
      businessId: params.businessId,
      publicationId: params.publicationId,
      publicationType: params.publicationType,
    });

    if (!target) {
      throw new Error("Публикация не найдена или недоступна для этого бизнеса.");
    }

    if (!target.isEligible) {
      throw new Error(target.reason ?? "Эту публикацию пока нельзя продвигать.");
    }

    const existingPromotion = await tx.promotion.findFirst({
      where: {
        businessId: params.businessId,
        publicationId: params.publicationId,
        publicationType: params.publicationType,
        status: {
          in: [PromotionStatus.DRAFT, PromotionStatus.ACTIVE, PromotionStatus.PAUSED],
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPromotion) {
      throw new Error("Для этой публикации уже есть активное продвижение. Откройте Campaigns, чтобы управлять им.");
    }

    const billingAccount = await tx.billingAccount.findUnique({
      where: {
        businessId: params.businessId,
      },
      select: {
        id: true,
        status: true,
        depositBalance: true,
      },
    });

    if (!billingAccount) {
      throw new Error("Сначала подключите биллинг, чтобы запускать продвижение.");
    }

    if (billingAccount.status !== BillingAccountStatus.ACTIVE) {
      throw new Error("Продвижение недоступно, пока биллинговый аккаунт не активен.");
    }

    if (billingAccount.depositBalance.toNumber() < params.budget) {
      throw new Error("На депозите недостаточно средств для выбранного бюджета. Пополните баланс и попробуйте снова.");
    }

    return tx.promotion.create({
      data: {
        businessId: params.businessId,
        publicationId: params.publicationId,
        publicationType: params.publicationType,
        publicationTitle: target.title,
        budget: params.budget,
        spent: 0,
        status: PromotionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });
  });
}

export async function pausePromotion(params: {
  businessId: string;
  promotionId: string;
}) {
  return prisma.promotion.updateMany({
    where: {
      id: params.promotionId,
      businessId: params.businessId,
      status: PromotionStatus.ACTIVE,
    },
    data: {
      status: PromotionStatus.PAUSED,
      pausedAt: new Date(),
    },
  });
}

export async function resumePromotion(params: {
  businessId: string;
  promotionId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const promotion = await tx.promotion.findFirst({
      where: {
        id: params.promotionId,
        businessId: params.businessId,
      },
    });

    if (!promotion) {
      throw new Error("Продвижение не найдено.");
    }

    if (promotion.status !== PromotionStatus.PAUSED) {
      throw new Error("Возобновить можно только paused-продвижение.");
    }

    if (promotion.spent.toNumber() >= promotion.budget.toNumber()) {
      throw new Error("Бюджет продвижения уже израсходован.");
    }

    const billingAccount = await tx.billingAccount.findUnique({
      where: {
        businessId: params.businessId,
      },
      select: {
        status: true,
      },
    });

    if (!billingAccount || billingAccount.status !== BillingAccountStatus.ACTIVE) {
      throw new Error("Сначала приведите биллинг в активное состояние.");
    }

    return tx.promotion.update({
      where: {
        id: promotion.id,
      },
      data: {
        status: PromotionStatus.ACTIVE,
        pausedAt: null,
      },
    });
  });
}

export async function getPromotionOverviewData(businessId: string) {
  const promotions = await prisma.promotion.findMany({
    where: {
      businessId,
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
  });

  const promotionIds = promotions.map((promotion) => promotion.id);
  const actions = promotionIds.length
    ? await prisma.promotionAction.findMany({
        where: {
          promotionId: {
            in: promotionIds,
          },
        },
        select: {
          promotionId: true,
          actionType: true,
        },
      })
    : [];

  const countsByPromotion = new Map<string, PromotionActionCountMap[string]>();

  for (const action of actions) {
    const current = countsByPromotion.get(action.promotionId) ?? emptyActionCounts();
    if (action.actionType === PromotionActionType.SAVE_TO_PLAN) {
      current.saveToPlan += 1;
    } else if (action.actionType === PromotionActionType.SEND_LEAD) {
      current.sendLead += 1;
    }
    countsByPromotion.set(action.promotionId, current);
  }

  const totalSpend = promotions.reduce((sum, promotion) => sum + promotion.spent.toNumber(), 0);
  const totalBudget = promotions.reduce((sum, promotion) => sum + promotion.budget.toNumber(), 0);
  const totalSaveToPlan = [...countsByPromotion.values()].reduce(
    (sum, counts) => sum + counts.saveToPlan,
    0,
  );
  const totalLeads = [...countsByPromotion.values()].reduce(
    (sum, counts) => sum + counts.sendLead,
    0,
  );

  return {
    totalBudget,
    totalSpend,
    totalSaveToPlan,
    totalLeads,
    activeCount: promotions.filter((promotion) => promotion.status === PromotionStatus.ACTIVE).length,
    promotions: promotions.map((promotion) => {
      const counts = countsByPromotion.get(promotion.id) ?? emptyActionCounts();
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
        saveToPlanCount: counts.saveToPlan,
        leadCount: counts.sendLead,
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
  const publicationType = mapAnalyticsEntityToPromotionPublicationType(params.entityType);
  const actionType = mapUserEventToPromotionAction({
    eventType: params.eventType,
    meta: params.meta ?? null,
  });

  if (!publicationType || !params.entityId || !actionType) {
    return { applied: false, reason: "not_eligible" as const };
  }

  const promotion = await prisma.promotion.findFirst({
    where: {
      publicationType,
      publicationId: params.entityId,
      status: PromotionStatus.ACTIVE,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!promotion) {
    return { applied: false, reason: "no_active_promotion" as const };
  }

  const amount = PROMOTION_ACTION_COSTS[actionType];

  return prisma.$transaction(async (tx) => {
    const existingAction = await tx.promotionAction.findUnique({
      where: {
        userEventId: params.userEventId,
      },
      select: {
        id: true,
      },
    });

    if (existingAction) {
      return { applied: false, reason: "already_charged" as const };
    }

    const currentPromotion = await tx.promotion.findUnique({
      where: {
        id: promotion.id,
      },
    });

    if (!currentPromotion || currentPromotion.status !== PromotionStatus.ACTIVE) {
      return { applied: false, reason: "promotion_inactive" as const };
    }

    const remainingBudget =
      currentPromotion.budget.toNumber() - currentPromotion.spent.toNumber();

    if (remainingBudget < amount) {
      await tx.promotion.update({
        where: {
          id: currentPromotion.id,
        },
        data: {
          status: PromotionStatus.COMPLETED,
          endedAt: new Date(),
        },
      });

      return { applied: false, reason: "budget_exhausted" as const };
    }

    const billingAccount = await tx.billingAccount.findUnique({
      where: {
        businessId: currentPromotion.businessId,
      },
      select: {
        id: true,
        status: true,
        currency: true,
        depositBalance: true,
        creditLimit: true,
      },
    });

    if (!billingAccount || billingAccount.status !== BillingAccountStatus.ACTIVE) {
      await tx.promotion.update({
        where: {
          id: currentPromotion.id,
        },
        data: {
          status: PromotionStatus.PAUSED,
          pausedAt: new Date(),
        },
      });

      return { applied: false, reason: "billing_inactive" as const };
    }

    const nextBalance = billingAccount.depositBalance.toNumber() - amount;
    if (nextBalance < 0 && billingAccount.creditLimit.toNumber() === 0) {
      await tx.promotion.update({
        where: {
          id: currentPromotion.id,
        },
        data: {
          status: PromotionStatus.PAUSED,
          pausedAt: new Date(),
        },
      });

      return { applied: false, reason: "insufficient_balance" as const };
    }

    const nextSpent = currentPromotion.spent.toNumber() + amount;
    const shouldComplete = nextSpent >= currentPromotion.budget.toNumber();

    await tx.billingTransaction.create({
      data: {
        billingAccountId: billingAccount.id,
        type: BillingTransactionType.PROMOTION_CHARGE,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: new Prisma.Decimal(-amount),
        currency: billingAccount.currency,
        description:
          actionType === PromotionActionType.SAVE_TO_PLAN
            ? `Продвижение: сохранение в план для ${currentPromotion.publicationTitle}`
            : `Продвижение: лид / обращение для ${currentPromotion.publicationTitle}`,
        referenceType: BillingReferenceType.PROMOTION,
        referenceId: currentPromotion.id,
        metadata: {
          promotionId: currentPromotion.id,
          publicationId: currentPromotion.publicationId,
          publicationType: currentPromotion.publicationType,
          actionType,
          userEventId: params.userEventId,
        },
      },
    });

    await tx.billingAccount.update({
      where: {
        id: billingAccount.id,
      },
      data: {
        depositBalance: {
          decrement: amount,
        },
      },
    });

    await tx.promotion.update({
      where: {
        id: currentPromotion.id,
      },
      data: {
        spent: {
          increment: amount,
        },
        ...(shouldComplete
          ? {
              status: PromotionStatus.COMPLETED,
              endedAt: new Date(),
            }
          : {}),
      },
    });

    await tx.promotionAction.create({
      data: {
        promotionId: currentPromotion.id,
        userEventId: params.userEventId,
        actionType,
        amount,
      },
    });

    return { applied: true, reason: "charged" as const };
  });
}
