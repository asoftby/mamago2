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
 * Request changes for a Place
 * Changes status from PENDING to NEEDS_CHANGES
 * Message is required
 */
export async function needsChangesPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for NEEDS_CHANGES status");
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
        status: "NEEDS_CHANGES",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "NEEDS_CHANGES",
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
 * Submit a Place for moderation
 * Changes status from DRAFT or NEEDS_CHANGES to PENDING
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
    place.status !== "NEEDS_CHANGES" &&
    place.status !== "REJECTED"
  ) {
    throw new Error(`Cannot submit from status: ${place.status}`);
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "PENDING",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "SUBMIT",
        message: "Submitted for moderation",
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
 * Changes status from PENDING to NEEDS_CHANGES
 * Message is required
 */
export async function needsChangesActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required for NEEDS_CHANGES status");
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
        status: "NEEDS_CHANGES",
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "ACTIVITY",
        entityId: activityId,
        action: "NEEDS_CHANGES",
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
