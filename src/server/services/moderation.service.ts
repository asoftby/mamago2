/**
 * Unified Moderation Service
 * Handles moderation workflow for Place, Activity, and other content entities
 * Reuses Business Verification pattern with ContentStatus enum
 * Server-only - do not import in client components
 */

import prisma from "@/lib/prisma";
import { ContentStatus, ModerationEntityType, ModerationAction } from "@prisma/client";

/**
 * Log a moderation action
 */
export async function logModeration(
  entityType: ModerationEntityType,
  entityId: string,
  action: ModerationAction,
  message: string | null,
  reviewedByUserId: string | null
): Promise<void> {
  await prisma.moderationLog.create({
    data: {
      entityType,
      entityId,
      action,
      message,
      reviewedByUserId,
    },
  });
}

/**
 * Get moderation logs for an entity
 */
export async function getModerationLogs(
  entityType: ModerationEntityType,
  entityId: string
) {
  return prisma.moderationLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      reviewedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get the latest moderation message for an entity
 */
export async function getLatestModerationMessage(
  entityType: ModerationEntityType,
  entityId: string
): Promise<string | null> {
  const latestLog = await prisma.moderationLog.findFirst({
    where: {
      entityType,
      entityId,
      message: { not: null },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      message: true,
    },
  });

  return latestLog?.message || null;
}

/**
 * Approve a Place
 * Changes status from PENDING to PUBLISHED
 */
export async function approvePlace(
  placeId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.status !== "PENDING") {
    throw new Error(`Cannot approve from status: ${place.status}`);
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "PUBLISHED",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "APPROVE",
        message: message || "Approved",
        reviewedByUserId,
      },
    }),
  ]);
}

/**
 * Request changes for a Place (initial moderation)
 * Changes status from PENDING to NEEDS_REVISION
 * Message is required
 * 
 * Note: For post-publication edits, use PlaceRevision flow instead
 */
export async function needsRevisionPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for NEEDS_REVISION status");
  }

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.status !== "PENDING") {
    throw new Error(`Cannot request changes from status: ${place.status}`);
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "NEEDS_REVISION",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "NEEDS_REVISION",
        message,
        reviewedByUserId,
      },
    }),
  ]);
}

/**
 * Reject a Place
 * Changes status from PENDING to REJECTED
 * Message is required
 */
export async function rejectPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for REJECTED status");
  }

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.status !== "PENDING") {
    throw new Error(`Cannot reject from status: ${place.status}`);
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "REJECTED",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "REJECT",
        message,
        reviewedByUserId,
      },
    }),
  ]);
}

/**
 * Submit a Place for initial moderation
 * Changes status from DRAFT, NEEDS_REVISION, or REJECTED to PENDING
 * 
 * Note: For post-publication edits, use PlaceRevision flow instead
 */
export async function submitPlace(
  placeId: string,
  ownerUserId: string
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, ownerUserId: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (place.ownerUserId !== ownerUserId) {
    throw new Error("Unauthorized: not place owner");
  }

  if (
    place.status !== "DRAFT" &&
    place.status !== "NEEDS_REVISION" &&
    place.status !== "REJECTED"
  ) {
    throw new Error(`Cannot submit from status: ${place.status}`);
  }

  // Prepare update data
  const updateData: any = {
    status: "PENDING",
  };

  // If resubmitting after NEEDS_REVISION, set revisionResubmittedAt
  if (place.status === "NEEDS_REVISION") {
    updateData.revisionResubmittedAt = new Date();
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: updateData,
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "SUBMIT",
        message: place.status === "NEEDS_REVISION" 
          ? "Resubmitted after revision" 
          : "Submitted for moderation",
        reviewedByUserId: null,
      },
    }),
  ]);
}

/**
 * Approve an Activity
 * Changes status from PENDING to PUBLISHED
 */
export async function approveActivity(
  activityId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });

  if (!activity) {
    throw new Error("Activity not found");
  }

  if (activity.status !== "PENDING") {
    throw new Error(`Cannot approve from status: ${activity.status}`);
  }

  await prisma.$transaction([
    // Update activity status
    prisma.activity.update({
      where: { id: activityId },
      data: {
        status: "PUBLISHED",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "ACTIVITY",
        entityId: activityId,
        action: "APPROVE",
        message: message || "Approved",
        reviewedByUserId,
      },
    }),
  ]);
}

/**
 * Request changes for an Activity
 * Changes status from PENDING to NEEDS_REVISION
 * Message is required
 */
export async function needsRevisionActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for NEEDS_REVISION status");
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });

  if (!activity) {
    throw new Error("Activity not found");
  }

  if (activity.status !== "PENDING") {
    throw new Error(`Cannot request changes from status: ${activity.status}`);
  }

  await prisma.$transaction([
    // Update activity status
    prisma.activity.update({
      where: { id: activityId },
      data: {
        status: "NEEDS_REVISION",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "ACTIVITY",
        entityId: activityId,
        action: "NEEDS_REVISION",
        message,
        reviewedByUserId,
      },
    }),
  ]);
}

/**
 * Reject an Activity
 * Changes status from PENDING to REJECTED
 * Message is required
 */
export async function rejectActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for REJECTED status");
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });

  if (!activity) {
    throw new Error("Activity not found");
  }

  if (activity.status !== "PENDING") {
    throw new Error(`Cannot reject from status: ${activity.status}`);
  }

  await prisma.$transaction([
    // Update activity status
    prisma.activity.update({
      where: { id: activityId },
      data: {
        status: "REJECTED",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "ACTIVITY",
        entityId: activityId,
        action: "REJECT",
        message,
        reviewedByUserId,
      },
    }),
  ]);
}
