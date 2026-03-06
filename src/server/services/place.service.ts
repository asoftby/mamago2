/**
 * Place Service
 * 
 * Centralized business logic for Place operations.
 * Ensures consistent filtering and authorization across the app.
 */

import prisma from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

/**
 * Get places for current business user
 * 
 * SECURITY: Only returns places owned by the specified user
 * 
 * @param userId - Current user ID (must be BUSINESS_OWNER)
 * @param options - Filter options
 */
export async function getBusinessPlaces(
  userId: string,
  options: {
    archived?: boolean; // true = archived only, false = active only, undefined = all
    status?: ContentStatus;
  } = {}
) {
  const where: any = {
    ownerUserId: userId, // CRITICAL: Always filter by owner
  };

  // Archive filter
  if (options.archived === true) {
    where.archivedAt = { not: null };
  } else if (options.archived === false) {
    where.archivedAt = null;
  }
  // If undefined, don't filter by archive status

  // Status filter
  if (options.status) {
    where.status = options.status;
  }

  return prisma.place.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      formattedAddr: true,
      customAddress: true,
      moderatorComment: true,
      revisionRequestedAt: true,
      archivedAt: true,
      city: {
        select: {
          hasMetro: true,
          metroMaxDistanceM: true,
        },
      },
      districtAuto: {
        select: {
          name: true,
        },
      },
      districtManual: {
        select: {
          name: true,
        },
      },
      metroAuto: {
        select: {
          name: true,
        },
      },
      metroAutoDistanceM: true,
      metroManual: {
        select: {
          name: true,
        },
      },
      metroManualDistanceM: true,
      images: {
        select: {
          id: true,
          url: true,
          kind: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

/**
 * Check if user owns a place
 * 
 * @param placeId - Place ID to check
 * @param userId - User ID to verify ownership
 * @returns true if user owns the place
 */
export async function userOwnsPlace(placeId: string, userId: string): Promise<boolean> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { ownerUserId: true },
  });

  return place?.ownerUserId === userId;
}

/**
 * Get place with ownership verification
 * 
 * @param placeId - Place ID
 * @param userId - User ID (for ownership check)
 * @throws Error if place not found or user doesn't own it
 */
export async function getPlaceForOwner(placeId: string, userId: string) {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.ownerUserId !== userId) {
    throw new Error("Access denied: You don't own this place");
  }

  return place;
}
