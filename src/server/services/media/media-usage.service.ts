/**
 * Media Usage Service
 * 
 * Tracks where media assets are used across the platform.
 * Provides usage mapping and orphan detection.
 */

import { prisma } from "@/lib/prisma";
import { MediaEntityType } from "@prisma/client";
import {
  findMediaAssetByReference,
  normalizeMediaDisplayUrl,
} from "@/lib/media/resolveMediaAssetReference";

function mediaUsageDedupKey(u: {
  entityType: MediaEntityType;
  entityId: string;
  field: string;
}) {
  return `${u.entityType}:${u.entityId}:${u.field}`;
}

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
  const [usages, articlesAsCover, articlesAsSeo] = await Promise.all([
    prisma.mediaUsage.findMany({
      where: { mediaId },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.article.findMany({
      where: { coverImageId: mediaId },
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: { seoImageId: mediaId },
      select: { id: true, title: true, updatedAt: true },
    }),
  ]);

  const seen = new Set(usages.map((u) => mediaUsageDedupKey(u)));
  const synthetic: Array<{
    id: string;
    mediaId: string;
    entityType: MediaEntityType;
    entityId: string;
    field: string;
    createdAt: Date;
  }> = [];

  for (const a of articlesAsCover) {
    const row = {
      entityType: MediaEntityType.ARTICLE,
      entityId: a.id,
      field: "coverImageId",
    };
    if (!seen.has(mediaUsageDedupKey(row))) {
      synthetic.push({
        id: `synthetic:article-cover:${a.id}`,
        mediaId,
        ...row,
        createdAt: a.updatedAt,
      });
      seen.add(mediaUsageDedupKey(row));
    }
  }

  for (const a of articlesAsSeo) {
    const row = {
      entityType: MediaEntityType.ARTICLE,
      entityId: a.id,
      field: "seoImageId",
    };
    if (!seen.has(mediaUsageDedupKey(row))) {
      synthetic.push({
        id: `synthetic:article-seo:${a.id}`,
        mediaId,
        ...row,
        createdAt: a.updatedAt,
      });
      seen.add(mediaUsageDedupKey(row));
    }
  }

  const combined = [...usages, ...synthetic].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const articleIdsForTitles = [
    ...new Set(
      combined
        .filter((u) => u.entityType === MediaEntityType.ARTICLE)
        .map((u) => u.entityId)
    ),
  ];
  const articlesForTitles =
    articleIdsForTitles.length > 0
      ? await prisma.article.findMany({
          where: { id: { in: articleIdsForTitles } },
          select: { id: true, title: true },
        })
      : [];
  const articleTitleById = new Map(
    articlesForTitles.map((a) => [a.id, a.title] as const)
  );

  // Enrich with entity names
  const enriched = await Promise.all(
    combined.map(async (usage) => {
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

          case "ARTICLE":
            entityName = articleTitleById.get(usage.entityId) ?? null;
            entityUrl = `/admin/content/articles/${usage.entityId}/edit`;
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

type ActivityUsageRecord = {
  mediaId: string;
  field: string;
};

export async function collectMediaUsagesForActivity(activityId: string): Promise<{
  mediaIds: string[];
  usageRecords: ActivityUsageRecord[];
}> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!activity) {
    throw new Error(`Activity ${activityId} not found`);
  }

  const mediaIds = new Set<string>();
  const usageRecords: ActivityUsageRecord[] = [];

  const coverAsset =
    (await findMediaAssetByReference(activity.coverImageId)) ??
    (await findMediaAssetByReference(activity.coverImageUrl));

  if (coverAsset) {
    mediaIds.add(coverAsset.id);
    usageRecords.push({
      mediaId: coverAsset.id,
      field: activity.coverImageId === coverAsset.id ? "coverImageId" : "coverImageUrl",
    });
  }

  for (const image of activity.images) {
    if (image.mediaAssetId) {
      mediaIds.add(image.mediaAssetId);
      usageRecords.push({
        mediaId: image.mediaAssetId,
        field: "galleryMediaAssetId",
      });
      continue;
    }

    const galleryAsset = await findMediaAssetByReference(image.url);
    if (galleryAsset) {
      mediaIds.add(galleryAsset.id);
      usageRecords.push({
        mediaId: galleryAsset.id,
        field: "galleryImageUrl",
      });
    }
  }

  return { mediaIds: Array.from(mediaIds), usageRecords };
}

/**
 * Sync media usage for an Activity (Event)
 * Collects all media references and updates MediaUsage records
 */
export async function syncActivityMediaUsage(activityId: string) {
  const { mediaIds, usageRecords } = await collectMediaUsagesForActivity(activityId);

  // Remove old usage records for this activity
  await prisma.mediaUsage.deleteMany({
    where: {
      entityType: MediaEntityType.EVENT,
      entityId: activityId,
    },
  });

  // Create new usage records (deduplicated by field)
  const seen = new Set<string>();
  for (const record of usageRecords) {
    const key = `${record.mediaId}:${record.field}`;
    if (!seen.has(key)) {
      await prisma.mediaUsage.create({
        data: {
          mediaId: record.mediaId,
          entityType: MediaEntityType.EVENT,
          entityId: activityId,
          field: record.field,
        },
      });
      seen.add(key);
    }
  }

  return { mediaIds, usageCount: usageRecords.length };
}

export async function backfillActivityMediaIdsFromUrls(options?: {
  activityIds?: string[];
  targetMediaId?: string;
}) {
  const startedAt = Date.now();
  const scannedWhere =
    options?.activityIds && options.activityIds.length > 0
      ? { id: { in: options.activityIds } }
      : undefined;

  const activities = await prisma.activity.findMany({
    where: scannedWhere,
    select: {
      id: true,
      coverImageId: true,
      coverImageUrl: true,
      images: {
        select: {
          id: true,
          url: true,
          mediaAssetId: true,
        },
      },
    },
  });

  const targetMedia =
    options?.targetMediaId
      ? await prisma.mediaAsset.findUnique({
          where: { id: options.targetMediaId },
          select: {
            id: true,
            publicUrl: true,
            filename: true,
            originalName: true,
          },
        })
      : null;

  const targetRefs = new Set(
    [
      targetMedia?.id,
      targetMedia?.publicUrl,
      targetMedia?.filename,
      targetMedia?.originalName,
    ].filter((value): value is string => Boolean(value)),
  );

  let linkedActivities = 0;
  let notFound = 0;
  const touchedActivityIds = new Set<string>();
  const updatedMediaAssets = new Set<string>();

  for (const activity of activities) {
    let touched = false;
    let missingForActivity = false;

    const resolvedCoverAsset =
      (await findMediaAssetByReference(activity.coverImageId)) ??
      (await findMediaAssetByReference(activity.coverImageUrl));

    const shouldTouchCover =
      !targetMedia ||
      (resolvedCoverAsset && resolvedCoverAsset.id === targetMedia.id) ||
      (activity.coverImageId && targetRefs.has(activity.coverImageId)) ||
      (activity.coverImageUrl && targetRefs.has(activity.coverImageUrl));

    if (shouldTouchCover) {
      if (resolvedCoverAsset) {
        const activityPatch: {
          coverImageId?: string | null;
          coverImageUrl?: string | null;
        } = {};

        if (activity.coverImageId !== resolvedCoverAsset.id) {
          activityPatch.coverImageId = resolvedCoverAsset.id;
        }
        if (resolvedCoverAsset.publicUrl && activity.coverImageUrl !== resolvedCoverAsset.publicUrl) {
          activityPatch.coverImageUrl = resolvedCoverAsset.publicUrl;
        }

        if (Object.keys(activityPatch).length > 0) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: activityPatch,
          });
          touched = true;
          updatedMediaAssets.add(resolvedCoverAsset.id);
        }
      } else if (activity.coverImageId || activity.coverImageUrl) {
        missingForActivity = true;
      }
    }

    for (const image of activity.images) {
      const shouldTouchImage =
        !targetMedia ||
        image.mediaAssetId === targetMedia.id ||
        targetRefs.has(image.url);
      if (!shouldTouchImage || image.mediaAssetId) continue;

      const resolvedImageAsset = await findMediaAssetByReference(image.url);
      if (!resolvedImageAsset) {
        if (image.url) missingForActivity = true;
        continue;
      }

      await prisma.activityImage.update({
        where: { id: image.id },
        data: {
          mediaAssetId: resolvedImageAsset.id,
          url: resolvedImageAsset.publicUrl ?? normalizeMediaDisplayUrl(image.url) ?? image.url,
        },
      });
      touched = true;
      updatedMediaAssets.add(resolvedImageAsset.id);
    }

    if (touched) {
      linkedActivities++;
      touchedActivityIds.add(activity.id);
    }
    if (missingForActivity) {
      notFound++;
    }
  }

  for (const activityId of touchedActivityIds) {
    await syncActivityMediaUsage(activityId);
  }

  return {
    scannedActivities: activities.length,
    linkedActivities,
    notFound,
    updatedMediaAssets: updatedMediaAssets.size,
    durationMs: Date.now() - startedAt,
    syncedActivities: touchedActivityIds.size,
  };
}

