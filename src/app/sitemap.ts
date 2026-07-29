import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import { getBaseUrl, buildCityPublicPath } from "@/lib/routing/cityPaths";
import {
  getPublicPublishedPlaceWhere,
  getPublicPublishedOfferWhere,
  getPublicActivityDetailWhere,
} from "@/server/public/publicContentVisibility";
import { ActivityType } from "@prisma/client";
import { resolvePlaceCanonicalUrl } from "@/lib/seo/resolvePlaceCanonicalUrl";
import { resolveOfferCanonicalUrl } from "@/lib/seo/resolveOfferCanonicalUrl";
import { resolveRouteCanonicalUrl } from "@/lib/seo/resolveRouteCanonicalUrl";
import { resolveArticleCanonicalUrl } from "@/lib/seo/resolveArticleCanonicalUrl";
import { resolveEventCanonicalUrl } from "@/lib/seo/resolveEventCanonicalUrl";
import { resolveCanonicalCitySlugForEvent } from "@/lib/business/eventPublicLink";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isGlobalNoindexEnabled()) {
    return [];
  }

  const baseUrl = getBaseUrl("BY");
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true, isLegacyNonCity: false },
      select: { slug: true, updatedAt: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    // Fetch active discovery tags once (reuse for all cities)
    const tags = await prisma.discoveryTag.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const city of cities) {
      // City hub and events pages
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "hub" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "daily",
        priority: 0.9,
      });
      entries.push({
        url: `${baseUrl}${buildCityPublicPath({ citySlug: city.slug, type: "events" })}`,
        lastModified: city.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });

      // Discovery tag pages per city
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
      where: getPublicPublishedPlaceWhere(),
      select: { id: true, slug: true, seoCanonicalUrl: true, updatedAt: true },
    });
    for (const place of places) {
      entries.push({
        url: resolvePlaceCanonicalUrl({
          seoCanonicalUrl: place.seoCanonicalUrl,
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
      where: getPublicPublishedOfferWhere(),
      select: {
        id: true,
        slug: true,
        kind: true,
        campProgramType: true,
        seoCanonicalUrl: true,
        updatedAt: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    for (const offer of offers) {
      const citySlug = offer.place?.city?.slug || "minsk";
      entries.push({
        url: resolveOfferCanonicalUrl({
          seoCanonicalUrl: offer.seoCanonicalUrl,
          offer: { kind: offer.kind, campProgramType: offer.campProgramType, slug: offer.slug },
          citySlug,
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
      where: { status: "PUBLISHED", visibility: "PUBLIC" },
      select: { id: true, slug: true, seoCanonicalUrl: true, updatedAt: true },
    });
    for (const route of routes) {
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
      where: { status: "PUBLISHED", noindex: false },
      select: {
        id: true,
        slug: true,
        seoCanonicalUrl: true,
        geoScope: true,
        updatedAt: true,
        city: { select: { slug: true } },
      },
    });
    for (const article of articles) {
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
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, slug: true } })
        : [];
    const citySlugById = new Map(cityRows.map((row) => [row.id, row.slug]));

    for (const event of events) {
      const citySlug = resolveCanonicalCitySlugForEvent({
        activityCitySlug: event.cityId ? citySlugById.get(event.cityId) ?? null : null,
        placeCitySlug: event.place?.city?.slug ?? null,
        venueCitySlug: event.venue?.cityId ? citySlugById.get(event.venue.cityId) ?? null : null,
      });
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
