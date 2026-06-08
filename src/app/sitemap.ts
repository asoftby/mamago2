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
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    for (const city of cities) {
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
    }
  } catch (error) {
    console.warn("[sitemap] city query failed, returning base URL only:", error);
  }

  // TODO: add published places, offers, routes, articles when sitemap indexing expands.

  return entries;
}
