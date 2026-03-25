/**
 * Media Usage Service
 * 
 * Tracks where media assets are used across the platform.
 * Provides usage mapping and orphan detection.
 */

import { prisma } from "@/lib/prisma";
import { MediaEntityType } from "@prisma/client";

export interface CreateMediaUsageInput {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  field: string;
}

/**
 * Register media usage
 */
export async function registerMediaUsage(input: CreateMediaUsageInput) {
  // Check if usage already exists
  const existing = await prisma.mediaUsage.findFirst({
    where: {
      mediaId: input.mediaId,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.mediaUsage.create({
    data: input,
  });
}

/**
 * Remove media usage
 */
export async function removeMediaUsage(
  mediaId: string,
  entityType: MediaEntityType,
  entityId: string,
  field: string
) {
  return prisma.mediaUsage.deleteMany({
    where: {
      mediaId,
      entityType,
      entityId,
      field,
    },
  });
}

/**
 * Get all usages for a media asset
 */
export async function getMediaUsages(mediaId: string) {
  return prisma.mediaUsage.findMany({
    where: { mediaId },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get usages with entity details
 */
export async function getMediaUsagesWithDetails(mediaId: string) {
  const usages = await prisma.mediaUsage.findMany({
    where: { mediaId },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Enrich with entity names
  const enriched = await Promise.all(
    usages.map(async (usage) => {
      let entityName = null;
      let entityUrl = null;

      try {
        switch (usage.entityType) {
          case "PLACE":
            const place = await prisma.place.findUnique({
              where: { id: usage.entityId },
              select: { title: true },
            });
            entityName = place?.title || null;
            entityUrl = `/editor/place/${usage.entityId}/edit`;
            break;

          case "EVENT":
            const event = await prisma.activity.findUnique({
              where: { id: usage.entityId },
              select: { title: true },
            });
            entityName = event?.title || null;
            entityUrl = `/admin/events/${usage.entityId}`;
            break;

          case "OFFER":
            const offer = await prisma.offer.findUnique({
              where: { id: usage.entityId },
              select: { title: true },
            });
            entityName = offer?.title || null;
            entityUrl = `/admin/offers/${usage.entityId}`;
            break;

          case "USER":
            const user = await prisma.user.findUnique({
              where: { id: usage.entityId },
              select: { email: true },
            });
            entityName = user?.email || null;
            entityUrl = `/admin/users/${usage.entityId}`;
            break;

          case "BUSINESS":
            const business = await prisma.business.findUnique({
              where: { id: usage.entityId },
              select: { name: true },
            });
            entityName = business?.name || null;
            entityUrl = `/admin/businesses/${usage.entityId}`;
            break;
        }
      } catch (error) {
        console.error(`Error fetching entity details for ${usage.entityType}:${usage.entityId}`, error);
      }

      return {
        ...usage,
        entityName,
        entityUrl,
      };
    })
  );

  return enriched;
}

/**
 * Get usages for an entity
 */
export async function getEntityMediaUsages(
  entityType: MediaEntityType,
  entityId: string
) {
  return prisma.mediaUsage.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      media: true,
    },
  });
}

/**
 * Replace media usage (swap one media for another)
 */
export async function replaceMediaUsage(
  oldMediaId: string,
  newMediaId: string,
  entityType: MediaEntityType,
  entityId: string,
  field: string
) {
  await prisma.$transaction(async (tx) => {
    // Remove old usage
    await tx.mediaUsage.deleteMany({
      where: {
        mediaId: oldMediaId,
        entityType,
        entityId,
        field,
      },
    });

    // Add new usage
    await tx.mediaUsage.create({
      data: {
        mediaId: newMediaId,
        entityType,
        entityId,
        field,
      },
    });
  });
}

/**
 * Count usages for media
 */
export async function countMediaUsages(mediaId: string) {
  return prisma.mediaUsage.count({
    where: { mediaId },
  });
}
