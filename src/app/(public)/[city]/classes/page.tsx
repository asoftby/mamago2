import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { buildCityClassesListingMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const query = await searchParams;
  const discoveryKeys = new Set(["preset", "from", "to", "dateFrom", "dateTo", "when", "age", "category", "genre", "format", "metro", "district", "nearby", "free", "priceMax", "adultOnly"]);
  const isFiltered = Object.keys(query).some((key) => discoveryKeys.has(key));
  const metadata = await buildCityClassesListingMetadata(citySlug);
  if (isFiltered) metadata.robots = { index: false, follow: true };
  return applyGlobalRobotsOverride(metadata);
}

export default async function ClassesPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CityShell
      citySlug={citySlug}
      intent="classes"
      searchParams={resolvedSearchParams}
    />
  );
}
