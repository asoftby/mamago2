/**
 * Place Claim Service
 * 
 * Handles place ownership claim requests and approvals.
 * Business-based ownership model.
 */

import prisma from "@/lib/prisma";
import { PlaceClaimRequestStatus } from "@prisma/client";

/**
 * Get all pending claim requests
 * Admin only
 */
export async function getPendingClaimRequests() {
  return prisma.placeClaimRequest.findMany({
    where: {
      status: PlaceClaimRequestStatus.PENDING,
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          status: true,
          ownerBusinessId: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Get claim request by ID
 */
export async function getClaimRequest(claimId: string) {
  return prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          status: true,
          ownerBusinessId: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
  });
}

/**
 * Approve a place claim request
 * Sets place.ownerBusinessId to claim.businessId
 * 
 * @param claimId - Claim request ID
 * @param reviewedByUserId - Admin user ID
 * @param note - Optional admin note
 */
export async function approvePlaceClaim(
  claimId: string,
  reviewedByUserId: string,
  note?: string
) {
  const claim = await prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      placeId: true,
      businessId: true,
      status: true,
    },
  });

  if (!claim) {
    throw new Error("Claim request not found");
  }

  if (claim.status !== PlaceClaimRequestStatus.PENDING) {
    throw new Error(`Cannot approve claim with status: ${claim.status}`);
  }

  // Update place ownership and claim status in transaction
  await prisma.$transaction([
    // Set business as owner
    prisma.place.update({
      where: { id: claim.placeId },
      data: {
        ownerBusinessId: claim.businessId,
      },
    }),

    // Update claim status
    prisma.placeClaimRequest.update({
      where: { id: claimId },
      data: {
        status: PlaceClaimRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId,
        note: note || null,
      },
    }),
  ]);

  console.log(`[CLAIM] Approved claim ${claimId} - Place ${claim.placeId} now owned by Business ${claim.businessId}`);
}

/**
 * Reject a place claim request
 * Does not change place ownership
 * 
 * @param claimId - Claim request ID
 * @param reviewedByUserId - Admin user ID
 * @param note - Required rejection reason
 */
export async function rejectPlaceClaim(
  claimId: string,
  reviewedByUserId: string,
  note: string
) {
  if (!note?.trim()) {
    throw new Error("Rejection note is required");
  }

  const claim = await prisma.placeClaimRequest.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!claim) {
    throw new Error("Claim request not found");
  }

  if (claim.status !== PlaceClaimRequestStatus.PENDING) {
    throw new Error(`Cannot reject claim with status: ${claim.status}`);
  }

  await prisma.placeClaimRequest.update({
    where: { id: claimId },
    data: {
      status: PlaceClaimRequestStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedByUserId,
      note,
    },
  });

  console.log(`[CLAIM] Rejected claim ${claimId} - Reason: ${note}`);
}

/**
 * Manually assign a business as owner of a place
 * Admin only - direct assignment without claim request
 * 
 * @param placeId - Place ID
 * @param businessId - Business ID to assign as owner
 * @param assignedByUserId - Admin user ID
 */
export async function manuallyAssignPlaceOwner(
  placeId: string,
  businessId: string,
  assignedByUserId: string
) {
  // Verify place exists
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, title: true, ownerBusinessId: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  // Verify business exists
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  // Update place ownership
  await prisma.place.update({
    where: { id: placeId },
    data: {
      ownerBusinessId: businessId,
    },
  });

  console.log(`[CLAIM] Manual assignment - Place ${placeId} (${place.title}) assigned to Business ${businessId} (${business.name}) by admin ${assignedByUserId}`);
}
