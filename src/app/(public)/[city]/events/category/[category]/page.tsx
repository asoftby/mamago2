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

  const metadata: Metadata = {
    title: `${hub.category.nameRu} для детей в ${cityName} — mamaGo`,
    description: `${hub.category.nameRu} для детей в ${cityName}: актуальная афиша, даты, возраст, стоимость и места проведения на mamaGo.`,
    alternates: { canonical },
  };

  // The clean category path is indexable. Additional discovery combinations
  // remain useful for users but must not create an indexable faceted-URL fanout.
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

  return (
    <CityShell
      citySlug={citySlug}
      intent="kuda"
      searchParams={{ ...query, category: hub.category.slug }}
    />
  );
}
