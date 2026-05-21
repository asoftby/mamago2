import type { Metadata } from "next";
import CityHomePage from "@/features/city-home/pages/CityHomePage";
import { buildCityHomeCanonicalToEvents } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

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
  return applyGlobalRobotsOverride(await buildCityHomeCanonicalToEvents(citySlug));
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  await searchParams;

  return <CityHomePage citySlug={citySlug} />;
}
