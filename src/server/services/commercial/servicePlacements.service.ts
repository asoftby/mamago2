/**
 * Business Service Placements Service
 * 
 * Manages time-limited commercial features for specific entities
 * (places, events, offers, stories, promos).
 * Service placements are separate from global business placement.
 */

import { prisma } from "@/lib/prisma";
import type { PlacementStatus, ServiceEntityType, Prisma } from "@prisma/client";

export interface ServicePlacementFilters {
  businessId?: string;
  entityType?: ServiceEntityType;
  entityId?: string;
  status?: PlacementStatus;
  expiringInDays?: number;
}

export interface CreateServicePlacementInput {
  businessId: string;
  entityType: ServiceEntityType;
  entityId?: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string;
}

export interface UpdateServicePlacementInput {
  status?: PlacementStatus;
  entityType?: ServiceEntityType;
  entityId?: string;
  startsAt?: Date;
  endsAt?: Date;
  notes?: string;
}

/**
 * Get service placements with filters
 */
export async function getServicePlacements(filters: ServicePlacementFilters = {}) {
  const where: Prisma.BusinessServicePlacementWhereInput = {};

  if (filters.businessId) {
    where.businessId = filters.businessId;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
  }

  if (filters.status) {
    where.status = filters.status;
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

  return prisma.businessServicePlacement.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get service placement by ID
 */
export async function getServicePlacementById(id: string) {
  return prisma.businessServicePlacement.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Get active service placements for business
 */
export async function getActiveServicePlacements(businessId: string) {
  return prisma.businessServicePlacement.findMany({
    where: {
      businessId,
      status: "ACTIVE",
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get all service placements for business
 */
export async function getBusinessServicePlacements(businessId: string) {
  return prisma.businessServicePlacement.findMany({
    where: { businessId },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Create new service placement
 */
export async function createServicePlacement(input: CreateServicePlacementInput) {
  return prisma.businessServicePlacement.create({
    data: {
      businessId: input.businessId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: "ACTIVE",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes,
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
 * Update service placement
 */
export async function updateServicePlacement(id: string, input: UpdateServicePlacementInput) {
  return prisma.businessServicePlacement.update({
    where: { id },
    data: input,
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
 * Extend service placement
 */
export async function extendServicePlacement(id: string, newEndsAt: Date) {
  return prisma.businessServicePlacement.update({
    where: { id },
    data: {
      endsAt: newEndsAt,
      status: "ACTIVE",
    },
  });
}

/**
 * Cancel service placement
 */
export async function cancelServicePlacement(id: string, reason?: string) {
  return prisma.businessServicePlacement.update({
    where: { id },
    data: {
      status: "CANCELED",
      notes: reason ? `Canceled: ${reason}` : undefined,
    },
  });
}

/**
 * Get expiring service placements (for notifications)
 */
export async function getExpiringServicePlacements(daysAhead: number) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return prisma.businessServicePlacement.findMany({
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
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get expired service placements
 */
export async function getExpiredServicePlacements() {
  const now = new Date();

  return prisma.businessServicePlacement.findMany({
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
 * Update service placement statuses (cron job)
 */
export async function updateServicePlacementStatuses() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Mark service placements as EXPIRING (3 days before end)
  await prisma.businessServicePlacement.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: {
        gte: now,
        lte: in3Days,
      },
    },
    data: {
      status: "EXPIRING",
    },
  });

  // Mark service placements as EXPIRED
  await prisma.businessServicePlacement.updateMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING"],
      },
      endsAt: {
        lt: now,
      },
    },
    data: {
      status: "EXPIRED",
    },
  });
}
