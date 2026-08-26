import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { buildCityEventsListingMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  const query = await searchParams;
  const discoveryKeys = new Set(["preset", "from", "to", "dateFrom", "dateTo", "when", "age", "category", "genre", "format", "metro", "district", "nearby", "free", "priceMax", "adultOnly"]);
  const isFiltered = Object.keys(query).some((key) => discoveryKeys.has(key));
  const metadata = await buildCityEventsListingMetadata(citySlug);
  if (isFiltered) metadata.robots = { index: false, follow: true };
  return applyGlobalRobotsOverride(metadata);
}

/**
 * Каноническая страница интента «Куда пойти» (афиша / discovery).
 * `/[city]/kuda` и корень `/[city]` указывают сюда через canonical или redirect.
 */
export default async function CityEventsListingPage({
  params,
  searchParams,
}: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CityShell
      citySlug={citySlug}
      intent="kuda"
      searchParams={resolvedSearchParams}
    />
  );
}
