import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { buildCityClassesListingMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  return applyGlobalRobotsOverride(await buildCityClassesListingMetadata(citySlug));
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
