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

  if (usage) {
    const entityData = await fetchEntityData(usage.entityType, usage.entityId);
    return {
      entityType: usage.entityType,
      entityTitle: entityData.title,
      field: usage.field,
      placeAddress: entityData.placeAddress,
    };
  }

  // Article cover / SEO image may reference media without a MediaUsage row
  const articleCover = await prisma.article.findFirst({
    where: { coverImageId: mediaId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });
  if (articleCover) {
    return {
      entityType: "ARTICLE",
      entityTitle: articleCover.title,
      field: "coverImageId",
      placeAddress: undefined,
    };
  }

  const articleSeo = await prisma.article.findFirst({
    where: { seoImageId: mediaId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });
  if (articleSeo) {
    return {
      entityType: "ARTICLE",
      entityTitle: articleSeo.title,
      field: "seoImageId",
      placeAddress: undefined,
    };
  }

  return null;
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
        const event = await prisma.activity.findUnique({
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
        const route = await prisma.activity.findUnique({
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
        return { title: article?.title ?? null };
      }

      case "USER": {
        const user = await prisma.user.findUnique({
          where: { id: entityId },
          select: { email: true },
        });
        return { title: user?.email || null };
      }

      default:
        return { title: null };
    }
  } catch (error) {
    console.error(`Failed to fetch entity data for ${entityType}:${entityId}`, error);
    return { title: null };
  }
}
