/**
 * Get Media Usage Context
 * 
 * Fetches entity information to build metadata context.
 */

import { prisma } from "@/lib/prisma";
import { MediaEntityType } from "@prisma/client";
import { MediaMetadataContext } from "./generateMediaMetadata";
import { PlaceAddressData } from "./formatShortAddress";

interface EntityData {
  title: string | null;
  placeAddress?: PlaceAddressData | null;
}

/**
 * Get primary usage context for a media asset
 * Returns the first usage with entity title
 */
export async function getMediaUsageContext(
  mediaId: string
): Promise<MediaMetadataContext | null> {
  // Get first usage
  const usage = await prisma.mediaUsage.findFirst({
    where: { mediaId },
    orderBy: { createdAt: "asc" },
  });

  if (!usage) {
    return null;
  }

  // Fetch entity title based on type
  const entityData = await fetchEntityData(usage.entityType, usage.entityId);

  return {
    entityType: usage.entityType,
    entityTitle: entityData.title,
    field: usage.field,
    placeAddress: entityData.placeAddress,
  };
}

/**
 * Fetch entity data by type and ID
 */
async function fetchEntityData(
  entityType: MediaEntityType,
  entityId: string
): Promise<EntityData> {
  try {
    switch (entityType) {
      case "PLACE": {
        const place = await prisma.place.findUnique({
          where: { id: entityId },
          select: { 
            title: true,
            shortAddress: true,
            city: {
              select: { name: true }
            }
          },
        });
        
        if (!place) {
          return { title: null };
        }

        return {
          title: place.title,
          placeAddress: {
            cityName: place.city?.name || null,
            shortAddress: place.shortAddress || null,
          },
        };
      }

      case "EVENT": {
        const event = await prisma.event.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return { title: event?.title || null };
      }

      case "OFFER": {
        const offer = await prisma.offer.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return { title: offer?.title || null };
      }

      case "ROUTE": {
        const route = await prisma.route.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return { title: route?.title || null };
      }

      case "ARTICLE": {
        const article = await prisma.article.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return { title: article?.title || null };
      }

      case "USER": {
        const user = await prisma.user.findUnique({
          where: { id: entityId },
          select: { email: true, name: true },
        });
        return { title: user?.name || user?.email || null };
      }

      default:
        return { title: null };
    }
  } catch (error) {
    console.error(`Failed to fetch entity data for ${entityType}:${entityId}`, error);
    return { title: null };
  }
}
