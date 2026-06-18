/**
 * Commercial Overview Service
 * 
 * Provides aggregated commercial data for admin and business dashboards.
 * Combines contracts, placements, and notifications into actionable insights.
 */

import { prisma } from "@/lib/prisma";
import { getExpiringContracts, getExpiredContracts } from "./contracts.service";
import { getExpiringPlacements, getExpiredPlacements } from "./placements.service";
import { getExpiringServicePlacements, getExpiredServicePlacements } from "./servicePlacements.service";

/**
 * Get admin commercial overview
 */
export async function getAdminCommercialOverview() {
  const now = new Date();

  // Get counts
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeContracts,
    newContractsThisMonth,
    expiringContracts,
    expiredContracts,
    activePlacements,
    expiringPlacements,
    expiredPlacements,
    activeServicePlacements,
    expiringServicePlacements,
    expiredServicePlacements,
  ] = await Promise.all([
    prisma.businessContract.count({
      where: { status: "ACTIVE" },
    }),
    prisma.businessContract.count({
      where: { status: "ACTIVE", createdAt: { gte: startOfMonth } },
    }),
    prisma.businessContract.count({
      where: { status: "EXPIRING" },
    }),
    prisma.businessContract.count({
      where: { status: "EXPIRED" },
    }),
    prisma.businessPlacement.count({
      where: { status: "ACTIVE" },
    }),
    prisma.businessPlacement.count({
      where: { status: "EXPIRING" },
    }),
    prisma.businessPlacement.count({
      where: { status: "EXPIRED" },
    }),
    prisma.businessServicePlacement.count({
      where: { status: "ACTIVE" },
    }),
    prisma.businessServicePlacement.count({
      where: { status: "EXPIRING" },
    }),
    prisma.businessServicePlacement.count({
      where: { status: "EXPIRED" },
    }),
  ]);

  // Get businesses needing attention
  const businessesNeedingAttention = await getBusinessesNeedingAttention();

  return {
    contracts: {
      active: activeContracts,
      newThisMonth: newContractsThisMonth,
      expiring: expiringContracts,
      expired: expiredContracts,
    },
    placements: {
      active: activePlacements,
      expiring: expiringPlacements,
      expired: expiredPlacements,
    },
    servicePlacements: {
      active: activeServicePlacements,
      expiring: expiringServicePlacements,
      expired: expiredServicePlacements,
    },
    businessesNeedingAttention,
  };
}

/**
 * Get businesses needing attention
 */
export async function getBusinessesNeedingAttention() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get businesses with expiring/expired items
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        {
          contracts: {
            some: {
              OR: [
                { status: "EXPIRING" },
                { status: "EXPIRED" },
              ],
            },
          },
        },
        {
          placements: {
            some: {
              OR: [
                { status: "EXPIRING" },
                { status: "EXPIRED" },
              ],
            },
          },
        },
        {
          servicePlacements: {
            some: {
              status: "EXPIRED",
            },
          },
        },
      ],
    },
    include: {
      contracts: {
        where: {
          OR: [
            { status: "EXPIRING" },
            { status: "EXPIRED" },
          ],
        },
        orderBy: {
          endsAt: "asc",
        },
        take: 1,
      },
      placements: {
        where: {
          OR: [
            { status: "EXPIRING" },
            { status: "EXPIRED" },
          ],
        },
        orderBy: {
          endsAt: "asc",
        },
        take: 1,
      },
      servicePlacements: {
        where: {
          status: "EXPIRED",
        },
        orderBy: {
          endsAt: "desc",
        },
        take: 1,
      },
    },
    take: 20,
  });

  return businesses.map((business) => {
    const issues: string[] = [];

    if (business.contracts[0]?.status === "EXPIRED") {
      issues.push("Expired contract");
    } else if (business.contracts[0]?.status === "EXPIRING") {
      issues.push("Expiring contract");
    }

    if (business.placements[0]?.status === "EXPIRED") {
      issues.push("Expired placement");
    } else if (business.placements[0]?.status === "EXPIRING") {
      issues.push("Expiring placement");
    }

    if (business.servicePlacements[0]) {
      issues.push("Expired service");
    }

    return {
      id: business.id,
      name: business.name,
      issues,
      contract: business.contracts[0] || null,
      placement: business.placements[0] || null,
      servicePlacement: business.servicePlacements[0] || null,
    };
  });
}

