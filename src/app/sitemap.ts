import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import { getBaseUrl, buildCityPublicPath } from "@/lib/routing/cityPaths";
import {
  getPublicPublishedPlaceWhere,
  getPublicPublishedOfferWhere,
  getPublicActivityDetailWhere,
  getPublicListingActivityWhere,
  getPublicPublishedArticleWhere,
  getPublicRouteIndexWhere,
} from "@/server/public/publicContentVisibility";
import { ActivityType, EventCategoryPublicationType } from "@prisma/client";
import { resolvePlaceCanonicalUrl } from "@/lib/seo/resolvePlaceCanonicalUrl";
import { resolveOfferCanonicalUrl } from "@/lib/seo/resolveOfferCanonicalUrl";
import { resolveRouteCanonicalUrl } from "@/lib/seo/resolveRouteCanonicalUrl";
import { resolveArticleCanonicalUrl } from "@/lib/seo/resolveArticleCanonicalUrl";
import { resolveEventCanonicalUrl } from "@/lib/seo/resolveEventCanonicalUrl";
import { resolveCanonicalCitySlugForEvent } from "@/lib/business/eventPublicLink";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { eventCategoryHubPath } from "@/lib/seo/eventCategoryHub";

export const dynamic = "force-dynamic";

export function hasNoindexRobots(seoRobots: string | null | undefined): boolean {
  if (!seoRobots) return false;
  return seoRobots
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .includes("noindex");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isGlobalNoindexEnabled()) return [];

  const baseUrl = getBaseUrl("BY");
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/routes`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/blog`, changeFrequency: "daily", priority: 0.6 },
  ];

  try {
    const [cities, tags, categories, articlesForHubs, categoryEvents] = await Promise.all([
      prisma.city.findMany({
        where: { isActive: true, isLegacyNonCity: false },
        select: { id: true, slug: true, regionId: true, updatedAt: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      prisma.discoveryTag.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.eventCategory.findMany({
        where: { isActive: true, archivedAt: null },
        select: { id: true, slug: true, updatedAt: true, publicationType: true },
        orderBy: { nameRu: "asc" },
      }),
      prisma.article.findMany({
        where: {
          ...getPublicPublishedArticleWhere(),
          noindex: false,
        },
        select: {
          geoScope: true,
          cityId: true,
          regionId: true,
          categoryId: true,
          seoRobots: true,
          tags: {
            where: { isActive: true },
            select: { id: true },
          },
          additionalGeographyTargets: {
            select: { type: true, cityId: true, regionId: true },
          },
        },
      }),
      prisma.activity.findMany({
        where: {
          type: ActivityType.EVENT,
          eventCategoryId: { not: null },
          ...getPublicListingActivityWhere(),
        },
        select: {
          eventCategoryId: true,
          cityId: true,
          place: { select: { cityId: true } },
          venue: { select: { cityId: true } },
        },
      }),
    ]);

    const populatedTagHubs = new Set<string>();
    const populatedArticleCategoryHubs = new Set<string>();
    for (const article of articlesForHubs) {
      if (hasNoindexRobots(article.seoRobots)) continue;
      for (const city of cities) {
        const matchesCity =
          article.geoScope === "COUNTRY" ||
          (article.geoScope === "CITY" && article.cityId === city.id) ||
          (article.geoScope === "REGION" && Boolean(city.regionId) && article.regionId === city.regionId) ||
          article.additionalGeographyTargets.some(
            (target) =>
              (target.type === "CITY" && target.cityId === city.id) ||
              (target.type === "REGION" && Boolean(city.regionId) && target.regionId === city.regionId),
          );
        if (!matchesCity) continue;
        for (const tag of article.tags) populatedTagHubs.add(`${city.id}:${tag.id}`);
        if (article.categoryId) populatedArticleCategoryHubs.add(`${city.id}:${article.categoryId}`);
      }
    }

    const populatedEventCategoryHubs = new Set<string>();
    for (const event of categoryEvents) {
      if (!event.eventCategoryId) continue;
      const eventCityIds = new Set(
        [event.cityId, event.place?.cityId, event.venue?.cityId].filter(
          (value): value is string => Boolean(value),
        ),
      );
      for (const cityId of eventCityIds) {
        populatedEventCategoryHubs.add(`${cityId}:${event.eventCategoryId}`);
      }
    }

    for (const city of cities) {
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "hub" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "daily",
        priority: city.slug === DEFAULT_CITY_SLUG ? 1 : 0.9,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "events" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "programs" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "classes" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "routes" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "journal" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "daily",
        priority: 0.6,
      });

      for (const category of categories) {
        if (
          category.publicationType === EventCategoryPublicationType.EVENT &&
          populatedEventCategoryHubs.has(`${city.id}:${category.id}`)
        ) {
          entries.push({
            url: `${baseUrl}${eventCategoryHubPath(city.slug, category.slug)}`,
            lastModified: category.updatedAt,
            changeFrequency: "daily",
            priority: 0.75,
          });
        }
        if (
          category.publicationType === EventCategoryPublicationType.ARTICLE &&
          populatedArticleCategoryHubs.has(`${city.id}:${category.id}`)
        ) {
          entries.push({
            url: `${baseUrl}/${city.slug}/blog/category/${category.slug}`,
            lastModified: category.updatedAt,
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      }

      for (const tag of tags) {
        if (!populatedTagHubs.has(`${city.id}:${tag.id}`)) continue;
        entries.push({
          url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "tag", slug: tag.slug })}`,
          lastModified: tag.updatedAt,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch (error) {
    console.warn("[sitemap] city/tag/category query failed, skipping city discovery hubs:", error);
  }

  try {
    const places = await prisma.place.findMany({
      where: {
        AND: [getPublicPublishedPlaceWhere(), { OR: [{ cityId: null }, { city: { isActive: true } }] }],
      },
      select: { id: true, slug: true, seoCanonicalUrl: true, updatedAt: true, seoRobots: true, city: { select: { slug: true } } },
    });
    for (const place of places) {
      if (hasNoindexRobots(place.seoRobots) || !place.city?.slug) continue;
      entries.push({
        url: resolvePlaceCanonicalUrl({
          seoCanonicalUrl: place.seoCanonicalUrl,
          citySlug: place.city.slug,
          slug: place.slug,
          id: place.id,
          publicBase: baseUrl,
        }),
        lastModified: place.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.warn("[sitemap] places query failed, skipping:", error);
  }

  try {
    const offers = await prisma.offer.findMany({
      where: {
        AND: [
          getPublicPublishedOfferWhere(),
          { place: { OR: [{ cityId: null }, { city: { isActive: true } }] } },
        ],
      },
      select: {
        id: true,
        slug: true,
        seoCanonicalUrl: true,
        updatedAt: true,
        seoRobots: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    for (const offer of offers) {
      if (hasNoindexRobots(offer.seoRobots) || !offer.place?.city?.slug) continue;
      entries.push({
        url: resolveOfferCanonicalUrl({
          seoCanonicalUrl: offer.seoCanonicalUrl,
          slug: offer.slug,
          citySlug: offer.place.city.slug,
          publicBase: baseUrl,
        }),
        lastModified: offer.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.warn("[sitemap] offers query failed, skipping:", error);
  }

  try {
    const routes = await prisma.route.findMany({
      where: getPublicRouteIndexWhere(),
      select: { id: true, slug: true, seoCanonicalUrl: true, updatedAt: true, seoRobots: true },
    });
    for (const route of routes) {
      if (hasNoindexRobots(route.seoRobots)) continue;
      entries.push({
        url: resolveRouteCanonicalUrl({
          seoCanonicalUrl: route.seoCanonicalUrl,
          slug: route.slug,
          id: route.id,
          publicBase: baseUrl,
        }),
        lastModified: route.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (error) {
    console.warn("[sitemap] routes query failed, skipping:", error);
  }

  try {
    const articles = await prisma.article.findMany({
      where: {
        ...getPublicPublishedArticleWhere(),
        noindex: false,
        OR: [{ cityId: null }, { city: { isActive: true } }],
      },
      select: {
        id: true,
        slug: true,
        seoCanonicalUrl: true,
        seoRobots: true,
        geoScope: true,
        updatedAt: true,
        city: { select: { slug: true } },
      },
    });
    for (const article of articles) {
      if (hasNoindexRobots(article.seoRobots)) continue;
      const seg = article.slug?.trim() || article.id;
      entries.push({
        url: resolveArticleCanonicalUrl({
          seoCanonicalUrl: article.seoCanonicalUrl,
          slug: seg,
          geoScope: article.geoScope,
          citySlug: article.city?.slug ?? null,
          publicBase: baseUrl,
        }),
        lastModified: article.updatedAt,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.warn("[sitemap] articles query failed, skipping:", error);
  }

  try {
    const events = await prisma.activity.findMany({
      where: { type: ActivityType.EVENT, ...getPublicActivityDetailWhere() },
      select: {
        id: true,
        slug: true,
        seoCanonicalUrl: true,
        cityId: true,
        updatedAt: true,
        seoRobots: true,
        place: { select: { city: { select: { slug: true } } } },
        venue: { select: { cityId: true } },
      },
    });
    const cityIds = Array.from(
      new Set(
        events
          .flatMap((event) => [event.cityId, event.venue?.cityId])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const cityRows = cityIds.length > 0
      ? await prisma.city.findMany({
          where: { id: { in: cityIds } },
          select: { id: true, slug: true, isActive: true },
        })
      : [];
    const citySlugById = new Map(cityRows.map((row) => [row.id, row.slug]));
    const inactiveCitySlugs = new Set(cityRows.filter((row) => !row.isActive).map((row) => row.slug));

    for (const event of events) {
      if (hasNoindexRobots(event.seoRobots)) continue;
      const citySlug = resolveCanonicalCitySlugForEvent({
        activityCitySlug: event.cityId ? citySlugById.get(event.cityId) ?? null : null,
        placeCitySlug: event.place?.city?.slug ?? null,
        venueCitySlug: event.venue?.cityId ? citySlugById.get(event.venue.cityId) ?? null : null,
      });
      if (inactiveCitySlugs.has(citySlug)) continue;
      entries.push({
        url: resolveEventCanonicalUrl({
          seoCanonicalUrl: event.seoCanonicalUrl,
          citySlug,
          slug: event.slug,
          id: event.id,
          publicBase: baseUrl,
        }),
        lastModified: event.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.warn("[sitemap] events query failed, skipping:", error);
  }

  return entries;
}
