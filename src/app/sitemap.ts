import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { isGlobalNoindexEnabled } from "@/lib/seo/globalNoindex";
import { getBaseUrl, buildCityPublicPath } from "@/lib/routing/cityPaths";

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

  // TODO: add published places, offers, routes, articles when sitemap indexing expands.

  return entries;
}
