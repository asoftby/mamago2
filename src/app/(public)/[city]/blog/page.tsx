import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "../../blog/BlogIndex";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { listCityHomeArticles } from "@/server/article/listCityHomeArticles";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ city: string }>;
}

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: cityParam } = await params;
  const city = await resolveCity(cityParam);

  if (!city) return {};

  const cityName = getCityDisplayName(city.slug);
  const canonicalPath = buildCityPublicPath({
    citySlug: city.slug,
    type: "journal",
  });

  return applyGlobalRobotsOverride({
    title: `Журнал для семей в ${cityName} — mamaGo`,
    description: `Идеи для прогулок, маршруты и советы для семей с детьми в ${cityName}`,
    alternates: {
      canonical: buildAbsoluteCanonicalUrl(canonicalPath),
    },
  });
}

export default async function CityBlogPage({ params }: PageProps) {
  const { city: cityParam } = await params;
  const city = await resolveCity(cityParam);

  if (!city) notFound();

  const articles = await listCityHomeArticles(city);

  return (
    <main>
      <BlogIndex articles={articles} />
    </main>
  );
}
