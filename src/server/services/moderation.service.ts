/* eslint-disable @typescript-eslint/no-explicit-any */
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
 * Sends notification to owner.
 */
export async function approvePlace(
  placeId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot approve from status: ${place.status}`);

  await prisma.$transaction([
    prisma.place.update({ where: { id: placeId }, data: { status: "PUBLISHED" } }),
    prisma.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "APPROVE", message: message || "Approved", reviewedByUserId },
    }),
  ]);

  const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
  await assignSlugOnPublish(placeId);
  const { ensurePublishedPlaceHasSlug } = await import("@/lib/slug/publishSlugGuards");
  await ensurePublishedPlaceHasSlug(placeId);

  // Notify creator (outside transaction, non-blocking)
  const { notifyPlaceApproved } = await import("./notification.service");
  notifyPlaceApproved(placeId, place.title, place.createdByUserId).catch((e) =>
    console.error("[moderation] notifyPlaceApproved failed:", e),
  );
}

export async function needsRevisionPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot request changes from status: ${place.status}`);

  await prisma.$transaction([
    prisma.place.update({ where: { id: placeId }, data: { status: "NEEDS_REVISION" } }),
    prisma.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "NEEDS_REVISION", message, reviewedByUserId },
    }),
  ]);

  const { notifyPlaceNeedsChanges } = await import("./notification.service");
  notifyPlaceNeedsChanges(placeId, place.title, place.createdByUserId, message).catch((e) =>
    console.error("[moderation] notifyPlaceNeedsChanges failed:", e),
  );
}

export async function rejectPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot reject from status: ${place.status}`);

  await prisma.$transaction([
    prisma.place.update({ where: { id: placeId }, data: { status: "REJECTED" } }),
    prisma.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "REJECT", message, reviewedByUserId },
    }),
  ]);

  const { notifyPlaceRejected } = await import("./notification.service");
  notifyPlaceRejected(placeId, place.title, place.createdByUserId, message).catch((e) =>
    console.error("[moderation] notifyPlaceRejected failed:", e),
  );
}

/**
 * Submit a Place for initial moderation
 * Changes status from DRAFT, NEEDS_REVISION, or REJECTED to PENDING
 * 
 * Note: For post-publication edits, use PlaceRevision flow instead
 */
export async function submitPlace(
  placeId: string,
  _actingUserId: string
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, createdByUserId: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  // Access control is enforced by API routes (owner or admin/moderator).

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
 * Publish a Place from draft/revision/rejected without moderation queue (admin flow).
 */
export async function publishPlaceFromDraft(
  placeId: string,
  publishedByUserId: string,
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, createdByUserId: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (
    place.status !== "DRAFT" &&
    place.status !== "NEEDS_REVISION" &&
    place.status !== "REJECTED"
  ) {
    throw new Error(`Cannot publish from status: ${place.status}`);
  }

  await prisma.$transaction([
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "PUBLISHED",
      },
    }),
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "APPROVE",
        message: "Опубликовано администратором",
        reviewedByUserId: publishedByUserId,
      },
    }),
  ]);

  const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
  await assignSlugOnPublish(placeId);
  const { ensurePublishedPlaceHasSlug } = await import("@/lib/slug/publishSlugGuards");
  await ensurePublishedPlaceHasSlug(placeId);
}

export async function approveActivity(
  activityId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, ownerUserId: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot approve from status: ${activity.status}`);
  }

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { status: "PUBLISHED" } }),
    prisma.moderationLog.create({
      data: { entityType: "ACTIVITY", entityId: activityId, action: "APPROVE", message: message || "Approved", reviewedByUserId },
    }),
  ]);

  const { ensurePublishedActivityHasSlug } = await import("@/lib/slug/publishSlugGuards");
  await ensurePublishedActivityHasSlug(activityId);

  const { notifyActivityApproved } = await import("./notification.service");
  notifyActivityApproved(activityId, activity.title, activity.ownerUserId).catch((e) =>
    console.error("[moderation] notifyActivityApproved failed:", e),
  );
}

export async function needsRevisionActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, ownerUserId: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot request changes from status: ${activity.status}`);
  }

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { status: "NEEDS_REVISION" } }),
    prisma.moderationLog.create({
      data: { entityType: "ACTIVITY", entityId: activityId, action: "NEEDS_REVISION", message, reviewedByUserId },
    }),
  ]);

  const { notifyActivityNeedsChanges } = await import("./notification.service");
  notifyActivityNeedsChanges(activityId, activity.title, activity.ownerUserId, message).catch((e) =>
    console.error("[moderation] notifyActivityNeedsChanges failed:", e),
  );
}

export async function rejectActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, ownerUserId: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot reject from status: ${activity.status}`);
  }

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { status: "REJECTED" } }),
    prisma.moderationLog.create({
      data: { entityType: "ACTIVITY", entityId: activityId, action: "REJECT", message, reviewedByUserId },
    }),
  ]);

  const { notifyActivityRejected } = await import("./notification.service");
  notifyActivityRejected(activityId, activity.title, activity.ownerUserId, message).catch((e) =>
    console.error("[moderation] notifyActivityRejected failed:", e),
  );
}

// ── OFFER ─────────────────────────────────────────────────────────────────────

/**
 * Approve an Offer. Resolves owner via place relation.
 */
export async function approveOffer(
  offerId: string,
  reviewedByUserId: string,
): Promise<void> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, place: { select: { ownerUserId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot approve from status: ${offer.status}`);

  await prisma.offer.update({
    where: { id: offerId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  const { ensurePublishedOfferHasSlug } = await import("@/lib/slug/publishSlugGuards");
  await ensurePublishedOfferHasSlug(offerId);

  const { notifyOfferApproved } = await import("./notification.service");
  notifyOfferApproved(offerId, offer.title, offer.place.ownerUserId).catch((e) =>
    console.error("[moderation] notifyOfferApproved failed:", e),
  );
}

export async function needsRevisionOffer(
  offerId: string,
  reviewedByUserId: string,
  message: string,
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, place: { select: { ownerUserId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot request changes from status: ${offer.status}`);

  await prisma.offer.update({
    where: { id: offerId },
    data: { status: "DRAFT" }, // Offer has no NEEDS_REVISION status — revert to DRAFT
  });

  const { notifyOfferNeedsChanges } = await import("./notification.service");
  notifyOfferNeedsChanges(offerId, offer.title, offer.place.ownerUserId, message).catch((e) =>
    console.error("[moderation] notifyOfferNeedsChanges failed:", e),
  );
}

export async function rejectOffer(
  offerId: string,
  reviewedByUserId: string,
  message: string,
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, place: { select: { ownerUserId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot reject from status: ${offer.status}`);

  await prisma.offer.update({
    where: { id: offerId },
    data: { status: "REJECTED", rejectionReason: message },
  });

  const { notifyOfferRejected } = await import("./notification.service");
  notifyOfferRejected(offerId, offer.title, offer.place.ownerUserId, message).catch((e) =>
    console.error("[moderation] notifyOfferRejected failed:", e),
  );
}
