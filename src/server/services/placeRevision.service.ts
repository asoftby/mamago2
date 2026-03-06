/**
 * Place Revision Service
 * Handles post-publication Place edits via PlaceRevision
 * Server-only - do not import in client components
 */

import prisma from "@/lib/prisma";
import { PlaceRevisionStatus, LocationSource, PlaceKind } from "@prisma/client";
import {
  notifyPlaceUpdateApproved,
  notifyPlaceUpdateNeedsRevision,
  notifyPlaceUpdateRejected,
} from "./notification.service";

/**
 * Data structure for revision snapshot fields
 */
export interface PlaceRevisionData {
  title?: string;
  category?: string;
  shortDesc?: string;
  description?: string | null;
  logoImageId?: string | null;
  googlePlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
  formattedAddr?: string | null;
  addressJson?: any;
  countryCode?: string | null;
  cityId?: string | null;
  locationSource?: LocationSource;
  customAddress?: string | null;
  districtAutoId?: string | null;
  districtManualId?: string | null;
  metroAutoId?: string | null;
  metroAutoDistanceM?: number | null;
  metroManualId?: string | null;
  metroManualDistanceM?: number | null;
  placeKind?: PlaceKind;
  parentPlaceId?: string | null;
  unitLabel?: string | null;
  floor?: string | null;
  unit?: string | null;
  phone?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  ageTags?: string[];
  visitFormats?: string[];
  activityTypes?: string[];
}

/**
 * Get active revision for a Place (DRAFT, PENDING, or NEEDS_REVISION)
 * Returns null if no active revision exists
 */