export async function recomputeMediaUsageForAsset(mediaId: string) {
  const backfill = await backfillActivityMediaIdsFromUrls({ targetMediaId: mediaId });

  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { publicUrl: true, filename: true, originalName: true },
  });

  const refs = [
    mediaId,
    media?.publicUrl ?? null,
    media?.filename ?? null,
    media?.originalName ?? null,
  ].filter((value): value is string => Boolean(value));

  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { coverImageId: { in: refs } },
        ...(media?.publicUrl ? [{ coverImageUrl: media.publicUrl }] : []),
        { images: { some: { mediaAssetId: mediaId } } },
        ...(media?.publicUrl ? [{ images: { some: { url: media.publicUrl } } }] : []),
      ],
    },
    select: { id: true },
  });

  const activityIds = [...new Set(activities.map((activity) => activity.id))];
  for (const activityId of activityIds) {
    await syncActivityMediaUsage(activityId);
  }

  return {
    mediaId,
    activityIds,
    backfill,
    usageCount: await prisma.mediaUsage.count({ where: { mediaId } }),
  };
}

/**
 * Sync media usage for a Place
 * Collects all media references and updates MediaUsage records
 */
export async function syncPlaceMediaUsage(placeId: string) {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: true,
    },
  });

  if (!place) {
    throw new Error(`Place ${placeId} not found`);
  }

  const mediaIds = new Set<string>();
  const usageRecords: Array<{ mediaId: string; field: string }> = [];

  // Logo image
  if (place.logoImageId) {
    mediaIds.add(place.logoImageId);
    usageRecords.push({ mediaId: place.logoImageId, field: "logoImageId" });
  }

  // Gallery images (PlaceImage table with URLs)
  // TODO: These are stored as URLs in separate table
  // For now, skip gallery images as they don't have mediaId relations

  // Remove old usage records for this place
  await prisma.mediaUsage.deleteMany({
    where: {
      entityType: MediaEntityType.PLACE,
      entityId: placeId,
    },
  });

  // Create new usage records (deduplicated by field)
  const seen = new Set<string>();
  for (const record of usageRecords) {
    const key = `${record.mediaId}:${record.field}`;
    if (!seen.has(key)) {
      await prisma.mediaUsage.create({
        data: {
          mediaId: record.mediaId,
          entityType: MediaEntityType.PLACE,
          entityId: placeId,
          field: record.field,
        },
      });
      seen.add(key);
    }
  }

  return { mediaIds: Array.from(mediaIds), usageCount: usageRecords.length };
}

