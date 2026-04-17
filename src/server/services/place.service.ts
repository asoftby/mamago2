/**
 * Place Service
 * 
 * Centralized business logic for Place operations.
 * Ensures consistent filtering and authorization across the app.
 */

import prisma from "@/lib/prisma";
import { ContentStatus, Role, Prisma } from "@prisma/client";
import { canManagePlaceAsync, getUserBusinessId } from "@/lib/auth/placeAccess";

/**
 * Get places for current business user
 * 
 * SECURITY: Returns places created by user OR owned by their business
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
  // Get user's business
  const businessId = await getUserBusinessId(userId);

  const where: Prisma.PlaceWhereInput = {
    // Show places created by user OR owned by their business
    OR: [
      { createdByUserId: userId },
      ...(businessId ? [{ ownerBusinessId: businessId }] : []),
    ],
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
 * Check if user can manage a place (business-based ownership)
 * 
 * @param placeId - Place ID to check
 * @param user - User object with id and role
 * @returns true if user can manage the place
 */
export async function userCanManagePlace(
  placeId: string,
  user: { id: string; role: Role }
): Promise<boolean> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { 
      createdByUserId: true,
      ownerBusinessId: true,
    },
  });

  if (!place) {
    return false;
  }

  return await canManagePlaceAsync(user, place);
}

/**
 * Get place with ownership verification (business-based)
 * 
 * @param placeId - Place ID
 * @param user - User object with id and role
 * @throws Error if place not found or user can't manage it
 */
export async function getPlaceForOwner(
  placeId: string,
  userId: string,
  userRole: Role = "BUSINESS_OWNER"
) {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      ownerBusiness: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  // Check access using business-based ownership
  const canManage = await canManagePlaceAsync(
    { id: userId, role: userRole },
    place
  );

  if (!canManage) {
    throw new Error("Access denied: You don't have permission to manage this place");
  }

  return place;
}
