import prisma from "@/lib/prisma";
import { PlanInterval } from "@prisma/client";

/**
 * Get all plans
 */
export async function getPlans(filters?: {
  isActive?: boolean;
  isVisible?: boolean;
}) {
  const where: any = {};

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.isVisible !== undefined) {
    where.isVisible = filters.isVisible;
  }

  const plans = await prisma.plan.findMany({
    where,
    include: {
      _count: {
        select: {
          subscriptions: {
            where: {
              status: {
                in: ["ACTIVE", "TRIALING"],
              },
            },
          },
        },
      },
    },
    orderBy: [
      { price: "asc" },
      { createdAt: "asc" },
    ],
  });

  return plans;
}

/**
 * Get plan by ID
 */
export async function getPlanById(id: string) {
  return prisma.plan.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          subscriptions: {
            where: {
              status: {
                in: ["ACTIVE", "TRIALING"],
              },
            },
          },
        },
      },
      subscriptions: {
        where: {
          status: {
            in: ["ACTIVE", "TRIALING"],
          },
        },
        include: {
          billingAccount: {
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        take: 10,
      },
    },
  });
}

/**
 * Get plan usage summary
 */
export async function getPlanUsageSummary(id: string) {
  const [activeCount, trialingCount, pastDueCount, totalRevenue] = await Promise.all([
    prisma.subscription.count({
      where: {
        planId: id,
        status: "ACTIVE",
      },
    }),
    prisma.subscription.count({
      where: {
        planId: id,
        status: "TRIALING",
      },
    }),
    prisma.subscription.count({
      where: {
        planId: id,
        status: "PAST_DUE",
      },
    }),
    prisma.billingTransaction.aggregate({
      where: {
        subscription: {
          planId: id,
        },
        type: {
          in: ["SUBSCRIPTION_CHARGE", "SUBSCRIPTION_RENEWAL"],
        },
        status: "SUCCEEDED",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    activeCount,
    trialingCount,
    pastDueCount,
    totalRevenue: Math.abs(totalRevenue._sum.amount?.toNumber() || 0),
  };
}

/**
 * Create new plan
 */
export async function createPlan(input: {
  code: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  interval?: PlanInterval;
  maxPlaces?: number;
  maxOffers?: number;
  maxEvents?: number;
  storiesPerMonth?: number;
  hasPriorityBoost?: boolean;
  hasLeadAccess?: boolean;
  hasAnalytics?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
}) {
  // Check if code already exists
  const existing = await prisma.plan.findUnique({
    where: { code: input.code },
  });

  if (existing) {
    throw new Error("Plan with this code already exists");
  }

  return prisma.plan.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      price: input.price,
      currency: input.currency || "BYN",
      interval: input.interval || "MONTH",
      maxPlaces: input.maxPlaces || 0,
      maxOffers: input.maxOffers || 0,
      maxEvents: input.maxEvents || 0,
      storiesPerMonth: input.storiesPerMonth || 0,
      hasPriorityBoost: input.hasPriorityBoost || false,
      hasLeadAccess: input.hasLeadAccess || false,
      hasAnalytics: input.hasAnalytics || false,
      isActive: input.isActive !== undefined ? input.isActive : true,
      isVisible: input.isVisible !== undefined ? input.isVisible : true,
    },
  });
}

/**
 * Update plan
 */
export async function updatePlan(
  id: string,
  input: {
    name?: string;
    description?: string;
    price?: number;
    maxPlaces?: number;
    maxOffers?: number;
    maxEvents?: number;
    storiesPerMonth?: number;
    hasPriorityBoost?: boolean;
    hasLeadAccess?: boolean;
    hasAnalytics?: boolean;
    isVisible?: boolean;
  }
) {
  return prisma.plan.update({
    where: { id },
    data: input,
  });
}

/**
 * Toggle plan active status
 */
export async function togglePlanActive(id: string, isActive: boolean) {
  return prisma.plan.update({
    where: { id },
    data: { isActive },
  });
}
