import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import { getBaseUrl, buildCityPublicPath } from "@/lib/routing/cityPaths";
import {
  getPublicPublishedPlaceWhere,
  getPublicPublishedOfferWhere,
  getPublicActivityDetailWhere,
  getPublicPublishedArticleWhere,
  getPublicRouteIndexWhere,
} from "@/server/public/publicContentVisibility";
import { ActivityType } from "@prisma/client";
import { resolvePlaceCanonicalUrl } from "@/lib/seo/resolvePlaceCanonicalUrl";
import { resolveOfferCanonicalUrl } from "@/lib/seo/resolveOfferCanonicalUrl";
import { resolveRouteCanonicalUrl } from "@/lib/seo/resolveRouteCanonicalUrl";
import { resolveArticleCanonicalUrl } from "@/lib/seo/resolveArticleCanonicalUrl";
import { resolveEventCanonicalUrl } from "@/lib/seo/resolveEventCanonicalUrl";
import { resolveCanonicalCitySlugForEvent } from "@/lib/business/eventPublicLink";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { eventCategoryHubPath } from "@/lib/seo/eventCategoryHub";
import { getAvailableEventTaxonomy } from "@/server/discovery/eventTaxonomyAvailability";

export const dynamic = "force-dynamic";

/**
 * Matches the `parts.includes("noindex")` semantics already used by the
 * per-entity `parseRobots()` helpers in the Event/Offer detail pages'
 * `generateMetadata()` — an entity explicitly marked noindex via its
 * `seoRobots` field must never get a sitemap entry, even though its own
 * detail page correctly renders `robots: noindex` regardless of sitemap
 * presence.
 */
export function hasNoindexRobots(seoRobots: string | null | undefined): boolean {
  if (!seoRobots) return false;
  return seoRobots
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .includes("noindex");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isGlobalNoindexEnabled()) {
    return [];
  }

  const baseUrl = getBaseUrl("BY");
  const entries: MetadataRoute.Sitemap = [];

  entries.push({
    url: `${baseUrl}/routes`,
    changeFrequency: "weekly",
    priority: 0.5,
  });
  entries.push({
    url: `${baseUrl}/blog`,
    changeFrequency: "daily",
    priority: 0.6,
  });

  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true, isLegacyNonCity: false },
      select: { id: true, slug: true, updatedAt: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    const tags = await prisma.discoveryTag.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });

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

      // Only category hubs backed by currently discoverable events are emitted.
      // This avoids manufacturing empty city × category URLs while giving clean
      // category landings a direct sitemap discovery path.
      const eventCategories = await getAvailableEventTaxonomy(city.id, city.slug).catch((error) => {
        console.warn(`[sitemap] event category query failed for ${city.slug}, skipping hubs:`, error);
        return [];
      });
      for (const category of eventCategories) {
        entries.push({
          url: `${baseUrl}${eventCategoryHubPath(city.slug, category.slug)}`,
          lastModified: city.updatedAt,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }

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

      for (const tag of tags) {
        entries.push({
          url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "tag", slug: tag.slug })}`,
          lastModified: tag.updatedAt,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch (error) {
    console.warn("[sitemap] city/tag query failed, returning base URL only:", error);
  }

  try {
    const places = await prisma.place.findMany({
      where: {
        AND: [getPublicPublishedPlaceWhere(), { OR: [{ cityId: null }, { city: { isActive: true } }] }],
      },
      select: { id: true, slug: true, seoCanonicalUrl: true, updatedAt: true, seoRobots: true, city: { select: { slug: true } } },
    });
    for (const place of places) {
      if (hasNoindexRobots(place.seoRobots)) continue;
      if (!place.city?.slug) continue;
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
      if (hasNoindexRobots(offer.seoRobots)) continue;
      if (!offer.place?.city?.slug) continue;
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
          .flatMap((e) => [e.cityId, e.venue?.cityId])
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    const cityRows =
      cityIds.length > 0
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, slug: true, isActive: true } })
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