export async function getActiveRevision(placeId: string) {
  return prisma.placeRevision.findFirst({
    where: {
      placeId,
      status: {
        in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Check if Place has an active revision
 */
export async function hasActiveRevision(placeId: string): Promise<boolean> {
  const count = await prisma.placeRevision.count({
    where: {
      placeId,
      status: {
        in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
      },
    },
  });
  return count > 0;
}

/**
 * Get or create active revision for a published Place
 * Enforces one-active-revision rule
 * Creates snapshot from current Place data if no active revision exists
 */
export async function getOrCreatePlaceRevision(
  placeId: string,
  businessUserId: string
) {
  // Get the Place with ownership check
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.ownerUserId !== businessUserId) {
    throw new Error("Unauthorized: not place owner");
  }

  if (place.status !== "PUBLISHED") {
    throw new Error("Can only create revisions for published Places");
  }

  // Check for existing active revision
  const existingRevision = await getActiveRevision(placeId);
  if (existingRevision) {
    return existingRevision;
  }

  // Create new revision from current Place data
  const revision = await prisma.placeRevision.create({
    data: {
      placeId,
      status: "DRAFT",
      // Snapshot current Place data
      title: place.title,
      category: place.category,
      shortDesc: place.shortDesc,
      description: place.description,
      logoImageId: place.logoImageId,
      googlePlaceId: place.googlePlaceId,
      lat: place.lat,
      lng: place.lng,
      formattedAddr: place.formattedAddr,
      addressJson: place.addressJson as any,
      countryCode: place.countryCode,
      cityId: place.cityId,
      locationSource: place.locationSource,
      customAddress: place.customAddress,
      districtAutoId: place.districtAutoId,
      districtManualId: place.districtManualId,
      metroAutoId: place.metroAutoId,
      metroAutoDistanceM: place.metroAutoDistanceM,
      metroManualId: place.metroManualId,
      metroManualDistanceM: place.metroManualDistanceM,
      placeKind: place.placeKind,
      parentPlaceId: place.parentPlaceId,
      unitLabel: place.unitLabel,
      floor: place.floor,
      unit: place.unit,
      phone: place.phone,
      website: place.website,
      instagramHandle: place.instagramHandle,
      instagramUrl: place.instagramUrl,
      ageTags: place.ageTags,
      visitFormats: place.visitFormats,
      activityTypes: place.activityTypes,
      // Copy images
      images: {
        create: place.images.map((img) => ({
          kind: img.kind,
          url: img.url,
          width: img.width,
          height: img.height,
          blurhash: img.blurhash,
          sortOrder: img.sortOrder,
        })),
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return revision;
}

/**
 * Save revision draft (update fields)
 * Only allowed for DRAFT or NEEDS_REVISION status
 */
export async function savePlaceRevisionDraft(
  revisionId: string,
  data: PlaceRevisionData,
  businessUserId: string
) {
  // Get revision with ownership check
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.place.ownerUserId !== businessUserId) {
    throw new Error("Unauthorized: not place owner");
  }

  if (revision.status !== "DRAFT" && revision.status !== "NEEDS_REVISION") {
    throw new Error(
      `Cannot edit revision with status: ${revision.status}. Only DRAFT and NEEDS_REVISION can be edited.`
    );
  }

  // Filter out fields that don't exist in PlaceRevision model
  const {
    // Remove fields that don't exist in PlaceRevision
    galleryMediaIds,
    galleryUrls,
    ...validData
  } = data as any;

  // Update revision
  return prisma.placeRevision.update({
    where: { id: revisionId },
    data: validData,
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Submit revision for moderation
 * Changes status from DRAFT or NEEDS_REVISION to PENDING
 */
export async function submitPlaceRevisionForModeration(
  revisionId: string,
  businessUserId: string
) {
  // Get revision with ownership check
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.place.ownerUserId !== businessUserId) {
    throw new Error("Unauthorized: not place owner");
  }

  if (revision.status !== "DRAFT" && revision.status !== "NEEDS_REVISION") {
    throw new Error(
      `Cannot submit revision from status: ${revision.status}`
    );
  }

  // Prepare update data
  const updateData: any = {
    status: "PENDING",
    submittedAt: new Date(),
  };

  // If resubmitting after NEEDS_REVISION, set revisionResubmittedAt
  if (revision.status === "NEEDS_REVISION") {
    updateData.revisionResubmittedAt = new Date();
  }

  // Update revision
  return prisma.placeRevision.update({
    where: { id: revisionId },
    data: updateData,
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Approve revision
 * Copies revision data into Place and marks revision as APPROVED
 */
export async function approvePlaceRevision(
  revisionId: string,
  adminId: string
) {
  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(`Cannot approve revision from status: ${revision.status}`);
  }

  // Copy revision data to Place in a transaction
  await prisma.$transaction(async (tx) => {
    // Update Place with revision data
    await tx.place.update({
      where: { id: revision.placeId },
      data: {
        title: revision.title ?? revision.place.title,
        category: revision.category ?? revision.place.category,
        shortDesc: revision.shortDesc ?? revision.place.shortDesc,
        description: revision.description ?? revision.place.description,
        logoImageId: revision.logoImageId ?? revision.place.logoImageId,
        googlePlaceId: revision.googlePlaceId ?? revision.place.googlePlaceId,
        lat: revision.lat ?? revision.place.lat,
        lng: revision.lng ?? revision.place.lng,
        formattedAddr: revision.formattedAddr ?? revision.place.formattedAddr,
        addressJson: (revision.addressJson ?? revision.place.addressJson) as any,
        countryCode: revision.countryCode ?? revision.place.countryCode,
        cityId: revision.cityId ?? revision.place.cityId,
        locationSource: revision.locationSource ?? revision.place.locationSource,
        customAddress: revision.customAddress ?? revision.place.customAddress,
        districtAutoId: revision.districtAutoId ?? revision.place.districtAutoId,
        districtManualId: revision.districtManualId ?? revision.place.districtManualId,
        metroAutoId: revision.metroAutoId ?? revision.place.metroAutoId,
        metroAutoDistanceM: revision.metroAutoDistanceM ?? revision.place.metroAutoDistanceM,
        metroManualId: revision.metroManualId ?? revision.place.metroManualId,
        metroManualDistanceM: revision.metroManualDistanceM ?? revision.place.metroManualDistanceM,
        placeKind: revision.placeKind ?? revision.place.placeKind,
        parentPlaceId: revision.parentPlaceId ?? revision.place.parentPlaceId,
        unitLabel: revision.unitLabel ?? revision.place.unitLabel,
        floor: revision.floor ?? revision.place.floor,
        unit: revision.unit ?? revision.place.unit,
        phone: revision.phone ?? revision.place.phone,
        website: revision.website ?? revision.place.website,
        instagramHandle: revision.instagramHandle ?? revision.place.instagramHandle,
        instagramUrl: revision.instagramUrl ?? revision.place.instagramUrl,
        ageTags: revision.ageTags,
        visitFormats: revision.visitFormats,
        activityTypes: revision.activityTypes,
      },
    });

    // Delete old Place images and create new ones from revision
    await tx.placeImage.deleteMany({
      where: { placeId: revision.placeId },
    });

    await tx.placeImage.createMany({
      data: revision.images.map((img) => ({
        placeId: revision.placeId,
        kind: img.kind,
        url: img.url,
        width: img.width,
        height: img.height,
        blurhash: img.blurhash,
        sortOrder: img.sortOrder,
      })),
    });

    // Mark revision as APPROVED
    await tx.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
      },
    });

    // Log moderation action
    await tx.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "APPROVE",
        message: "Place revision approved",
        reviewedByUserId: adminId,
      },
    });
  });

  // Create notification (outside transaction for resilience)
  try {
    await notifyPlaceUpdateApproved(
      revision.placeId,
      revision.title ?? revision.place.title,
      revision.place.ownerUserId
    );
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
    // Don't fail the approval if notification fails
  }
}

/**
 * Request changes for revision
 * Changes status from PENDING to NEEDS_REVISION
 */
export async function requestPlaceRevisionChanges(
  revisionId: string,
  adminId: string,
  comment: string
) {
  if (!comment || comment.trim().length === 0) {
    throw new Error("Comment is required when requesting changes");
  }

  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(
      `Cannot request changes from status: ${revision.status}`
    );
  }

  // Update revision
  await prisma.$transaction([
    prisma.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "NEEDS_REVISION",
        moderatorComment: comment,
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
        revisionRequestedAt: new Date(),
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "NEEDS_REVISION",
        message: comment,
        reviewedByUserId: adminId,
      },
    }),
  ]);

  // Get Place for notification
  const place = await prisma.place.findUnique({
    where: { id: revision.placeId },
    select: {
      title: true,
      ownerUserId: true,
    },
  });

  // Create notification (outside transaction for resilience)
  if (place) {
    try {
      await notifyPlaceUpdateNeedsRevision(
        revision.placeId,
        revision.title ?? place.title,
        place.ownerUserId,
        comment
      );
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't fail the moderation if notification fails
    }
  }
}

/**
 * Reject revision
 * Changes status from PENDING to REJECTED
 */
export async function rejectPlaceRevision(
  revisionId: string,
  adminId: string,
  comment: string
) {
  if (!comment || comment.trim().length === 0) {
    throw new Error("Comment is required when rejecting revision");
  }

  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(`Cannot reject revision from status: ${revision.status}`);
  }

  // Update revision
  await prisma.$transaction([
    prisma.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "REJECTED",
        moderatorComment: comment,
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "REJECT",
        message: comment,
        reviewedByUserId: adminId,
      },
    }),
  ]);

  // Get Place for notification
  const place = await prisma.place.findUnique({
    where: { id: revision.placeId },
    select: {
      title: true,
      ownerUserId: true,
    },
  });

  // Create notification (outside transaction for resilience)
  if (place) {
    try {
      await notifyPlaceUpdateRejected(
        revision.placeId,
        revision.title ?? place.title,
        place.ownerUserId,
        comment
      );
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't fail the moderation if notification fails
    }
  }
}

/**
 * Get expired revisions (NEEDS_REVISION for more than specified days)
 * Used for admin filtering and follow-up
 */
export async function getExpiredRevisions(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.placeRevision.findMany({
    where: {
      status: "NEEDS_REVISION",
      revisionRequestedAt: {
        lt: cutoffDate,
      },
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          city: {
            select: {
              name: true,
            },
          },
          owner: {
            select: {
              id: true,
              email: true,
              business: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      revisionRequestedAt: "asc",
    },
  });
}

/**
 * Calculate days since revision was requested
 */
export function calculateDaysSinceRevisionRequest(revisionRequestedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - revisionRequestedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