/**
 * Get business commercial summary
 */
export async function getBusinessCommercialSummary(businessId: string) {
  const [
    activeContract,
    activePlacement,
    activeServicePlacements,
    unreadNotifications,
  ] = await Promise.all([
    prisma.businessContract.findFirst({
      where: {
        businessId,
        status: {
          in: ["ACTIVE", "EXPIRING"],
        },
      },
      orderBy: {
        endsAt: "asc",
      },
    }),
    prisma.businessPlacement.findFirst({
      where: {
        businessId,
        status: {
          in: ["ACTIVE", "EXPIRING"],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        endsAt: "asc",
      },
    }),
    prisma.businessServicePlacement.findMany({
      where: {
        businessId,
        status: {
          in: ["ACTIVE", "EXPIRING"],
        },
      },
      orderBy: {
        endsAt: "asc",
      },
    }),
    prisma.commercialNotification.findMany({
      where: {
        businessId,
        status: {
          in: ["PENDING", "SENT"],
        },
      },
      include: {
        relatedContract: {
          select: {
            contractNumber: true,
          },
        },
        relatedPlacement: {
          select: {
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
      take: 5,
    }),
  ]);

  return {
    contract: activeContract,
    placement: activePlacement,
    servicePlacements: activeServicePlacements,
    notifications: unreadNotifications,
  };
}

/**
 * Get expiring items summary (for cron notifications)
 */
export async function getExpiringItemsSummary(daysAhead: number) {
  const [
    expiringContracts,
    expiringPlacements,
    expiringServices,
  ] = await Promise.all([
    getExpiringContracts(daysAhead),
    getExpiringPlacements(daysAhead),
    getExpiringServicePlacements(daysAhead),
  ]);

  return {
    contracts: expiringContracts,
    placements: expiringPlacements,
    servicePlacements: expiringServices,
  };
}

/**
 * Get expired items summary (for cron notifications)
 */
export async function getExpiredItemsSummary() {
  const [
    expiredContracts,
    expiredPlacements,
    expiredServices,
  ] = await Promise.all([
    getExpiredContracts(),
    getExpiredPlacements(),
    getExpiredServicePlacements(),
  ]);

  return {
    contracts: expiredContracts,
    placements: expiredPlacements,
    servicePlacements: expiredServices,
  };
}

/**
 * Get commercial stats for admin dashboard
 */
export async function getCommercialStats() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    contractsEndingThisWeek,
    contractsEndingThisMonth,
    placementsEndingThisWeek,
    placementsEndingThisMonth,
  ] = await Promise.all([
    prisma.businessContract.count({
      where: {
        status: "ACTIVE",
        endsAt: {
          gte: now,
          lte: in7Days,
        },
      },
    }),
    prisma.businessContract.count({
      where: {
        status: "ACTIVE",
        endsAt: {
          gte: now,
          lte: in30Days,
        },
      },
    }),
    prisma.businessPlacement.count({
      where: {
        status: "ACTIVE",
        endsAt: {
          gte: now,
          lte: in7Days,
        },
      },
    }),
    prisma.businessPlacement.count({
      where: {
        status: "ACTIVE",
        endsAt: {
          gte: now,
          lte: in30Days,
        },
      },
    }),
  ]);

  return {
    contractsEndingThisWeek,
    contractsEndingThisMonth,
    placementsEndingThisWeek,
    placementsEndingThisMonth,
  };
}
