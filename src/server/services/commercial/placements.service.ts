/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Business Placements Service
 * 
 * Manages commercial placement access for businesses on the platform.
 * Placements control whether a business can be visible and use premium features.
 */

import { prisma } from "@/lib/prisma";
import type { PlacementStatus, PlacementSourceType } from "@prisma/client";

export interface PlacementFilters {
  businessId?: string;
  status?: PlacementStatus;
  sourceType?: PlacementSourceType;
  expiringInDays?: number;
}

export interface CreatePlacementInput {
  businessId: string;
  sourceType: PlacementSourceType;
  planId?: string;
  startsAt: Date;
  endsAt: Date;
  graceUntil?: Date;
  notes?: string;
}

export interface UpdatePlacementInput {
  status?: PlacementStatus;
  sourceType?: PlacementSourceType;
  planId?: string;
  startsAt?: Date;
  endsAt?: Date;
  graceUntil?: Date;
  notes?: string;
}

/**
 * Get placements with filters
 */
export async function getPlacements(filters: PlacementFilters = {}) {
  const where: any = {};

  if (filters.businessId) {
    where.businessId = filters.businessId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.sourceType) {
    where.sourceType = filters.sourceType;
  }

  if (filters.expiringInDays) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + filters.expiringInDays * 24 * 60 * 60 * 1000);
    where.endsAt = {
      gte: now,
      lte: futureDate,
    };
    where.status = "ACTIVE";
  }

  return prisma.businessPlacement.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get placement by ID
 */
export async function getPlacementById(id: string) {
  return prisma.businessPlacement.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      plan: true,
    },
  });
}

/**
 * Get active placement for business
 */
export async function getActivePlacement(businessId: string) {
  return prisma.businessPlacement.findFirst({
    where: {
      businessId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
  });
}

/**
 * Get all placements for business
 */
export async function getBusinessPlacements(businessId: string) {
  return prisma.businessPlacement.findMany({
    where: { businessId },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Create new placement
 */
export async function createPlacement(input: CreatePlacementInput) {
  return prisma.businessPlacement.create({
    data: {
      businessId: input.businessId,
      sourceType: input.sourceType,
      status: "ACTIVE",
      planId: input.planId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      graceUntil: input.graceUntil,
      notes: input.notes,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      plan: true,
    },
  });
}

/**
 * Update placement
 */
export async function updatePlacement(id: string, input: UpdatePlacementInput) {
  return prisma.businessPlacement.update({
    where: { id },
    data: input,
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      plan: true,
    },
  });
}

/**
 * Extend placement
 */
export async function extendPlacement(id: string, newEndsAt: Date, newGraceUntil?: Date) {
  return prisma.businessPlacement.update({
    where: { id },
    data: {
      endsAt: newEndsAt,
      graceUntil: newGraceUntil,
      status: "ACTIVE",
    },
  });
}

/**
 * Pause placement
 */
export async function pausePlacement(id: string, reason?: string) {
  return prisma.businessPlacement.update({
    where: { id },
    data: {
      status: "PAUSED",
      notes: reason ? `Paused: ${reason}` : undefined,
    },
  });
}

/**
 * Cancel placement
 */
export async function cancelPlacement(id: string, reason?: string) {
  return prisma.businessPlacement.update({
    where: { id },
    data: {
      status: "CANCELED",
      notes: reason ? `Canceled: ${reason}` : undefined,
    },
  });
}

/**
 * Grant grace period
 */
export async function grantGracePeriod(id: string, graceUntil: Date) {
  return prisma.businessPlacement.update({
    where: { id },
    data: {
      graceUntil,
    },
  });
}

/**
 * Get expiring placements (for notifications)
 */
export async function getExpiringPlacements(daysAhead: number) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return prisma.businessPlacement.findMany({
    where: {
      status: "ACTIVE",
      endsAt: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
      plan: true,
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get expired placements
 */
export async function getExpiredPlacements() {
  const now = new Date();

  return prisma.businessPlacement.findMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING"],
      },
      endsAt: {
        lt: now,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Update placement statuses (cron job)
 */
export async function updatePlacementStatuses() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Mark placements as EXPIRING (7 days before end)
  await prisma.businessPlacement.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: {
        gte: now,
        lte: in7Days,
      },
    },
    data: {
      status: "EXPIRING",
    },
  });

  // Mark placements as EXPIRED (past end date and grace period)
  await prisma.businessPlacement.updateMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING"],
      },
      OR: [
        {
          endsAt: {
            lt: now,
          },
          graceUntil: null,
        },
        {
          graceUntil: {
            lt: now,
          },
        },
      ],
    },
    data: {
      status: "EXPIRED",
    },
  });
}
