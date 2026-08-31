import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CityHomePage from "@/features/city-home/pages/CityHomePage";
import { buildCityHubMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

export const dynamic = "force-dynamic";

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
  return applyGlobalRobotsOverride(await buildCityHubMetadata(citySlug));
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  await searchParams;

  const city = await findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: {
      id: true,
      slug: true,
      name: true,
      centerLat: true,
      centerLng: true,
      lat: true,
      lng: true,
    },
  });

  if (!city) notFound();

  return <CityHomePage city={city} />;
}