/**
 * Sync media usage for an Offer
 * Collects all media references and updates MediaUsage records
 */
export async function syncOfferMediaUsage(offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error(`Offer ${offerId} not found`);
  }

  const mediaIds = new Set<string>();
  const usageRecords: Array<{ mediaId: string; field: string }> = [];

  // Cover image (stored as URL string)
  if (offer.coverImage) {
    const coverAsset = await findMediaAssetByReference(offer.coverImage);
    if (coverAsset) {
      mediaIds.add(coverAsset.id);
      usageRecords.push({ mediaId: coverAsset.id, field: "coverImage" });
    }
  }

  // Gallery images (stored as JSON array of URLs)
  if (offer.galleryImages) {
    try {
      const galleryUrls = Array.isArray(offer.galleryImages)
        ? offer.galleryImages
        : JSON.parse(offer.galleryImages as string);
      
      if (Array.isArray(galleryUrls)) {
        for (const url of galleryUrls) {
          if (typeof url === "string") {
            const galleryAsset = await findMediaAssetByReference(url);
            if (galleryAsset) {
              mediaIds.add(galleryAsset.id);
              usageRecords.push({ mediaId: galleryAsset.id, field: "galleryImages" });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing galleryImages for offer ${offerId}:`, error);
    }
  }

  // Remove old usage records for this offer
  await prisma.mediaUsage.deleteMany({
    where: {
      entityType: MediaEntityType.OFFER,
      entityId: offerId,
    },
  });

  // Create new usage records (deduplicated by field+mediaId)
  const seen = new Set<string>();
  for (const record of usageRecords) {
    const key = `${record.mediaId}:${record.field}`;
    if (!seen.has(key)) {
      await prisma.mediaUsage.create({
        data: {
          mediaId: record.mediaId,
          entityType: MediaEntityType.OFFER,
          entityId: offerId,
          field: record.field,
        },
      });
      seen.add(key);
    }
  }

  return { mediaIds: Array.from(mediaIds), usageCount: usageRecords.length };
}

/**
 * Sync media usage for an Article
 * Collects all media references and updates MediaUsage records
 */
export async function syncArticleMediaUsage(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  const mediaIds = new Set<string>();
  const usageRecords: Array<{ mediaId: string; field: string }> = [];

  // Cover image (proper relation)
  if (article.coverImageId) {
    mediaIds.add(article.coverImageId);
    usageRecords.push({ mediaId: article.coverImageId, field: "coverImageId" });
  }

  // SEO image (proper relation)
  if (article.seoImageId) {
    mediaIds.add(article.seoImageId);
    usageRecords.push({ mediaId: article.seoImageId, field: "seoImageId" });
  }

  // Remove old usage records for this article
  await prisma.mediaUsage.deleteMany({
    where: {
      entityType: MediaEntityType.ARTICLE,
      entityId: articleId,
    },
  });

  // Create new usage records (deduplicated by field)
  const seen = new Set<string>();
  for (const record of usageRecords) {
    const key = `${record.mediaId}:${record.field}`;
    if (!seen.has(key)) {
      await prisma.mediaUsage.create({
        data: {
          mediaId: record.mediaId,
          entityType: MediaEntityType.ARTICLE,
          entityId: articleId,
          field: record.field,
        },
      });
      seen.add(key);
    }
  }

  return { mediaIds: Array.from(mediaIds), usageCount: usageRecords.length };
}

/**
 * Sync media usage for a Route (Phase B — invariant).
 *
 * Routes must be a source in the usage projection, otherwise media referenced
 * only by routes counts as orphaned (usage 0) and the fail-closed cleanup gate
 * would treat UGC as deletable.
 *
 * Phase C — reference vs owned: we only traverse the route's OWN reference
 * columns (coverImageUrl, seoOgImage), its stops' own photos (photoUrl),
 * and RouteStopImage gallery rows. Place gallery images shown *inside* a
 * route stay attached to their Place (reference, not route-owned).
 */
export async function syncRouteMediaUsage(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: {
      coverImageUrl: true,
      seoOgImage: true,
      stops: { select: { photoUrl: true, images: { select: { url: true, mediaAssetId: true, sortOrder: true } } } },
    },
  });

  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }

  const mediaIds = new Set<string>();
  const usageRecords: Array<{ mediaId: string; field: string }> = [];

  const coverAsset = await findMediaAssetByReference(route.coverImageUrl);
  if (coverAsset) {
    mediaIds.add(coverAsset.id);
    usageRecords.push({ mediaId: coverAsset.id, field: "coverImageUrl" });
  }

  const ogAsset = await findMediaAssetByReference(route.seoOgImage);
  if (ogAsset) {
    mediaIds.add(ogAsset.id);
    usageRecords.push({ mediaId: ogAsset.id, field: "seoOgImage" });
  }

  for (const stop of route.stops) {
    const stopAsset = await findMediaAssetByReference(stop.photoUrl);
    if (stopAsset) {
      mediaIds.add(stopAsset.id);
      usageRecords.push({ mediaId: stopAsset.id, field: "stopPhotoUrl" });
    }
    for (const image of stop.images) {
      const galleryAsset =
        (image.mediaAssetId
          ? await findMediaAssetByReference(image.mediaAssetId)
          : null) ?? (await findMediaAssetByReference(image.url));
      if (galleryAsset) {
        mediaIds.add(galleryAsset.id);
        usageRecords.push({ mediaId: galleryAsset.id, field: "stopGalleryUrl" });
      }
    }
  }

  // Remove old usage records for this route
  await prisma.mediaUsage.deleteMany({
    where: {
      entityType: MediaEntityType.ROUTE,
      entityId: routeId,
    },
  });

  // Create new usage records (deduplicated by field+mediaId)
  const seen = new Set<string>();
  for (const record of usageRecords) {
    const key = `${record.mediaId}:${record.field}`;
    if (!seen.has(key)) {
      await prisma.mediaUsage.create({
        data: {
          mediaId: record.mediaId,
          entityType: MediaEntityType.ROUTE,
          entityId: routeId,
          field: record.field,
        },
      });
      seen.add(key);
    }
  }

  return { mediaIds: Array.from(mediaIds), usageCount: usageRecords.length };
}

/**
 * Recompute usage counts for specific media assets
 * Updates the denormalized usageCount cache
 */
export async function recomputeMediaUsageCounts(mediaIds: string[]) {
  const results = {
    total: mediaIds.length,
    updated: 0,
    errors: 0,
  };

  for (const mediaId of mediaIds) {
    try {
      await prisma.mediaUsage.count({
        where: { mediaId },
      });

      // Note: MediaAsset doesn't have usageCount field in schema
      // The count is computed from MediaUsage records
      // This function is kept for future use if usageCount field is added
      
      results.updated++;
    } catch (error) {
      console.error(`Error recomputing usage count for media ${mediaId}:`, error);
      results.errors++;
    }
  }

  return results;
}

/**
 * Recompute all media usage counts
 * Full recompute for all entities - admin only, safe operation
 */
export async function recomputeAllMediaUsageCounts() {
  const startTime = Date.now();

  const backfill = await backfillActivityMediaIdsFromUrls();
  
  // Clear all existing MediaUsage records
  await prisma.mediaUsage.deleteMany({});

  const stats = {
    activities: 0,
    places: 0,
    offers: 0,
    articles: 0,
    routes: 0,
    errors: 0,
  };

  // Sync all activities
  try {
    const activities = await prisma.activity.findMany({
      select: { id: true },
    });
    
    for (const activity of activities) {
      try {
        await syncActivityMediaUsage(activity.id);
        stats.activities++;
      } catch (error) {
        console.error(`Error syncing activity ${activity.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Error fetching activities:", error);
  }

  // Sync all places
  try {
    const places = await prisma.place.findMany({
      select: { id: true },
    });
    
    for (const place of places) {
      try {
        await syncPlaceMediaUsage(place.id);
        stats.places++;
      } catch (error) {
        console.error(`Error syncing place ${place.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Error fetching places:", error);
  }

  // Sync all offers
  try {
    const offers = await prisma.offer.findMany({
      select: { id: true },
    });
    
    for (const offer of offers) {
      try {
        await syncOfferMediaUsage(offer.id);
        stats.offers++;
      } catch (error) {
        console.error(`Error syncing offer ${offer.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Error fetching offers:", error);
  }

  // Sync all articles
  try {
    const articles = await prisma.article.findMany({
      select: { id: true },
    });
    
    for (const article of articles) {
      try {
        await syncArticleMediaUsage(article.id);
        stats.articles++;
      } catch (error) {
        console.error(`Error syncing article ${article.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Error fetching articles:", error);
  }

  // Sync all routes (Phase B — keep route-referenced media out of the orphan set)
  try {
    const routes = await prisma.route.findMany({
      select: { id: true },
    });

    for (const route of routes) {
      try {
        await syncRouteMediaUsage(route.id);
        stats.routes++;
      } catch (error) {
        console.error(`Error syncing route ${route.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error("Error fetching routes:", error);
  }

  const durationMs = Date.now() - startTime;

  // Get total media assets and zero usage count
  const totalMediaAssets = await prisma.mediaAsset.count();
  const mediaWithUsage = await prisma.mediaUsage.groupBy({
    by: ["mediaId"],
  });
  const zeroUsageCount = totalMediaAssets - mediaWithUsage.length;

  return {
    totalMediaAssets,
    zeroUsageCount,
    durationMs,
    stats,
    backfill,
  };
}
