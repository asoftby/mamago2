import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { buildCityHomeCanonicalToEvents } from "@/lib/seo/cityKudaListingMetadata";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  return buildCityHomeCanonicalToEvents(citySlug);
}

export default async function CityPage({ params, searchParams }: PageProps) {
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
