import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CityShell } from "@/components/city/CityShell";
import prisma from "@/lib/prisma";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { getBaseUrl } from "@/lib/routing/cityPaths";
import { eventCategoryHubPath } from "@/lib/seo/eventCategoryHub";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

interface PageProps {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DISCOVERY_FILTER_KEYS = new Set([
  "preset",
  "from",
  "to",
  "dateFrom",
  "dateTo",
  "when",
  "age",
  "category",
  "genre",
  "format",
  "metro",
  "district",
  "nearby",
  "free",
  "priceMax",
  "adultOnly",
]);

async function resolveHub(citySlug: string, categorySlug: string) {
  const [city, category] = await Promise.all([
    prisma.city.findFirst({
      where: { slug: citySlug, isActive: true, isLegacyNonCity: false },
      select: { id: true, slug: true },
    }),
    prisma.eventCategory.findFirst({
      where: { slug: categorySlug, isActive: true },
      select: { id: true, slug: true, nameRu: true },
    }),
  ]);

  if (!city || !category) return null;
  return { city, category };
}

function hubCopy(categoryName: string, cityName: string) {
  return {
    title: `${categoryName} для детей в ${cityName}`,
    description: `${categoryName} для детей в ${cityName}: актуальная афиша, даты, возраст, стоимость и места проведения на mamaGo.`,
  };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { city: citySlug, category: categorySlug } = await params;
  const [hub, query] = await Promise.all([
    resolveHub(citySlug, categorySlug),
    searchParams,
  ]);

  if (!hub) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const cityName = getCityDisplayName(citySlug);
  const canonical = `${getBaseUrl("BY")}${eventCategoryHubPath(citySlug, hub.category.slug)}`;
  const hasExtraDiscoveryFilter = Object.keys(query).some((key) => DISCOVERY_FILTER_KEYS.has(key));
  const copy = hubCopy(hub.category.nameRu, cityName);

  const metadata: Metadata = {
    title: `${copy.title} — mamaGo`,
    description: copy.description,
    alternates: { canonical },
  };

  if (hasExtraDiscoveryFilter) metadata.robots = { index: false, follow: true };

  return applyGlobalRobotsOverride(metadata);
}

export default async function EventCategoryHubPage({ params, searchParams }: PageProps) {
  const { city: citySlug, category: categorySlug } = await params;
  const [hub, query] = await Promise.all([
    resolveHub(citySlug, categorySlug),
    searchParams,
  ]);

  if (!hub) notFound();

  const cityName = getCityDisplayName(citySlug);
  const copy = hubCopy(hub.category.nameRu, cityName);

  return (
    <CityShell
      citySlug={citySlug}
      intent="kuda"
      searchParams={{ ...query, category: hub.category.slug }}
      pageTitleOverride={copy.title}
      pageDescription={copy.description}
    />
  );
}
